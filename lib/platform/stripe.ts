import Stripe from "stripe"
import { getRuntimeEnv } from "./env"

const STRIPE_API_VERSION = "2026-06-24.dahlia" as const

export function getStripe() {
  const key = getRuntimeEnv("STRIPE_SECRET_KEY")
  if (!key) return null

  return new Stripe(key, {
    apiVersion: STRIPE_API_VERSION,
    httpClient: Stripe.createFetchHttpClient(),
    maxNetworkRetries: 1,
    timeout: 15_000,
    typescript: true
  })
}

export function requireStripe() {
  const stripe = getStripe()
  if (!stripe) {
    throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY in the server environment.")
  }
  return stripe
}

function integrationIdentifier() {
  const suffix = Array.from(crypto.getRandomValues(new Uint8Array(8)), (value) => String.fromCharCode(97 + (value % 26))).join("")
  return `surveyflow_checkout_${suffix}`
}

export async function createStripeCustomer(input: {
  email: string
  name: string
  workspaceId: string
  applicationKey: string
}) {
  const stripe = requireStripe()
  return stripe.customers.create({
    email: input.email,
    name: input.name,
    metadata: {
      workspace_id: input.workspaceId,
      application_key: input.applicationKey
    }
  }, {
    idempotencyKey: `workspace-customer-${input.applicationKey}-${input.workspaceId}`
  })
}

export async function createCheckoutSession(input: {
  customerId: string
  workspaceId: string
  applicationKey: string
  planId: string
  priceId: string
  trialDays: number
  successUrl: string
  cancelUrl: string
}) {
  const stripe = requireStripe()
  const metadata = {
    workspace_id: input.workspaceId,
    application_key: input.applicationKey,
    plan_id: input.planId
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: input.customerId,
    client_reference_id: input.workspaceId,
    integration_identifier: integrationIdentifier(),
    line_items: [{ price: input.priceId, quantity: 1 }],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    metadata,
    subscription_data: {
      metadata,
      ...(input.trialDays > 0 ? { trial_period_days: input.trialDays } : {})
    }
  })

  return { url: session.url }
}

export async function createBillingPortalSession(input: {
  customerId: string
  returnUrl: string
}) {
  const stripe = requireStripe()
  const session = await stripe.billingPortal.sessions.create({
    customer: input.customerId,
    return_url: input.returnUrl
  })

  return { url: session.url }
}

async function resolveRecurringPrice(input: {
  stripe: Stripe
  productId: string
  applicationKey: string
  planKey: string
  currency: string
  amount: number | null | undefined
  interval: "month" | "year"
  existingPriceId?: string | null
}) {
  if (input.amount === null || input.amount === undefined || input.amount <= 0) {
    if (input.existingPriceId) {
      await input.stripe.prices.update(input.existingPriceId, { active: false })
    }
    return null
  }

  const unitAmount = Math.round(input.amount * 100)
  if (input.existingPriceId) {
    const existing = await input.stripe.prices.retrieve(input.existingPriceId)
    const existingProductId = typeof existing.product === "string" ? existing.product : existing.product.id
    if (
      existing.active &&
      existingProductId === input.productId &&
      existing.currency.toLowerCase() === input.currency &&
      existing.unit_amount === unitAmount &&
      existing.recurring?.interval === input.interval
    ) {
      return existing.id
    }
  }

  const metadata = {
    application_key: input.applicationKey,
    plan_key: input.planKey
  }
  const price = await input.stripe.prices.create({
    product: input.productId,
    currency: input.currency,
    unit_amount: unitAmount,
    recurring: { interval: input.interval },
    lookup_key: `${input.applicationKey}_${input.planKey}_${input.interval === "month" ? "monthly" : "yearly"}`,
    transfer_lookup_key: true,
    metadata
  })

  if (input.existingPriceId && input.existingPriceId !== price.id) {
    await input.stripe.prices.update(input.existingPriceId, { active: false })
  }
  return price.id
}

export async function createPlanStripeRecords(input: {
  applicationKey: string
  planKey: string
  name: string
  description?: string | null
  currency: string
  monthlyAmount?: number | null
  yearlyAmount?: number | null
  existingProductId?: string | null
  existingMonthlyPriceId?: string | null
  existingYearlyPriceId?: string | null
}) {
  const stripe = requireStripe()
  const currency = (input.currency || "usd").toLowerCase()
  const existingProductId = input.existingProductId?.startsWith("prod_stub_") ? null : input.existingProductId
  const existingMonthlyPriceId = input.existingMonthlyPriceId?.startsWith("price_stub_") ? null : input.existingMonthlyPriceId
  const existingYearlyPriceId = input.existingYearlyPriceId?.startsWith("price_stub_") ? null : input.existingYearlyPriceId
  const metadata = {
    application_key: input.applicationKey,
    plan_key: input.planKey
  }

  if ((!input.monthlyAmount || input.monthlyAmount <= 0) && (!input.yearlyAmount || input.yearlyAmount <= 0)) {
    throw new Error("A paid plan needs a positive monthly or yearly price before Stripe provisioning.")
  }

  const product = existingProductId
    ? await stripe.products.update(existingProductId, {
        active: true,
        name: input.name,
        description: input.description || undefined,
        metadata
      })
    : await stripe.products.create({
        name: input.name,
        description: input.description || undefined,
        metadata
      })

  const monthlyPriceId = await resolveRecurringPrice({
    stripe,
    productId: product.id,
    applicationKey: input.applicationKey,
    planKey: input.planKey,
    currency,
    amount: input.monthlyAmount,
    interval: "month",
    existingPriceId: existingMonthlyPriceId
  })
  const yearlyPriceId = await resolveRecurringPrice({
    stripe,
    productId: product.id,
    applicationKey: input.applicationKey,
    planKey: input.planKey,
    currency,
    amount: input.yearlyAmount,
    interval: "year",
    existingPriceId: existingYearlyPriceId
  })

  return {
    mode: "stripe" as const,
    productId: product.id,
    monthlyPriceId,
    yearlyPriceId
  }
}

export async function archivePlanStripeRecords(input: {
  productId?: string | null
  monthlyPriceId?: string | null
  yearlyPriceId?: string | null
}) {
  const stripe = requireStripe()
  const priceIds = [input.monthlyPriceId, input.yearlyPriceId]
    .filter((id): id is string => typeof id === "string" && !id.startsWith("price_stub_"))

  for (const priceId of new Set(priceIds)) {
    await stripe.prices.update(priceId, { active: false })
  }

  if (input.productId && !input.productId.startsWith("prod_stub_")) {
    await stripe.products.update(input.productId, { active: false })
  }

  return { mode: "stripe" as const, archived: true }
}
