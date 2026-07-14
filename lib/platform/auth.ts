import { cookies } from "next/headers"
import { appConfig } from "@/config/app.config"
import { isPlatformAdminEmail } from "./permissions"
import { createServerSupabaseClient } from "./supabase"
import type { AppSession } from "./types"

export async function getCurrentSession(): Promise<AppSession> {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get(appConfig.auth.sessionCookieName)?.value
  if (!sessionId) {
    return emptySession()
  }

  const supabase = createServerSupabaseClient()
  const { data: user } = await supabase
    .from("app_shell_workspace_users")
    .select("id, email, display_name, role, workspace_id, app_shell_workspaces(id, name, slug, plan_key)")
    .eq("id", sessionId)
    .eq("application_key", appConfig.product.applicationKey)
    .single()

  if (!user) {
    return emptySession()
  }

  const workspaceRow = Array.isArray(user.app_shell_workspaces)
    ? user.app_shell_workspaces[0]
    : user.app_shell_workspaces

  return {
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.display_name,
      role: user.role
    },
    workspace: workspaceRow
      ? {
          id: workspaceRow.id,
          name: workspaceRow.name,
          slug: workspaceRow.slug,
          planKey: workspaceRow.plan_key
        }
      : null,
    isPlatformAdmin: isPlatformAdminEmail(user.email),
    isImpersonating: false
  }
}

export function emptySession(): AppSession {
  return {
    authenticated: false,
    user: null,
    workspace: null,
    isPlatformAdmin: false,
    isImpersonating: false
  }
}
