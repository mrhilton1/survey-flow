import Stripe from "stripe"

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null

  return new Stripe(key, {
    typescript: true
  })
}

export async function createCheckoutSession(input: {
  customerEmail: string
  workspaceId: string
  priceId: string
  successUrl: string
  cancelUrl: string
}) {
  const stripe = getStripe()
  if (!stripe) {
    return { url: `${input.successUrl}?stripe=stub&price=${input.priceId}` }
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: input.customerEmail,
    line_items: [{ price: input.priceId, quantity: 1 }],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    metadata: {
      workspace_id: input.workspaceId
    }
  })

  return { url: session.url }
}

export async function createBillingPortalSession(input: {
  customerId: string
  returnUrl: string
}) {
  const stripe = getStripe()
  if (!stripe) {
    return { url: `${input.returnUrl}?stripe_portal=stub` }
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: input.customerId,
    return_url: input.returnUrl
  })

  return { url: session.url }
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
}) {
  const stripe = getStripe()
  const currency = (input.currency || "usd").toLowerCase()
  const metadata = {
    application_key: input.applicationKey,
    plan_key: input.planKey
  }

  if (!stripe) {
    return {
      mode: "stub" as const,
      productId: input.existingProductId || `prod_stub_${input.applicationKey}_${input.planKey}`,
      monthlyPriceId: input.monthlyAmount !== null && input.monthlyAmount !== undefined ? `price_stub_${input.planKey}_monthly` : null,
      yearlyPriceId: input.yearlyAmount !== null && input.yearlyAmount !== undefined ? `price_stub_${input.planKey}_yearly` : null
    }
  }

  const product = input.existingProductId
    ? await stripe.products.update(input.existingProductId, {
        name: input.name,
        description: input.description || undefined,
        metadata
      })
    : await stripe.products.create({
        name: input.name,
        description: input.description || undefined,
        metadata
      })

  const createRecurringPrice = async (amount: number, interval: "month" | "year") => {
    const unitAmount = Math.round(amount * 100)
    if (unitAmount < 0) return null
    const price = await stripe.prices.create({
      product: product.id,
      currency,
      unit_amount: unitAmount,
      recurring: { interval },
      lookup_key: `${input.applicationKey}_${input.planKey}_${interval === "month" ? "monthly" : "yearly"}`,
      metadata
    })
    return price.id
  }

  return {
    mode: "stripe" as const,
    productId: product.id,
    monthlyPriceId: input.monthlyAmount !== null && input.monthlyAmount !== undefined ? await createRecurringPrice(input.monthlyAmount, "month") : null,
    yearlyPriceId: input.yearlyAmount !== null && input.yearlyAmount !== undefined ? await createRecurringPrice(input.yearlyAmount, "year") : null
  }
}
