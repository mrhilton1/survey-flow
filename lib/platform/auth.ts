import { cookies } from "next/headers"
import { appConfig } from "@/config/app.config"
import { isPlatformAdminEmail } from "./permissions"
import { createServerSupabaseClient } from "./supabase"
import type { AppSession } from "./types"

export const PLATFORM_WORKSPACE_CONTEXT_COOKIE = `${appConfig.product.applicationKey}.platformWorkspaceId`

export async function getCurrentSession(): Promise<AppSession> {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get(appConfig.auth.sessionCookieName)?.value
  if (!sessionId) {
    return emptySession()
  }

  const supabase = createServerSupabaseClient()
  const { data: user } = await supabase
    .from("app_shell_workspace_users")
    .select("id, email, display_name, role, workspace_id, app_shell_workspaces(id, name, slug, plan_key, logo_label, logo_url, logo_mark_url, theme_color, support_email)")
    .eq("id", sessionId)
    .eq("application_key", appConfig.product.applicationKey)
    .single()

  if (!user) {
    return emptySession()
  }

  const workspaceRow = Array.isArray(user.app_shell_workspaces)
    ? user.app_shell_workspaces[0]
    : user.app_shell_workspaces
  const isPlatformAdmin = isPlatformAdminEmail(user.email)
  const baseWorkspace = workspaceRow
    ? {
        id: workspaceRow.id,
        name: workspaceRow.name,
        slug: workspaceRow.slug,
        planKey: workspaceRow.plan_key,
        logoLabel: workspaceRow.logo_label,
        logoSrc: workspaceRow.logo_url,
        logoMarkSrc: workspaceRow.logo_mark_url,
        themeColor: workspaceRow.theme_color,
        supportEmail: workspaceRow.support_email
      }
    : null
  const contextWorkspaceId = cookieStore.get(PLATFORM_WORKSPACE_CONTEXT_COOKIE)?.value

  if (isPlatformAdmin && contextWorkspaceId && contextWorkspaceId !== baseWorkspace?.id) {
    const { data: contextWorkspace } = await supabase
      .from("app_shell_workspaces")
      .select("id, name, slug, plan_key, logo_label, logo_url, logo_mark_url, theme_color, support_email")
      .eq("id", contextWorkspaceId)
      .eq("application_key", appConfig.product.applicationKey)
      .single()

    if (contextWorkspace) {
      return {
        authenticated: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.display_name,
          role: user.role
        },
        workspace: {
          id: contextWorkspace.id,
          name: contextWorkspace.name,
          slug: contextWorkspace.slug,
          planKey: contextWorkspace.plan_key,
          logoLabel: contextWorkspace.logo_label,
          logoSrc: contextWorkspace.logo_url,
          logoMarkSrc: contextWorkspace.logo_mark_url,
          themeColor: contextWorkspace.theme_color,
          supportEmail: contextWorkspace.support_email
        },
        isPlatformAdmin,
        isImpersonating: true,
        platformWorkspaceContext: {
          workspaceId: contextWorkspace.id,
          workspaceName: contextWorkspace.name,
          workspaceSlug: contextWorkspace.slug,
          planKey: contextWorkspace.plan_key,
          originalWorkspaceId: baseWorkspace?.id || null,
          originalWorkspaceName: baseWorkspace?.name || null
        }
      }
    }
  }

  return {
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.display_name,
      role: user.role
    },
    workspace: baseWorkspace,
    isPlatformAdmin,
    isImpersonating: false,
    platformWorkspaceContext: null
  }
}

export function emptySession(): AppSession {
  return {
    authenticated: false,
    user: null,
    workspace: null,
    isPlatformAdmin: false,
    isImpersonating: false,
    platformWorkspaceContext: null
  }
}
