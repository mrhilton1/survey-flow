export type ScriptScope = "global" | "workspace"
export type ScriptPlacement = "head" | "body_start" | "body_end"
export type ScriptEnvironment = "all" | "production" | "development"
export type ScriptType = "inline" | "external"

export interface ScriptInput {
  name?: string
  description?: string | null
  scope?: ScriptScope
  workspace_id?: string | null
  placement?: ScriptPlacement
  environment?: ScriptEnvironment
  script_type?: ScriptType
  content?: string | null
  src_url?: string | null
  enabled?: boolean
  display_order?: number
}

export function normalizePlatformScript(input: ScriptInput | null) {
  const name = input?.name?.trim() || ""
  const scope = input?.scope || "global"
  const workspaceId = scope === "workspace" ? input?.workspace_id || null : null
  const placement = input?.placement || "body_end"
  const environment = input?.environment || "all"
  const scriptType = input?.script_type || "inline"
  const content = input?.content?.trim() || null
  const srcUrl = input?.src_url?.trim() || null

  if (name.length < 2) return { error: "Script name must be at least 2 characters." }
  if (!["global", "workspace"].includes(scope)) return { error: "Valid scope is required." }
  if (scope === "workspace" && !workspaceId) return { error: "Workspace scope requires a workspace." }
  if (!["head", "body_start", "body_end"].includes(placement)) return { error: "Valid placement is required." }
  if (!["all", "production", "development"].includes(environment)) return { error: "Valid environment is required." }
  if (!["inline", "external"].includes(scriptType)) return { error: "Valid script type is required." }
  if (scriptType === "inline" && !content) return { error: "Inline scripts require content." }
  if (scriptType === "external" && (!srcUrl || !/^https:\/\//.test(srcUrl))) return { error: "External scripts require an HTTPS URL." }

  return {
    name,
    description: input?.description?.trim() || null,
    scope,
    workspace_id: workspaceId,
    placement,
    environment,
    script_type: scriptType,
    content: scriptType === "inline" ? content : null,
    src_url: scriptType === "external" ? srcUrl : null,
    enabled: input?.enabled ?? true,
    display_order: Number.isFinite(input?.display_order) ? Number(input?.display_order) : 100
  }
}

