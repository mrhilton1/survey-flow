import { NextResponse } from "next/server"
import { appConfig } from "@/config/app.config"
import { getCurrentSession } from "@/lib/platform/auth"
import { canManageBilling, getApplicationUrl, resolvePlanPrice, type BillingInterval, type BillingPlanRow } from "@/lib/platform/billing"
import { createCheckoutSession, createStripeCustomer } from "@/lib/platform/stripe"
import { createServerSupabaseClient } from "@/lib/platform/supabase"

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession()
    if (!session.authenticated) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!canManageBilling(session) || !session.user || !session.workspace) {
      return NextResponse.json({ error: "Billing manager access is required." }, { status: 403 })
    }

    const body = await request.json().catch(() => null) as { planId?: string; interval?: BillingInterval } | null
    if (!body?.planId || !body.interval || !["monthly", "yearly"].includes(body.interval)) {
      return NextResponse.json({ error: "A valid planId and billing interval are required." }, { status: 400 })
    }

    const supabase = createServerSupabaseClient()
    const [{ data: plan, error: planError }, { data: workspacePlan, error: workspacePlanError }, { data: workspace, error: workspaceError }] = await Promise.all([
      supabase
        .from("app_shell_plans")
        .select("id, plan_key, name, description, billing_type, status, active, price_monthly, price_yearly, currency, stripe_monthly_price_id, stripe_yearly_price_id, trial_days, display_order, is_featured, badge_text")
        .eq("id", body.planId)
        .eq("application_key", appConfig.product.applicationKey)
        .maybeSingle(),
      supabase
        .from("app_shell_workspace_plans")
        .select("id, plan_id, plan_key, status, stripe_customer_id, stripe_subscription_id")
        .eq("workspace_id", session.workspace.id)
        .eq("application_key", appConfig.product.applicationKey)
        .maybeSingle(),
      supabase
        .from("app_shell_workspaces")
        .select("id, name, stripe_customer_id")
        .eq("id", session.workspace.id)
        .eq("application_key", appConfig.product.applicationKey)
        .maybeSingle()
    ])

    if (planError || workspacePlanError || workspaceError) {
      throw new Error(planError?.message || workspacePlanError?.message || workspaceError?.message)
    }
    if (!plan || !workspace) return NextResponse.json({ error: "Plan or workspace not found." }, { status: 404 })
    if (workspacePlan?.stripe_subscription_id && !["canceled", "incomplete_expired"].includes(workspacePlan.status)) {
      return NextResponse.json({ error: "This workspace already has a subscription. Use the billing portal to change or cancel it." }, { status: 409 })
    }

    let priceId: string
    try {
      priceId = resolvePlanPrice(plan as BillingPlanRow, body.interval).priceId
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "This plan is unavailable." }, { status: 400 })
    }
    let customerId = workspacePlan?.stripe_customer_id || workspace.stripe_customer_id
    if (!customerId) {
      const customer = await createStripeCustomer({
        email: session.user.email,
        name: workspace.name,
        workspaceId: workspace.id,
        applicationKey: appConfig.product.applicationKey
      })
      customerId = customer.id

      const [{ error: workspaceCustomerError }, { error: planCustomerError }] = await Promise.all([
        supabase
          .from("app_shell_workspaces")
          .update({ stripe_customer_id: customerId })
          .eq("id", workspace.id)
          .eq("application_key", appConfig.product.applicationKey),
        workspacePlan
          ? supabase
              .from("app_shell_workspace_plans")
              .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
              .eq("id", workspacePlan.id)
          : supabase.from("app_shell_workspace_plans").insert({
              application_key: appConfig.product.applicationKey,
              workspace_id: workspace.id,
              plan_key: session.workspace.planKey,
              status: "active",
              stripe_customer_id: customerId
            })
      ])
      if (workspaceCustomerError || planCustomerError) {
        throw new Error(workspaceCustomerError?.message || planCustomerError?.message)
      }
    }

    const appUrl = getApplicationUrl(request.url)
    const checkout = await createCheckoutSession({
      customerId,
      workspaceId: workspace.id,
      applicationKey: appConfig.product.applicationKey,
      planId: plan.id,
      priceId,
      trialDays: Math.max(0, plan.trial_days || 0),
      successUrl: `${appUrl}/dashboard/billing?checkout=success`,
      cancelUrl: `${appUrl}/dashboard/billing?checkout=cancelled`
    })

    return NextResponse.json(checkout)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to start checkout." }, { status: 500 })
  }
}
