import type Stripe from "stripe"
import { appConfig } from "@/config/app.config"
import { getRuntimeEnv } from "./env"
import { hasPermission } from "./permissions"
import type { AppSession } from "./types"
import { isBillingRequestAuthorized, resolveAvailablePlanPrice, type BillingInterval, type PlanBillingType } from "./billing-logic"

export type { BillingInterval } from "./billing-logic"

export interface BillingPlanRow {
  id: string
  plan_key: string
  billing_type: PlanBillingType
  name: string
  description: string | null
  status: string
  active: boolean
  price_monthly: number | null
  price_yearly: number | null
  currency: string
  stripe_monthly_price_id: string | null
  stripe_yearly_price_id: string | null
  trial_days: number
  display_order: number
  is_featured: boolean
  badge_text: string | null
}

export function canManageBilling(session: AppSession) {
  return isBillingRequestAuthorized({
    authenticated: session.authenticated,
    hasUser: Boolean(session.user),
    hasWorkspace: Boolean(session.workspace),
    hasPermission: Boolean(session.user && hasPermission(session.user.role, "billing:manage"))
  })
}

export function resolvePlanPrice(plan: BillingPlanRow, interval: BillingInterval) {
  return resolveAvailablePlanPrice(plan, interval)
}

export function getApplicationUrl(requestUrl: string) {
  const configured = getRuntimeEnv("NEXT_PUBLIC_APP_URL")
  if (configured) {
    try {
      return new URL(configured).origin
    } catch {
      throw new Error("NEXT_PUBLIC_APP_URL must be a valid absolute URL.")
    }
  }
  return new URL(requestUrl).origin
}

export function stripeMetadata(input: { workspaceId: string; planId: string }) {
  return {
    workspace_id: input.workspaceId,
    application_key: appConfig.product.applicationKey,
    plan_id: input.planId
  }
}

export function subscriptionPeriod(subscription: Stripe.Subscription) {
  const starts = subscription.items.data.map((item) => item.current_period_start).filter(Boolean)
  const ends = subscription.items.data.map((item) => item.current_period_end).filter(Boolean)
  return {
    currentPeriodStart: starts.length ? new Date(Math.min(...starts) * 1000).toISOString() : null,
    currentPeriodEnd: ends.length ? new Date(Math.max(...ends) * 1000).toISOString() : null
  }
}

export function unixTimeToIso(value: number | null | undefined) {
  return value ? new Date(value * 1000).toISOString() : null
}

export function stripeId(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id || null
}
