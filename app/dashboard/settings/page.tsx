import { redirect } from "next/navigation"
import { WorkspaceSettingsConsole } from "@/components/platform/workspace-settings-console"
import { appConfig } from "@/config/app.config"
import { getCurrentSession } from "@/lib/platform/auth"
import { hasPermission } from "@/lib/platform/permissions"
import { createServerSupabaseClient } from "@/lib/platform/supabase"

export default async function SettingsPage() {
  const session = await getCurrentSession()
  if (!session.authenticated) redirect(appConfig.auth.loginPath)
  if (!session.workspace || !session.user) {
    return (
      <div className="mx-auto max-w-4xl rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <h1 className="text-xl font-semibold">Workspace required</h1>
        <p className="mt-2 text-sm">Choose a workspace before editing settings.</p>
      </div>
    )
  }

  const canEdit = session.isPlatformAdmin || hasPermission(session.user.role, "workspace:update")
  const supabase = createServerSupabaseClient()
  const { data: workspace, error } = await supabase
    .from("app_shell_workspaces")
    .select("name, logo_label, logo_url, logo_mark_url, theme_color, support_email")
    .eq("id", session.workspace.id)
    .eq("application_key", appConfig.product.applicationKey)
    .single()

  if (error) throw new Error(error.message)

  return (
    <WorkspaceSettingsConsole
      workspace={{
        name: workspace.name,
        logoLabel: workspace.logo_label,
        logoSrc: workspace.logo_url,
        logoMarkSrc: workspace.logo_mark_url,
        themeColor: workspace.theme_color,
        supportEmail: workspace.support_email
      }}
      canEdit={canEdit}
      isPlatformWorkspaceView={session.isImpersonating}
      fallbackLogoLabel={appConfig.product.logoLabel}
      fallbackLogoSrc={appConfig.product.logoSrc}
      fallbackLogoMarkSrc={appConfig.product.logoMarkSrc}
      fallbackThemeColor={appConfig.product.themeColor}
      fallbackSupportEmail={appConfig.product.supportEmail}
    />
  )
}
