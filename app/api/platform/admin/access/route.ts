import { NextResponse } from "next/server"
import { appConfig } from "@/config/app.config"
import { getCurrentSession } from "@/lib/platform/auth"
import { resolveEntitlements } from "@/lib/platform/entitlements"
import { getFeatureAccessMatrix } from "@/lib/platform/feature-access"
import { getFeatureFlag } from "@/lib/platform/feature-flags"
import { hasPermission } from "@/lib/platform/permissions"
import { getPlanCatalogDisposition } from "@/lib/platform/billing-logic"
import { archivePlanStripeRecords, createPlanStripeRecords } from "@/lib/platform/stripe"
import { createServerSupabaseClient } from "@/lib/platform/supabase"
import type { AppSession, FeatureAccessDefinition } from "@/lib/platform/types"

type AdminAction =
  | { action: "upsertFlag"; flagKey: string; enabled: boolean; description?: string | null; workspaceOverrides?: Record<string, boolean> }
  | { action: "deleteFlag"; flagKey: string }
  | { action: "setFlagWorkspaceOverride"; flagKey: string; workspaceId: string; enabled: boolean | null }
  | {
      action: "upsertFeatureRegistry"
      id?: string
      featureKey: string
      featureName: string
      description?: string | null
      category?: string | null
      displayOrder?: number
      purchaseType?: string
      lockedBehavior?: string
      associatedFlags?: string[]
      requiredPermissions?: string[]
      isActive?: boolean
    }
  | { action: "deleteFeatureRegistry"; id: string }
  | {
      action: "upsertLimitType"
      id?: string
      limitKey: string
      limitName: string
      description?: string | null
      category?: string | null
      unit?: string | null
      unitLabel?: string | null
      displayOrder?: number
      isActive?: boolean
    }
  | { action: "deleteLimitType"; id: string }
  | {
      action: "upsertPlan"
      planKey: string
      name: string
      active?: boolean
      status?: string
      description?: string | null
      priceMonthly?: number | null
      priceYearly?: number | null
      currency?: string | null
      displayOrder?: number
      isFeatured?: boolean
      badgeText?: string | null
      trialDays?: number
    }
  | { action: "deletePlan"; planKey: string }
  | { action: "createStripePlanSku"; planKey: string }
  | { action: "syncStripePlan"; planKey: string }
  | { action: "setPlanFeature"; planKey: string; featureKey: string; enabled: boolean; featureId?: string | null }
  | { action: "deletePlanFeature"; planKey: string; featureKey: string }
  | { action: "setPlanLimit"; planKey: string; limitKey: string; limitValue: string; limitTypeId?: string | null; isUnlimited?: boolean; overageEnabled?: boolean; overagePrice?: number | null }
  | { action: "deletePlanLimit"; planKey: string; limitKey: string }
  | { action: "setWorkspacePlan"; workspaceId: string; planKey: string; planId?: string | null; billingCycle?: string; status?: string }
  | { action: "upsertWorkspaceOverride"; id?: string; workspaceId: string; targetType: "feature" | "limit"; targetKey: string; overrideValue: string; reason?: string | null; active?: boolean }
  | { action: "deleteWorkspaceOverride"; id: string }
  | { action: "updateUserRole"; userId: string; role: string }

export async function GET() {
  const { session, error } = await requirePlatformAdmin()
  if (error) return error

  const data = await loadAccessAdminData(session)
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const { session, error } = await requirePlatformAdmin()
  if (error) return error

  const body = (await request.json().catch(() => null)) as AdminAction | null
  if (!body || !("action" in body)) {
    return NextResponse.json({ error: "Missing action" }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const result = await runAdminAction(body, session)
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status || 500 })

  await supabase.from("app_shell_audit_log").insert({
    actor_user_id: session.user?.id || null,
    workspace_id: "workspaceId" in body ? body.workspaceId : null,
    action: `platform.${body.action}`,
    metadata: body
  })

  const data = await loadAccessAdminData(session)
  return NextResponse.json({ ...data, operationWarning: result.warning || null })
}

async function requirePlatformAdmin(): Promise<{ session: AppSession; error: null } | { session: null; error: NextResponse }> {
  const session = await getCurrentSession()
  if (!session.authenticated) {
    return { session: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  if (!session.isPlatformAdmin) {
    return { session: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { session, error: null }
}

async function loadAccessAdminData(session: AppSession) {
  const supabase = createServerSupabaseClient()

  const [
    workspacesResult,
    usersResult,
    flagsResult,
    featureRegistryResult,
    limitTypesResult,
    plansResult,
    workspacePlansResult,
    planFeaturesResult,
    planLimitsResult,
    overridesResult,
    usageCountersResult,
    surveysResult,
    responsesResult,
    telemetryEventsResult,
    webhookDeliveriesResult,
    auditLogResult
  ] = await Promise.all([
    supabase
      .from("app_shell_workspaces")
      .select("id, name, slug, plan_key, stripe_customer_id, created_at")
      .eq("application_key", appConfig.product.applicationKey)
      .order("created_at", { ascending: false }),
    supabase
      .from("app_shell_workspace_users")
      .select("id, email, display_name, role, workspace_id, created_at")
      .eq("application_key", appConfig.product.applicationKey)
      .order("created_at", { ascending: false }),
    supabase.from("app_shell_feature_flags").select("flag_key, enabled, workspace_overrides, description, updated_at").order("flag_key"),
    supabase.from("app_shell_feature_registry").select("id, feature_key, feature_name, description, category, display_order, icon, purchase_type, locked_behavior, associated_flags, required_permissions, is_active").eq("application_key", appConfig.product.applicationKey).order("display_order"),
    supabase.from("app_shell_limit_types").select("id, limit_key, limit_name, description, category, unit, unit_label, is_unlimited_available, overage_enabled, overage_unit_price, display_order, icon, is_active").eq("application_key", appConfig.product.applicationKey).order("display_order"),
    supabase.from("app_shell_plans").select("id, plan_key, name, description, status, price_monthly, price_yearly, currency, stripe_product_id, stripe_monthly_price_id, stripe_yearly_price_id, stripe_sync_status, stripe_sync_error, stripe_synced_at, display_order, is_featured, badge_text, trial_days, active").eq("application_key", appConfig.product.applicationKey).order("display_order"),
    supabase.from("app_shell_workspace_plans").select("id, workspace_id, plan_id, plan_key, billing_cycle, status, stripe_subscription_id, current_period_start, current_period_end").eq("application_key", appConfig.product.applicationKey).order("updated_at", { ascending: false }),
    supabase.from("app_shell_plan_features").select("plan_key, plan_id, feature_key, feature_id, enabled, is_included").eq("application_key", appConfig.product.applicationKey).order("plan_key"),
    supabase.from("app_shell_plan_limits").select("plan_key, plan_id, limit_key, limit_type_id, limit_value, is_unlimited, overage_enabled, overage_price").eq("application_key", appConfig.product.applicationKey).order("plan_key"),
    supabase.from("app_shell_workspace_overrides").select("id, workspace_id, target_type, target_key, override_value, reason, active, created_at").order("created_at", { ascending: false }),
    supabase.from("app_shell_usage_counters").select("id, workspace_id, counter_key, used_value, period_start, period_end").order("period_end", { ascending: false }),
    supabase.from("surveyflow_surveys").select("id, workspace_id, owner_user_id, name, status, responses_count, views_count, created_at, updated_at").order("updated_at", { ascending: false }),
    supabase.from("surveyflow_responses").select("id, workspace_id, survey_id, status, is_test, total_score, submitted_at, last_active_at, created_at, updated_at").order("updated_at", { ascending: false }).limit(500),
    supabase.from("surveyflow_telemetry_events").select("id, workspace_id, survey_id, type, created_at").order("created_at", { ascending: false }).limit(500),
    supabase.from("surveyflow_webhook_deliveries").select("id, workspace_id, survey_id, response_id, status, attempted_at, created_at").order("created_at", { ascending: false }).limit(500),
    supabase.from("app_shell_audit_log").select("id, workspace_id, actor_user_id, action, metadata, created_at").order("created_at", { ascending: false }).limit(500)
  ])

  const workspaces = workspacesResult.data || []
  const users = usersResult.data || []
  const surveys = surveysResult.data || []
  const responses = responsesResult.data || []
  const telemetryEvents = telemetryEventsResult.data || []
  const webhookDeliveries = webhookDeliveriesResult.data || []
  const auditLog = auditLogResult.data || []
  const featureAccess = getFeatureAccessMatrix()
  const featureRegistry = featureRegistryResult.data || []
  const limitTypes = limitTypesResult.data || []

  return {
    app: appConfig.product,
    session: {
      userId: session.user?.id,
      email: session.user?.email,
      workspaceId: session.workspace?.id || null
    },
    definitions: {
      features: appConfig.features,
      limits: appConfig.limits,
      roles: appConfig.roles,
      featureAccess
    },
    data: {
      workspaces,
      users,
      flags: flagsResult.data || [],
      featureRegistry,
      limitTypes,
      plans: plansResult.data || [],
      workspacePlans: workspacePlansResult.data || [],
      planFeatures: planFeaturesResult.data || [],
      planLimits: planLimitsResult.data || [],
      overrides: overridesResult.data || [],
      usageCounters: usageCountersResult.data || [],
      surveys,
      responses,
      telemetryEvents,
      webhookDeliveries,
      auditLog,
      workspaceStats: buildWorkspaceStats(workspaces, users, surveys, responses, telemetryEvents, webhookDeliveries, auditLog)
    },
    diagnostics: await buildDiagnostics(workspaces, featureAccess)
  }
}

function buildWorkspaceStats(
  workspaces: Array<{ id: string; name: string; slug: string; plan_key: string; created_at?: string | null }>,
  users: Array<{ id: string; email: string; role: string; workspace_id: string; created_at?: string | null }>,
  surveys: Array<{ id: string; workspace_id: string; status: string; responses_count?: number | null; views_count?: number | null; updated_at?: string | null }>,
  responses: Array<{ id: string; workspace_id: string; status: string; is_test?: boolean | null; submitted_at?: string | null; last_active_at?: string | null; updated_at?: string | null }>,
  telemetryEvents: Array<{ id: string; workspace_id: string; type: string; created_at?: string | null }>,
  webhookDeliveries: Array<{ id: string; workspace_id: string; status: string; created_at?: string | null }>,
  auditLog: Array<{ id: string; workspace_id: string | null; action: string; created_at?: string | null }>
) {
  return workspaces.map((workspace) => {
    const workspaceUsers = users.filter((user) => user.workspace_id === workspace.id)
    const workspaceSurveys = surveys.filter((survey) => survey.workspace_id === workspace.id)
    const workspaceResponses = responses.filter((response) => response.workspace_id === workspace.id)
    const workspaceTelemetry = telemetryEvents.filter((event) => event.workspace_id === workspace.id)
    const workspaceWebhooks = webhookDeliveries.filter((delivery) => delivery.workspace_id === workspace.id)
    const workspaceAudit = auditLog.filter((entry) => entry.workspace_id === workspace.id)
    const ownerEmails = workspaceUsers.filter((user) => user.role === "owner").map((user) => user.email)
    const responseDates = workspaceResponses
      .map((response) => response.submitted_at || response.last_active_at || response.updated_at)
      .filter(Boolean)
      .sort()
    const surveyUpdateDates = workspaceSurveys.map((survey) => survey.updated_at).filter(Boolean).sort()

    return {
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      slug: workspace.slug,
      planKey: workspace.plan_key,
      ownerEmails,
      userCount: workspaceUsers.length,
      surveyCount: workspaceSurveys.length,
      surveyStatusCounts: {
        published: workspaceSurveys.filter((survey) => survey.status === "published").length,
        draft: workspaceSurveys.filter((survey) => survey.status === "draft").length,
        testing: workspaceSurveys.filter((survey) => survey.status === "testing").length
      },
      responseCount: workspaceResponses.length,
      completedResponses: workspaceResponses.filter((response) => response.status === "completed").length,
      partialResponses: workspaceResponses.filter((response) => response.status === "partial").length,
      testResponses: workspaceResponses.filter((response) => response.is_test).length,
      officialResponses: workspaceResponses.filter((response) => !response.is_test).length,
      viewsCount: workspaceSurveys.reduce((sum, survey) => sum + (survey.views_count || 0), 0),
      telemetryCount: workspaceTelemetry.length,
      webhookDeliveries: workspaceWebhooks.length,
      webhookFailures: workspaceWebhooks.filter((delivery) => delivery.status && !["success", "sent", "ok"].includes(delivery.status)).length,
      auditEvents: workspaceAudit.length,
      lastResponseAt: responseDates.at(-1) || null,
      lastSurveyUpdateAt: surveyUpdateDates.at(-1) || null
    }
  })
}

async function buildDiagnostics(
  workspaces: Array<{ id: string; name: string; slug: string; plan_key: string }>,
  accessDefinitions: FeatureAccessDefinition[]
) {
  const roles = Object.keys(appConfig.roles)

  return Promise.all(
    workspaces.map(async (workspace) => {
      const entitlements = await resolveEntitlements(workspace.id, workspace.plan_key)
      const featureEntitlements = new Map(entitlements.features.map((feature) => [feature.key, feature.isEnabled]))

      const features = await Promise.all(
        accessDefinitions.map(async (definition) => {
          const flagStates = await Promise.all(
            definition.flags.map(async (flag) => ({
              key: flag,
              enabled: await getFeatureFlag(flag, workspace.id)
            }))
          )
          const entitlementEnabled = featureEntitlements.get(definition.entitlement) ?? false
          const permissionsByRole = Object.fromEntries(
            roles.map((role) => [
              role,
              definition.permissions.every((permission) => hasPermission(role, permission))
            ])
          )

          return {
            key: definition.key,
            label: definition.label,
            entitlement: {
              key: definition.entitlement,
              enabled: entitlementEnabled
            },
            flags: flagStates,
            permissionsByRole,
            enabledForOwners: entitlementEnabled && flagStates.every((flag) => flag.enabled) && Boolean(permissionsByRole.owner)
          }
        })
      )

      return {
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        planKey: workspace.plan_key,
        features
      }
    })
  )
}

async function runAdminAction(body: AdminAction, session: AppSession): Promise<{ error?: string; status?: number; warning?: string }> {
  const supabase = createServerSupabaseClient()

  if (body.action === "upsertFlag") {
    const { error } = await supabase.from("app_shell_feature_flags").upsert({
      flag_key: body.flagKey.trim(),
      enabled: body.enabled,
      description: body.description?.trim() || null,
      workspace_overrides: body.workspaceOverrides || {},
      updated_at: new Date().toISOString()
    })
    return error ? { error: error.message } : {}
  }

  if (body.action === "deleteFlag") {
    const { error } = await supabase.from("app_shell_feature_flags").delete().eq("flag_key", body.flagKey)
    return error ? { error: error.message } : {}
  }

  if (body.action === "setFlagWorkspaceOverride") {
    const { data, error: readError } = await supabase
      .from("app_shell_feature_flags")
      .select("workspace_overrides")
      .eq("flag_key", body.flagKey)
      .single()
    if (readError) return { error: readError.message }

    const overrides = { ...((data?.workspace_overrides as Record<string, boolean> | null) || {}) }
    if (body.enabled === null) {
      delete overrides[body.workspaceId]
    } else {
      overrides[body.workspaceId] = body.enabled
    }

    const { error } = await supabase
      .from("app_shell_feature_flags")
      .update({ workspace_overrides: overrides, updated_at: new Date().toISOString() })
      .eq("flag_key", body.flagKey)
    return error ? { error: error.message } : {}
  }

  if (body.action === "upsertFeatureRegistry") {
    const payload = {
      application_key: appConfig.product.applicationKey,
      feature_key: body.featureKey.trim(),
      feature_name: body.featureName.trim(),
      description: body.description?.trim() || null,
      category: body.category?.trim() || "General",
      display_order: body.displayOrder ?? 0,
      purchase_type: body.purchaseType || "plan_only",
      locked_behavior: body.lockedBehavior || "show_locked",
      associated_flags: Array.isArray(body.associatedFlags) ? body.associatedFlags : [],
      required_permissions: Array.isArray(body.requiredPermissions) ? body.requiredPermissions : [],
      is_active: body.isActive ?? true,
      updated_at: new Date().toISOString()
    }
    const { error } = body.id
      ? await supabase.from("app_shell_feature_registry").update(payload).eq("id", body.id).eq("application_key", appConfig.product.applicationKey)
      : await supabase.from("app_shell_feature_registry").upsert(payload, { onConflict: "application_key,feature_key" })
    return error ? { error: error.message } : {}
  }

  if (body.action === "deleteFeatureRegistry") {
    const { error } = await supabase
      .from("app_shell_feature_registry")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", body.id)
      .eq("application_key", appConfig.product.applicationKey)
    return error ? { error: error.message } : {}
  }

  if (body.action === "upsertLimitType") {
    const payload = {
      application_key: appConfig.product.applicationKey,
      limit_key: body.limitKey.trim(),
      limit_name: body.limitName.trim(),
      description: body.description?.trim() || null,
      category: body.category?.trim() || "General",
      unit: body.unit?.trim() || "count",
      unit_label: body.unitLabel?.trim() || null,
      display_order: body.displayOrder ?? 0,
      is_active: body.isActive ?? true,
      updated_at: new Date().toISOString()
    }
    const { error } = body.id
      ? await supabase.from("app_shell_limit_types").update(payload).eq("id", body.id).eq("application_key", appConfig.product.applicationKey)
      : await supabase.from("app_shell_limit_types").upsert(payload, { onConflict: "application_key,limit_key" })
    return error ? { error: error.message } : {}
  }

  if (body.action === "deleteLimitType") {
    const { error } = await supabase
      .from("app_shell_limit_types")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", body.id)
      .eq("application_key", appConfig.product.applicationKey)
    return error ? { error: error.message } : {}
  }

  if (body.action === "upsertPlan") {
    const { error } = await supabase.from("app_shell_plans").upsert({
      application_key: appConfig.product.applicationKey,
      plan_key: body.planKey.trim(),
      name: body.name.trim(),
      description: body.description?.trim() || null,
      status: body.status || (body.active === false ? "archived" : "active"),
      price_monthly: body.priceMonthly ?? null,
      price_yearly: body.priceYearly ?? null,
      currency: body.currency || "usd",
      display_order: body.displayOrder ?? 0,
      is_featured: body.isFeatured ?? false,
      badge_text: body.badgeText?.trim() || null,
      trial_days: body.trialDays ?? 0,
      active: body.active ?? body.status !== "archived",
      updated_at: new Date().toISOString()
    })
    if (error) return { error: error.message }
    return synchronizePlanCatalog(body.planKey.trim(), false)
  }

  if (body.action === "deletePlan") {
    const { error } = await supabase
      .from("app_shell_plans")
      .update({ status: "archived", active: false, updated_at: new Date().toISOString() })
      .eq("application_key", appConfig.product.applicationKey)
      .eq("plan_key", body.planKey)
    if (error) return { error: error.message }
    return synchronizePlanCatalog(body.planKey, false)
  }

  if (body.action === "createStripePlanSku" || body.action === "syncStripePlan") {
    return synchronizePlanCatalog(body.planKey, true)
  }

  if (body.action === "setPlanFeature") {
    const plan = await getPlanByKey(body.planKey)
    const { error } = await supabase.from("app_shell_plan_features").upsert({
      application_key: appConfig.product.applicationKey,
      plan_key: body.planKey,
      plan_id: plan?.id || null,
      feature_key: body.featureKey,
      feature_id: body.featureId || null,
      enabled: body.enabled,
      is_included: body.enabled,
      updated_at: new Date().toISOString()
    })
    return error ? { error: error.message } : {}
  }

  if (body.action === "deletePlanFeature") {
    const { error } = await supabase.from("app_shell_plan_features").delete().eq("application_key", appConfig.product.applicationKey).eq("plan_key", body.planKey).eq("feature_key", body.featureKey)
    return error ? { error: error.message } : {}
  }

  if (body.action === "setPlanLimit") {
    const plan = await getPlanByKey(body.planKey)
    const { error } = await supabase.from("app_shell_plan_limits").upsert({
      application_key: appConfig.product.applicationKey,
      plan_key: body.planKey,
      plan_id: plan?.id || null,
      limit_key: body.limitKey,
      limit_type_id: body.limitTypeId || null,
      limit_value: body.isUnlimited ? "unlimited" : body.limitValue,
      is_unlimited: body.isUnlimited || body.limitValue === "unlimited",
      overage_enabled: body.overageEnabled ?? false,
      overage_price: body.overageEnabled ? body.overagePrice ?? null : null,
      updated_at: new Date().toISOString()
    })
    return error ? { error: error.message } : {}
  }

  if (body.action === "deletePlanLimit") {
    const { error } = await supabase.from("app_shell_plan_limits").delete().eq("application_key", appConfig.product.applicationKey).eq("plan_key", body.planKey).eq("limit_key", body.limitKey)
    return error ? { error: error.message } : {}
  }

  if (body.action === "setWorkspacePlan") {
    const plan = body.planId ? { id: body.planId } : await getPlanByKey(body.planKey)
    const { error } = await supabase.from("app_shell_workspace_plans").upsert({
      application_key: appConfig.product.applicationKey,
      workspace_id: body.workspaceId,
      plan_id: plan?.id || null,
      plan_key: body.planKey,
      billing_cycle: body.billingCycle || "monthly",
      status: body.status || "active",
      updated_at: new Date().toISOString()
    }, { onConflict: "workspace_id" })
    if (error) return { error: error.message }
    const { error: workspaceError } = await supabase
      .from("app_shell_workspaces")
      .update({ plan_key: body.planKey })
      .eq("id", body.workspaceId)
      .eq("application_key", appConfig.product.applicationKey)
    if (workspaceError) return { error: workspaceError.message }
    return {}
  }

  if (body.action === "upsertWorkspaceOverride") {
    const payload = {
      workspace_id: body.workspaceId,
      target_type: body.targetType,
      target_key: body.targetKey,
      override_value: body.overrideValue,
      reason: body.reason?.trim() || null,
      active: body.active ?? true
    }
    const { error } = body.id
      ? await supabase.from("app_shell_workspace_overrides").update(payload).eq("id", body.id)
      : await supabase.from("app_shell_workspace_overrides").insert(payload)
    return error ? { error: error.message } : {}
  }

  if (body.action === "deleteWorkspaceOverride") {
    const { error } = await supabase.from("app_shell_workspace_overrides").delete().eq("id", body.id)
    return error ? { error: error.message } : {}
  }

  if (body.action === "updateUserRole") {
    if (!Object.prototype.hasOwnProperty.call(appConfig.roles, body.role)) return { error: "Unknown role", status: 400 }
    const { error } = await supabase
      .from("app_shell_workspace_users")
      .update({ role: body.role })
      .eq("id", body.userId)
      .eq("application_key", appConfig.product.applicationKey)
    return error ? { error: error.message } : {}
  }

  return { error: "Unknown action", status: 400 }
}

async function synchronizePlanCatalog(planKey: string, manual: boolean): Promise<{ error?: string; status?: number; warning?: string }> {
  const supabase = createServerSupabaseClient()
  const { data: plan, error: planError } = await supabase
    .from("app_shell_plans")
    .select("plan_key, name, description, status, active, price_monthly, price_yearly, currency, stripe_product_id, stripe_monthly_price_id, stripe_yearly_price_id")
    .eq("application_key", appConfig.product.applicationKey)
    .eq("plan_key", planKey)
    .maybeSingle()

  if (planError) return { error: planError.message }
  if (!plan) return { error: "Plan not found", status: 404 }

  const disposition = getPlanCatalogDisposition({
    planKey: plan.plan_key,
    status: plan.status,
    active: plan.active,
    monthlyAmount: plan.price_monthly,
    yearlyAmount: plan.price_yearly
  })
  const updateSyncState = async (values: Record<string, unknown>) => {
    const { error } = await supabase
      .from("app_shell_plans")
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq("application_key", appConfig.product.applicationKey)
      .eq("plan_key", planKey)
    return error
  }

  if (disposition === "not_applicable") {
    const error = await updateSyncState({ stripe_sync_status: "not_applicable", stripe_sync_error: null })
    return error ? { error: error.message } : {}
  }

  if (disposition === "pending") {
    const message = "Set a positive monthly or yearly price before synchronizing this paid plan with Stripe."
    const error = await updateSyncState({ stripe_sync_status: "pending", stripe_sync_error: message })
    if (error) return { error: error.message }
    return manual ? { error: message, status: 400 } : { warning: message }
  }

  try {
    if (disposition === "archive") {
      const hasStripeRecords = [plan.stripe_product_id, plan.stripe_monthly_price_id, plan.stripe_yearly_price_id]
        .some((id) => Boolean(id) && !id?.includes("_stub_"))
      if (hasStripeRecords) {
        await archivePlanStripeRecords({
          productId: plan.stripe_product_id,
          monthlyPriceId: plan.stripe_monthly_price_id,
          yearlyPriceId: plan.stripe_yearly_price_id
        })
      }
      const error = await updateSyncState({
        stripe_sync_status: "archived",
        stripe_sync_error: null,
        stripe_synced_at: new Date().toISOString()
      })
      return error ? { error: error.message } : {}
    }

    const stripeRecords = await createPlanStripeRecords({
      applicationKey: appConfig.product.applicationKey,
      planKey: plan.plan_key,
      name: plan.name,
      description: plan.description,
      currency: plan.currency || "usd",
      monthlyAmount: plan.price_monthly,
      yearlyAmount: plan.price_yearly,
      existingProductId: plan.stripe_product_id,
      existingMonthlyPriceId: plan.stripe_monthly_price_id,
      existingYearlyPriceId: plan.stripe_yearly_price_id
    })
    const error = await updateSyncState({
      stripe_product_id: stripeRecords.productId,
      stripe_monthly_price_id: stripeRecords.monthlyPriceId,
      stripe_yearly_price_id: stripeRecords.yearlyPriceId,
      stripe_sync_status: "synced",
      stripe_sync_error: null,
      stripe_synced_at: new Date().toISOString()
    })
    return error ? { error: error.message } : {}
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe catalog synchronization failed."
    console.error("Stripe catalog synchronization failed", { planKey, message })
    const stateError = await updateSyncState({ stripe_sync_status: "error", stripe_sync_error: message })
    if (stateError) return { error: `${message} The sync error could not be recorded: ${stateError.message}`, status: 502 }
    return manual ? { error: message, status: 502 } : { warning: `Plan saved locally. Stripe sync needs attention: ${message}` }
  }
}

async function getPlanByKey(planKey: string): Promise<{ id: string } | null> {
  const supabase = createServerSupabaseClient()
  const { data } = await supabase
    .from("app_shell_plans")
    .select("id")
    .eq("application_key", appConfig.product.applicationKey)
    .eq("plan_key", planKey)
    .maybeSingle()
  return data || null
}
