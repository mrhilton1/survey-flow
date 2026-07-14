import { appConfig } from "@/config/app.config"
import { createServerSupabaseClient } from "./supabase"

export async function getFeatureFlag(flagKey: string, workspaceId?: string): Promise<boolean> {
  const envKey = `NEXT_PUBLIC_FLAG_${flagKey.toUpperCase()}`
  const envValue = process.env[envKey]
  if (envValue === "true") return true
  if (envValue === "false") return false

  const supabase = createServerSupabaseClient()
  const { data } = await supabase
    .from("app_shell_feature_flags")
    .select("enabled, workspace_overrides")
    .eq("flag_key", flagKey)
    .single()

  if (!data) return true

  const overrides = data.workspace_overrides as Record<string, boolean> | null
  if (workspaceId && overrides && workspaceId in overrides) {
    return overrides[workspaceId]
  }

  return data.enabled
}

export function defaultFeatureMap(): Record<string, boolean> {
  return Object.fromEntries(appConfig.features.map((feature) => [feature.key, feature.defaultEnabled]))
}
