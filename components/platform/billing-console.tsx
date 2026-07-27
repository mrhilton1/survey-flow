"use client"

import { useMemo, useState } from "react"
import { AlertCircle, CheckCircle2, CreditCard, ExternalLink, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { BillingInterval } from "@/lib/platform/billing"

export interface BillingPlan {
  id: string
  plan_key: string
  name: string
  description: string | null
  status: string
  active: boolean
  price_monthly: number | null
  price_yearly: number | null
  currency: string
  trial_days: number
  display_order: number
  is_featured: boolean
  badge_text: string | null
  stripe_monthly_price_id: string | null
  stripe_yearly_price_id: string | null
}

export interface BillingAssignment {
  plan_id: string | null
  plan_key: string
  billing_cycle: BillingInterval
  status: string
  current_period_start: string | null
  current_period_end: string | null
  cancel_at: string | null
  cancel_at_period_end: boolean
  latest_invoice_status: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  trial_ends_at: string | null
}

const statusClasses: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800",
  trialing: "bg-blue-100 text-blue-800",
  past_due: "bg-amber-100 text-amber-800",
  unpaid: "bg-red-100 text-red-800",
  canceled: "bg-slate-200 text-slate-700",
  incomplete: "bg-orange-100 text-orange-800",
  incomplete_expired: "bg-red-100 text-red-800",
  paused: "bg-violet-100 text-violet-800"
}

export function BillingConsole({
  workspaceName,
  workspacePlanKey,
  plans,
  assignment,
  checkoutResult
}: {
  workspaceName: string
  workspacePlanKey: string
  plans: BillingPlan[]
  assignment: BillingAssignment | null
  checkoutResult: string | null
}) {
  const [interval, setInterval] = useState<BillingInterval>(assignment?.billing_cycle || "monthly")
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const currentPlan = useMemo(
    () => plans.find((plan) => plan.id === assignment?.plan_id || plan.plan_key === (assignment?.plan_key || workspacePlanKey)),
    [assignment, plans, workspacePlanKey]
  )
  const hasSubscription = Boolean(assignment?.stripe_subscription_id)

  async function startCheckout(planId: string) {
    setLoading(planId)
    setError(null)
    const response = await fetch("/api/platform/billing/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ planId, interval })
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok || !payload.url) {
      setError(payload.error || "Unable to start checkout.")
      setLoading(null)
      return
    }
    window.location.assign(payload.url)
  }

  async function openPortal() {
    setLoading("portal")
    setError(null)
    const response = await fetch("/api/platform/billing/portal", { method: "POST" })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok || !payload.url) {
      setError(payload.error || "Unable to open the billing portal.")
      setLoading(null)
      return
    }
    window.location.assign(payload.url)
  }

  const status = assignment?.status || "active"
  const lifecycleDate = assignment?.cancel_at || assignment?.current_period_end
  const lifecycleLabel = assignment?.cancel_at_period_end ? "Cancels on" : status === "trialing" ? "Trial ends" : "Renews on"

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">Billing</h1>
        <p className="mt-2 text-slate-600">Manage the subscription for {workspaceName}.</p>
      </div>

      {checkoutResult === "success" && (
        <Notice tone="success">Checkout completed. Stripe is synchronizing the subscription; refresh shortly if its status has not appeared yet.</Notice>
      )}
      {checkoutResult === "cancelled" && <Notice tone="warning">Checkout was canceled. No plan change was made.</Notice>}
      {error && <Notice tone="warning">{error}</Notice>}

      <section className="grid gap-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Current plan</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-semibold text-slate-950">{currentPlan?.name || assignment?.plan_key || workspacePlanKey}</h2>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${statusClasses[status] || "bg-slate-100 text-slate-700"}`}>{status.replaceAll("_", " ")}</span>
          </div>
          <div className="mt-3 grid gap-1 text-sm text-slate-600 sm:grid-cols-2">
            <p>Billing: {assignment?.billing_cycle || "No paid subscription"}</p>
            <p>Payment: {formatStatus(assignment?.latest_invoice_status || (hasSubscription ? "pending" : "not required"))}</p>
            {lifecycleDate && <p>{lifecycleLabel}: {formatDate(status === "trialing" && assignment?.trial_ends_at ? assignment.trial_ends_at : lifecycleDate)}</p>}
            {assignment?.current_period_start && <p>Period started: {formatDate(assignment.current_period_start)}</p>}
          </div>
        </div>
        {assignment?.stripe_customer_id && (
          <Button variant="secondary" onClick={openPortal} disabled={Boolean(loading)}>
            {loading === "portal" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
            Manage billing
          </Button>
        )}
      </section>

      <section>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Available plans</h2>
            <p className="mt-1 text-sm text-slate-600">Free workspaces never need a Stripe subscription.</p>
          </div>
          <div className="inline-flex w-fit rounded-xl border border-slate-200 bg-white p-1">
            {(["monthly", "yearly"] as const).map((value) => (
              <button key={value} type="button" onClick={() => setInterval(value)} className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize ${interval === value ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
                {value}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => {
            const isFree = plan.plan_key === "free"
            const amount = interval === "monthly" ? plan.price_monthly : plan.price_yearly
            const priceId = interval === "monthly" ? plan.stripe_monthly_price_id : plan.stripe_yearly_price_id
            const isCurrent = plan.id === assignment?.plan_id || plan.plan_key === (assignment?.plan_key || workspacePlanKey)
            return (
              <article key={plan.id} className={`relative rounded-xl border bg-white p-5 shadow-sm ${plan.is_featured ? "border-orange-300 ring-1 ring-orange-200" : "border-slate-200"}`}>
                {plan.badge_text && <span className="absolute right-4 top-4 rounded-full bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-800">{plan.badge_text}</span>}
                <h3 className="text-lg font-semibold text-slate-950">{plan.name}</h3>
                <p className="mt-2 min-h-10 text-sm text-slate-600">{plan.description || "Workspace access for SurveyFlow."}</p>
                <p className="mt-5 text-3xl font-semibold text-slate-950">
                  {isFree ? "$0" : amount ? formatMoney(amount, plan.currency) : "Unavailable"}
                  {!isFree && amount && <span className="text-sm font-normal text-slate-500">/{interval === "monthly" ? "month" : "year"}</span>}
                </p>
                {plan.trial_days > 0 && !isFree && <p className="mt-2 text-xs font-semibold text-emerald-700">{plan.trial_days}-day trial</p>}
                <div className="mt-5">
                  {isCurrent ? (
                    <Button className="w-full" variant="secondary" disabled>Current plan</Button>
                  ) : hasSubscription ? (
                    <Button className="w-full" variant="secondary" onClick={openPortal} disabled={Boolean(loading)}>Change in billing portal</Button>
                  ) : isFree ? (
                    <Button className="w-full" variant="secondary" disabled>Included without Stripe</Button>
                  ) : (
                    <Button className="w-full" onClick={() => startCheckout(plan.id)} disabled={!amount || !priceId || Boolean(loading)}>
                      {loading === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                      {!amount || !priceId ? "Unavailable" : "Subscribe"}
                    </Button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function Notice({ tone, children }: { tone: "success" | "warning"; children: React.ReactNode }) {
  return (
    <div className={`flex items-start gap-2 rounded-xl border p-4 text-sm ${tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
      {tone === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
      {children}
    </div>
  )
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase(), maximumFractionDigits: 2 }).format(amount)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value))
}

function formatStatus(value: string) {
  return value.replaceAll("_", " ")
}
