import Script from "next/script"
import { appConfig } from "@/config/app.config"
import { normalizeInlineScriptContent } from "@/lib/platform/script-logic"
import { createServerSupabaseClient } from "@/lib/platform/supabase"

export type PlatformScriptPlacement = "head" | "body_start" | "body_end"
export type PlatformScriptScope = "global" | "workspace"
export type PlatformScriptEnvironment = "all" | "production" | "development"

export interface PlatformScript {
  id: string
  name: string
  scope: PlatformScriptScope
  workspace_id: string | null
  placement: PlatformScriptPlacement
  environment: PlatformScriptEnvironment
  script_type: "inline" | "external"
  content: string | null
  src_url: string | null
  run_on_navigation: boolean
  enabled: boolean
  display_order: number
}

export async function listRenderableScripts(input: { workspaceId?: string | null; placement?: PlatformScriptPlacement } = {}) {
  const supabase = createServerSupabaseClient()
  let query = supabase
    .from("app_shell_scripts")
    .select("id, name, scope, workspace_id, placement, environment, script_type, content, src_url, run_on_navigation, enabled, display_order")
    .eq("application_key", appConfig.product.applicationKey)
    .eq("enabled", true)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true })

  if (input.placement) query = query.eq("placement", input.placement)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const env = process.env.NODE_ENV === "production" ? "production" : "development"
  return ((data || []) as PlatformScript[]).filter((script) => {
    const environmentMatches = script.environment === "all" || script.environment === env
    const scopeMatches = script.scope === "global" || (input.workspaceId && script.workspace_id === input.workspaceId)
    return environmentMatches && scopeMatches
  })
}

export function getNavigationScripts(scripts: PlatformScript[]) {
  return scripts
    .filter((script) => script.script_type === "inline" && script.content && script.run_on_navigation)
    .map((script) => ({ id: script.id, content: normalizeInlineScriptContent(script.content) }))
}

export function renderPlatformScripts(scripts: PlatformScript[]) {
  return scripts.map((script) => {
    if (script.script_type === "external" && script.src_url) {
      return <Script key={script.id} src={script.src_url} strategy="afterInteractive" />
    }
    if (script.script_type === "inline" && script.content) {
      return <Script key={script.id} id={`platform-script-${script.id}`} strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: normalizeInlineScriptContent(script.content) }} />
    }
    return null
  })
}
