import { NextResponse } from "next/server"
import Stripe from "stripe"
import { appConfig } from "@/config/app.config"
import { stripeId, subscriptionPeriod, unixTimeToIso } from "@/lib/platform/billing"
import { shouldRetryStripeEvent } from "@/lib/platform/billing-logic"
import { getRuntimeEnv } from "@/lib/platform/env"
import { requireStripe } from "@/lib/platform/stripe"
import { createServerSupabaseClient } from "@/lib/platform/supabase"

const HANDLED_EVENTS = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed"
])

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature")
  const webhookSecret = getRuntimeEnv("STRIPE_WEBHOOK_SECRET")
  if (!signature) return NextResponse.json({ error: "Missing Stripe-Signature header." }, { status: 400 })
  if (!webhookSecret) return NextResponse.json({ error: "Stripe webhook secret is not configured." }, { status: 500 })

  const rawBody = await request.text()
  let event: Stripe.Event
  try {
    event = await requireStripe().webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
      undefined,
      Stripe.createSubtleCryptoProvider()
    )
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const { data: inserted, error: insertError } = await supabase
    .from("app_shell_stripe_events")
    .insert({
      application_key: appConfig.product.applicationKey,
      stripe_event_id: event.id,
      event_type: event.type,
      status: "processing",
      payload: event
    })
    .select("id")
    .maybeSingle()

  let ledgerId = inserted?.id as string | undefined
  if (insertError) {
    if (insertError.code !== "23505") {
      return NextResponse.json({ error: "Unable to record Stripe event." }, { status: 500 })
    }
    const { data: existing } = await supabase
      .from("app_shell_stripe_events")
      .select("id, status")
      .eq("stripe_event_id", event.id)
      .maybeSingle()
    if (!existing || !shouldRetryStripeEvent(existing.status)) {
      return NextResponse.json({ received: true, duplicate: true })
    }
    const { data: claimed } = await supabase
      .from("app_shell_stripe_events")
      .update({ status: "processing", error: null })
      .eq("id", existing.id)
      .eq("status", "failed")
      .select("id")
      .maybeSingle()
    if (!claimed) return NextResponse.json({ received: true, duplicate: true })
    ledgerId = claimed.id
  }
  if (!ledgerId) return NextResponse.json({ error: "Unable to claim Stripe event." }, { status: 500 })

  try {
    const workspaceId = HANDLED_EVENTS.has(event.type) ? await processStripeEvent(event) : null
    await supabase
      .from("app_shell_stripe_events")
      .update({
        workspace_id: workspaceId,
        status: "processed",
        processed_at: new Date().toISOString(),
        error: null
      })
      .eq("id", ledgerId)
    return NextResponse.json({ received: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown webhook processing error"
    await supabase
      .from("app_shell_stripe_events")
      .update({ status: "failed", error: message.slice(0, 2000) })
      .eq("id", ledgerId)
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 })
  }
}

async function processStripeEvent(event: Stripe.Event) {
  const stripe = requireStripe()

  if (event.type === "checkout.session.completed") {
    const checkout = event.data.object as Stripe.Checkout.Session
    const subscriptionId = stripeId(checkout.subscription)
    if (subscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId)
      return syncSubscription(subscription)
    }
    return persistCheckoutCustomer(checkout)
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    return syncSubscription(event.data.object as Stripe.Subscription)
  }

  if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice
    const subscriptionId = stripeId(invoice.parent?.subscription_details?.subscription)
    if (!subscriptionId) return null
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    return syncSubscription(subscription, event.type === "invoice.paid" ? "paid" : "payment_failed")
  }

  return null
}

async function persistCheckoutCustomer(checkout: Stripe.Checkout.Session) {
  const metadata = checkout.metadata || {}
  if (metadata.application_key !== appConfig.product.applicationKey || !metadata.workspace_id) {
    throw new Error("Checkout metadata is missing a valid application_key or workspace_id.")
  }
  const customerId = stripeId(checkout.customer)
  if (!customerId) throw new Error("Checkout session is missing a Stripe customer.")

  const supabase = createServerSupabaseClient()
  const { data: workspace } = await supabase
    .from("app_shell_workspaces")
    .select("id")
    .eq("id", metadata.workspace_id)
    .eq("application_key", appConfig.product.applicationKey)
    .maybeSingle()
  if (!workspace) throw new Error("Checkout metadata references an unknown workspace.")

  await Promise.all([
    supabase.from("app_shell_workspaces").update({ stripe_customer_id: customerId }).eq("id", workspace.id),
    supabase.from("app_shell_workspace_plans").update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() }).eq("workspace_id", workspace.id)
  ])
  return workspace.id as string
}

async function syncSubscription(subscription: Stripe.Subscription, invoiceStatus?: string | null) {
  const metadata = subscription.metadata || {}
  const supabase = createServerSupabaseClient()
  const subscriptionId = subscription.id
  const customerId = stripeId(subscription.customer)
  let workspaceId = metadata.workspace_id || null
  let planId = metadata.plan_id || null

  if (metadata.application_key && metadata.application_key !== appConfig.product.applicationKey) {
    throw new Error("Subscription belongs to a different application.")
  }
  if (!workspaceId) {
    const { data: assignment } = await supabase
      .from("app_shell_workspace_plans")
      .select("workspace_id, plan_id")
      .eq("stripe_subscription_id", subscriptionId)
      .eq("application_key", appConfig.product.applicationKey)
      .maybeSingle()
    workspaceId = assignment?.workspace_id || null
    planId = planId || assignment?.plan_id || null
  }
  if (!workspaceId) throw new Error("Subscription metadata is missing workspace_id.")

  const { data: workspace } = await supabase
    .from("app_shell_workspaces")
    .select("id")
    .eq("id", workspaceId)
    .eq("application_key", appConfig.product.applicationKey)
    .maybeSingle()
  if (!workspace) throw new Error("Subscription references an unknown workspace.")

  const priceId = subscription.items.data[0]?.price.id || null
  let planQuery = supabase
    .from("app_shell_plans")
    .select("id, plan_key")
    .eq("application_key", appConfig.product.applicationKey)
  if (planId) {
    planQuery = planQuery.eq("id", planId)
  } else if (priceId) {
    planQuery = planQuery.or(`stripe_monthly_price_id.eq.${priceId},stripe_yearly_price_id.eq.${priceId}`)
  } else {
    throw new Error("Subscription does not contain a resolvable plan price.")
  }
  const { data: plan } = await planQuery.maybeSingle()
  if (!plan) throw new Error("Subscription references an unknown SurveyFlow plan.")

  const isDeleted = subscription.status === "canceled"
  let appliedPlan = plan
  if (isDeleted) {
    const { data: freePlan } = await supabase
      .from("app_shell_plans")
      .select("id, plan_key")
      .eq("application_key", appConfig.product.applicationKey)
      .eq("plan_key", "free")
      .maybeSingle()
    if (!freePlan) throw new Error("The free plan is missing; canceled subscriptions cannot be downgraded.")
    appliedPlan = freePlan
  }

  const { currentPeriodStart, currentPeriodEnd } = subscriptionPeriod(subscription)
  const interval = subscription.items.data[0]?.price.recurring?.interval === "year" ? "yearly" : "monthly"
  const assignment = {
    application_key: appConfig.product.applicationKey,
    workspace_id: workspaceId,
    plan_id: appliedPlan.id,
    plan_key: appliedPlan.plan_key,
    billing_cycle: interval,
    status: subscription.status,
    current_period_start: currentPeriodStart,
    current_period_end: currentPeriodEnd,
    cancel_at: unixTimeToIso(subscription.cancel_at),
    cancel_at_period_end: subscription.cancel_at_period_end,
    stripe_customer_id: customerId,
    stripe_subscription_id: isDeleted ? null : subscriptionId,
    trial_ends_at: unixTimeToIso(subscription.trial_end),
    updated_at: new Date().toISOString(),
    ...(invoiceStatus ? { latest_invoice_status: invoiceStatus } : {})
  }

  const [{ error: assignmentError }, { error: workspaceError }] = await Promise.all([
    supabase.from("app_shell_workspace_plans").upsert(assignment, { onConflict: "workspace_id" }),
    supabase
      .from("app_shell_workspaces")
      .update({ plan_key: appliedPlan.plan_key, stripe_customer_id: customerId })
      .eq("id", workspaceId)
      .eq("application_key", appConfig.product.applicationKey)
  ])
  if (assignmentError || workspaceError) throw new Error(assignmentError?.message || workspaceError?.message)
  return workspaceId as string
}
