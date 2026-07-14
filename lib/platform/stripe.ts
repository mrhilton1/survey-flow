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
