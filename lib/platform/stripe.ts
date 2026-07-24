import Stripe from "stripe"

let stripeInstance: Stripe | null = null

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null

  if (!stripeInstance) {
    stripeInstance = new Stripe(key, {
      apiVersion: "2024-12-18.acacia" as any,
      typescript: true
    })
  }

  return stripeInstance
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
    return {
      mode: "stub" as const,
      url: `${input.successUrl}&mode=stub&price=${encodeURIComponent(input.priceId)}`,
      message: "Stripe test stub session generated. Set STRIPE_SECRET_KEY in AI Studio secrets to redirect to live Stripe Checkout."
    }
  }

  try {
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

    return {
      mode: "stripe" as const,
      url: session.url
    }
  } catch (error: any) {
    console.error("Stripe Checkout Session Error:", error)
    return {
      error: error.message || "Failed to create Stripe Checkout session"
    }
  }
}

export async function createBillingPortalSession(input: {
  customerId: string
  returnUrl: string
}) {
  const stripe = getStripe()
  if (!stripe) {
    return {
      mode: "stub" as const,
      url: `${input.returnUrl}?mode=stub_portal`,
      message: "Stripe test stub portal session generated. Set STRIPE_SECRET_KEY to redirect to live Stripe Customer Portal."
    }
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: input.customerId,
      return_url: input.returnUrl
    })

    return {
      mode: "stripe" as const,
      url: session.url
    }
  } catch (error: any) {
    console.error("Stripe Portal Error:", error)
    return {
      error: error.message || "Failed to create Stripe Portal session"
    }
  }
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

export async function verifyAndConstructStripeEvent(rawBody: string, signature: string | null) {
  const stripe = getStripe()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!stripe || !webhookSecret || !signature) {
    // If webhook secret isn't configured, parse event body directly for test calls
    try {
      const parsed = JSON.parse(rawBody)
      return { event: parsed, verified: false }
    } catch {
      return { event: null, verified: false, error: "Invalid JSON body" }
    }
  }

  try {
    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
    return { event, verified: true }
  } catch (err: any) {
    console.error("Stripe Webhook Signature Verification Error:", err.message)
    return { event: null, verified: false, error: err.message }
  }
}

