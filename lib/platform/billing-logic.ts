export type BillingInterval = "monthly" | "yearly"

export interface ResolvableBillingPlan {
  plan_key: string
  status: string
  active: boolean
  price_monthly: number | null
  price_yearly: number | null
  stripe_monthly_price_id: string | null
  stripe_yearly_price_id: string | null
}

export function isBillingRequestAuthorized(input: { authenticated: boolean; hasUser: boolean; hasWorkspace: boolean; hasPermission: boolean }) {
  return input.authenticated && input.hasUser && input.hasWorkspace && input.hasPermission
}

export function resolveAvailablePlanPrice(plan: ResolvableBillingPlan, interval: BillingInterval) {
  if (!plan.active || plan.status !== "active" || plan.plan_key === "free") {
    throw new Error("This plan is not available for subscription checkout.")
  }
  const amount = interval === "monthly" ? plan.price_monthly : plan.price_yearly
  const priceId = interval === "monthly" ? plan.stripe_monthly_price_id : plan.stripe_yearly_price_id
  if (!amount || amount <= 0 || !priceId) {
    throw new Error(`This plan does not have an available ${interval} Stripe price.`)
  }
  return { amount, priceId }
}

export function shouldRetryStripeEvent(status: string | null | undefined) {
  return status === "failed"
}
