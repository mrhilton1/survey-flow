import { redirect } from "next/navigation"
import { BillingConsole, type BillingAssignment, type BillingPlan } from "@/components/platform/billing-console"
import { appConfig } from "@/config/app.config"
import { getCurrentSession } from "@/lib/platform/auth"
import { canManageBilling } from "@/lib/platform/billing"
import { createServerSupabaseClient } from "@/lib/platform/supabase"

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const session = await getCurrentSession()
  if (!session.authenticated) redirect(appConfig.auth.loginPath)
  if (!canManageBilling(session) || !session.workspace) {
    return (
      <div className="mx-auto max-w-4xl rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <h1 className="text-xl font-semibold">Billing access required</h1>
        <p className="mt-2 text-sm">Only the workspace owner or a role with billing management permission can view and change billing.</p>
      </div>
    )
  }

  const supabase = createServerSupabaseClient()
  const [{ data: plans, error: plansError }, { data: assignment, error: assignmentError }] = await Promise.all([
    supabase
      .from("app_shell_plans")
      .select("id, plan_key, name, description, status, active, price_monthly, price_yearly, currency, trial_days, display_order, is_featured, badge_text, stripe_monthly_price_id, stripe_yearly_price_id")
      .eq("application_key", appConfig.product.applicationKey)
      .eq("active", true)
      .eq("status", "active")
      .order("display_order"),
    supabase
      .from("app_shell_workspace_plans")
      .select("plan_id, plan_key, billing_cycle, status, current_period_start, current_period_end, cancel_at, cancel_at_period_end, latest_invoice_status, stripe_customer_id, stripe_subscription_id, trial_ends_at")
      .eq("application_key", appConfig.product.applicationKey)
      .eq("workspace_id", session.workspace.id)
      .maybeSingle()
  ])
  if (plansError || assignmentError) {
    throw new Error(plansError?.message || assignmentError?.message)
  }

  const { checkout } = await searchParams
  return (
    <BillingConsole
      workspaceName={session.workspace.name}
      workspacePlanKey={session.workspace.planKey}
      plans={(plans || []) as BillingPlan[]}
      assignment={(assignment || null) as BillingAssignment | null}
      checkoutResult={checkout || null}
    />
  )
}
