import { appConfig } from "@/config/app.config"
import { createServerSupabaseClient } from "./supabase"
import type { EntitlementSnapshot } from "./types"

export async function resolveEntitlements(workspaceId: string, planKey = "free"): Promise<EntitlementSnapshot> {
  const supabase = createServerSupabaseClient()

  const [
    { data: featureRows },
    { data: limitRows },
    { data: overrides },
    { data: usageRows }
  ] = await Promise.all([
    supabase.from("app_shell_plan_features").select("feature_key, enabled").eq("plan_key", planKey),
    supabase.from("app_shell_plan_limits").select("limit_key, limit_value").eq("plan_key", planKey),
    supabase.from("app_shell_workspace_overrides").select("target_type, target_key, override_value").eq("workspace_id", workspaceId).eq("active", true),
    supabase.from("app_shell_usage_counters").select("counter_key, used_value").eq("workspace_id", workspaceId)
  ])

  const featureByPlan = new Map((featureRows || []).map((row) => [row.feature_key, row.enabled]))
  const limitsByPlan = new Map((limitRows || []).map((row) => [row.limit_key, normalizeLimitValue(row.limit_value)]))
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
    planKey,
    features: appConfig.features.map((feature) => ({
      key: feature.key,
      label: feature.label,
      isEnabled: featureByPlan.get(feature.key) ?? feature.defaultEnabled,
      lockedBehavior: feature.lockedBehavior
    })),
    limits: appConfig.limits.map((limit) => ({
      key: limit.key,
      label: limit.label,
      value: limitsByPlan.get(limit.key) ?? limit.defaultValue,
      used: usageByKey.get(limit.key) ?? 0
    }))
  }
}

function normalizeLimitValue(value: string | number | null): number | "unlimited" {
  if (value === "unlimited") return "unlimited"
  if (typeof value === "number") return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
