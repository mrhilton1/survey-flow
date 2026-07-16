import { NextResponse } from "next/server"
import { appConfig } from "@/config/app.config"
import { getCurrentSession } from "@/lib/platform/auth"
import { resolveEntitlements } from "@/lib/platform/entitlements"
import { getFeatureAccessMatrix } from "@/lib/platform/feature-access"
import { getFeatureFlag } from "@/lib/platform/feature-flags"
import { hasPermission } from "@/lib/platform/permissions"
import { createServerSupabaseClient } from "@/lib/platform/supabase"
import type { AppSession, FeatureAccessDefinition } from "@/lib/platform/types"

type AdminAction =
  | { action: "upsertFlag"; flagKey: string; enabled: boolean; description?: string | null; workspaceOverrides?: Record<string, boolean> }
  | { action: "deleteFlag"; flagKey: string }
  | { action: "setFlagWorkspaceOverride"; flagKey: string; workspaceId: string; enabled: boolean | null }
  | { action: "upsertPlan"; planKey: string; name: string; active?: boolean; stripeMonthlyPriceId?: string | null; stripeYearlyPriceId?: string | null }
  | { action: "deletePlan"; planKey: string }
  | { action: "setPlanFeature"; planKey: string; featureKey: string; enabled: boolean }
  | { action: "deletePlanFeature"; planKey: string; featureKey: string }
  | { action: "setPlanLimit"; planKey: string; limitKey: string; limitValue: string }
  | { action: "deletePlanLimit"; planKey: string; limitKey: string }
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

  return NextResponse.json(await loadAccessAdminData(session))
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
    plansResult,
    planFeaturesResult,
    planLimitsResult,
    overridesResult
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
    supabase.from("app_shell_plans").select("plan_key, name, stripe_monthly_price_id, stripe_yearly_price_id, active").order("plan_key"),
    supabase.from("app_shell_plan_features").select("plan_key, feature_key, enabled").order("plan_key"),
    supabase.from("app_shell_plan_limits").select("plan_key, limit_key, limit_value").order("plan_key"),
    supabase.from("app_shell_workspace_overrides").select("id, workspace_id, target_type, target_key, override_value, reason, active, created_at").order("created_at", { ascending: false })
  ])

  const workspaces = workspacesResult.data || []
  const featureAccess = getFeatureAccessMatrix()

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
      users: usersResult.data || [],
      flags: flagsResult.data || [],
      plans: plansResult.data || [],
      planFeatures: planFeaturesResult.data || [],
      planLimits: planLimitsResult.data || [],
      overrides: overridesResult.data || []
    },
    diagnostics: await buildDiagnostics(workspaces, featureAccess)
  }
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

async function runAdminAction(body: AdminAction, session: AppSession): Promise<{ error?: string; status?: number }> {
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

  if (body.action === "upsertPlan") {
    const { error } = await supabase.from("app_shell_plans").upsert({
      plan_key: body.planKey.trim(),
      name: body.name.trim(),
      stripe_monthly_price_id: body.stripeMonthlyPriceId || null,
      stripe_yearly_price_id: body.stripeYearlyPriceId || null,
      active: body.active ?? true
    })
    return error ? { error: error.message } : {}
  }

  if (body.action === "deletePlan") {
    const { error } = await supabase.from("app_shell_plans").delete().eq("plan_key", body.planKey)
    return error ? { error: error.message } : {}
  }

  if (body.action === "setPlanFeature") {
    const { error } = await supabase.from("app_shell_plan_features").upsert({
      plan_key: body.planKey,
      feature_key: body.featureKey,
      enabled: body.enabled
    })
    return error ? { error: error.message } : {}
  }

  if (body.action === "deletePlanFeature") {
    const { error } = await supabase.from("app_shell_plan_features").delete().eq("plan_key", body.planKey).eq("feature_key", body.featureKey)
    return error ? { error: error.message } : {}
  }

  if (body.action === "setPlanLimit") {
    const { error } = await supabase.from("app_shell_plan_limits").upsert({
      plan_key: body.planKey,
      limit_key: body.limitKey,
      limit_value: body.limitValue
    })
    return error ? { error: error.message } : {}
  }

  if (body.action === "deletePlanLimit") {
    const { error } = await supabase.from("app_shell_plan_limits").delete().eq("plan_key", body.planKey).eq("limit_key", body.limitKey)
    return error ? { error: error.message } : {}
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
