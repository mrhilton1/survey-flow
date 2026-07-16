import { appConfig } from "@/config/app.config"
import { createServerSupabaseClient } from "./supabase"
import type { EntitlementSnapshot, FeatureDefinition, LimitDefinition } from "./types"

interface FeatureRegistryRow {
  id: string
  feature_key: string
  feature_name: string
  is_active: boolean
}

interface LimitTypeRow {
  id: string
  limit_key: string
  limit_name: string
  is_active: boolean
}

interface WorkspacePlanRow {
  plan_id: string | null
  plan_key: string
  status: string
}

interface PlanFeatureRow {
  feature_key: string | null
  feature_id: string | null
  enabled: boolean | null
  is_included: boolean | null
}

interface PlanLimitRow {
  limit_key: string | null
  limit_type_id: string | null
  limit_value: string | null
  is_unlimited: boolean | null
}

export async function resolveEntitlements(workspaceId: string, planKey = "free"): Promise<EntitlementSnapshot> {
  const supabase = createServerSupabaseClient()

  const [
    featureRegistryResult,
    limitTypesResult,
    workspacePlanResult,
    { data: overrides },
    { data: usageRows }
  ] = await Promise.all([
    supabase
      .from("app_shell_feature_registry")
      .select("id, feature_key, feature_name, is_active")
      .eq("application_key", appConfig.product.applicationKey)
      .eq("is_active", true)
      .order("display_order"),
    supabase
      .from("app_shell_limit_types")
      .select("id, limit_key, limit_name, is_active")
      .eq("application_key", appConfig.product.applicationKey)
      .eq("is_active", true)
      .order("display_order"),
    supabase
      .from("app_shell_workspace_plans")
      .select("plan_id, plan_key, status")
      .eq("application_key", appConfig.product.applicationKey)
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    supabase.from("app_shell_workspace_overrides").select("target_type, target_key, override_value").eq("workspace_id", workspaceId).eq("active", true),
    supabase.from("app_shell_usage_counters").select("counter_key, used_value").eq("workspace_id", workspaceId)
  ])

  const featureRegistry = mergeFeatureDefinitions((featureRegistryResult.data || []) as FeatureRegistryRow[])
  const limitTypes = mergeLimitDefinitions((limitTypesResult.data || []) as LimitTypeRow[])
  const workspacePlan = workspacePlanResult.data as WorkspacePlanRow | null
  const resolvedPlanKey = workspacePlan?.status === "active" ? workspacePlan.plan_key : planKey
  const resolvedPlanId = workspacePlan?.status === "active" ? workspacePlan.plan_id : null
  const { featureRows, limitRows } = await loadPlanRows(resolvedPlanKey, resolvedPlanId)

  const featureKeyById = new Map((featureRegistryResult.data || []).map((row) => [row.id, row.feature_key]))
  const limitKeyById = new Map((limitTypesResult.data || []).map((row) => [row.id, row.limit_key]))
  const featureByPlan = new Map<string, boolean>()
  const limitsByPlan = new Map<string, number | "unlimited">()

  for (const row of featureRows) {
    const key = row.feature_key || (row.feature_id ? featureKeyById.get(row.feature_id) : null)
    if (!key) continue
    featureByPlan.set(key, row.is_included ?? row.enabled ?? false)
  }

  for (const row of limitRows) {
    const key = row.limit_key || (row.limit_type_id ? limitKeyById.get(row.limit_type_id) : null)
    if (!key) continue
    limitsByPlan.set(key, row.is_unlimited ? "unlimited" : normalizeLimitValue(row.limit_value))
  }

  const usageByKey = new Map((usageRows || []).map((row) => [row.counter_key, row.used_value as number]))

  for (const override of overrides || []) {
    if (override.target_type === "feature") {
      featureByPlan.set(override.target_key, override.override_value === "true")
    }
    if (override.target_type === "limit") {
      limitsByPlan.set(override.target_key, normalizeLimitValue(override.override_value))
    }
  }

  return {
    planKey: resolvedPlanKey,
    features: featureRegistry.map((feature) => ({
      key: feature.key,
      label: feature.label,
      isEnabled: featureByPlan.get(feature.key) ?? feature.defaultEnabled,
      lockedBehavior: feature.lockedBehavior
    })),
    limits: limitTypes.map((limit) => ({
      key: limit.key,
      label: limit.label,
      value: limitsByPlan.get(limit.key) ?? limit.defaultValue,
      used: usageByKey.get(limit.key) ?? 0
    }))
  }
}

async function loadPlanRows(planKey: string, planId: string | null): Promise<{ featureRows: PlanFeatureRow[]; limitRows: PlanLimitRow[] }> {
  const supabase = createServerSupabaseClient()

  if (planId) {
    const [{ data: featureRows }, { data: limitRows }] = await Promise.all([
      supabase.from("app_shell_plan_features").select("feature_key, feature_id, enabled, is_included").eq("plan_id", planId),
      supabase.from("app_shell_plan_limits").select("limit_key, limit_type_id, limit_value, is_unlimited").eq("plan_id", planId)
    ])
    if ((featureRows || []).length > 0 || (limitRows || []).length > 0) {
      return { featureRows: (featureRows || []) as PlanFeatureRow[], limitRows: (limitRows || []) as PlanLimitRow[] }
    }
  }

  const [{ data: featureRows }, { data: limitRows }] = await Promise.all([
    supabase.from("app_shell_plan_features").select("feature_key, feature_id, enabled, is_included").eq("plan_key", planKey),
    supabase.from("app_shell_plan_limits").select("limit_key, limit_type_id, limit_value, is_unlimited").eq("plan_key", planKey)
  ])

  return { featureRows: (featureRows || []) as PlanFeatureRow[], limitRows: (limitRows || []) as PlanLimitRow[] }
}

function mergeFeatureDefinitions(rows: FeatureRegistryRow[]): FeatureDefinition[] {
  const byKey = new Map(appConfig.features.map((feature) => [feature.key, feature]))
  const merged = rows.map((row) => ({
    ...(byKey.get(row.feature_key) || { defaultEnabled: false, lockedBehavior: "show_locked" as const }),
    key: row.feature_key,
    label: row.feature_name
  }))
  for (const feature of appConfig.features) {
    if (!merged.some((row) => row.key === feature.key)) merged.push(feature)
  }
  return merged
}

function mergeLimitDefinitions(rows: LimitTypeRow[]): LimitDefinition[] {
  const byKey = new Map(appConfig.limits.map((limit) => [limit.key, limit]))
  const merged = rows.map((row) => ({
    ...(byKey.get(row.limit_key) || { defaultValue: 0 }),
    key: row.limit_key,
    label: row.limit_name
  }))
  for (const limit of appConfig.limits) {
    if (!merged.some((row) => row.key === limit.key)) merged.push(limit)
  }
  return merged
}

function normalizeLimitValue(value: string | number | null): number | "unlimited" {
  if (value === "unlimited") return "unlimited"
  if (typeof value === "number") return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
