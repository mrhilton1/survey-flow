import { NextResponse } from "next/server"
import { appConfig } from "@/config/app.config"
import { getCurrentSession } from "@/lib/platform/auth"
import { createServerSupabaseClient } from "@/lib/platform/supabase"
import { canUpdateWorkspaceSettings, normalizeWorkspaceSettings, type SettingsBody } from "@/lib/platform/workspace-guards"

export async function POST(request: Request) {
  const session = await getCurrentSession()
  if (!session.authenticated) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!session.workspace || !session.user) return NextResponse.json({ error: "Workspace context is required." }, { status: 400 })
  if (!canUpdateWorkspaceSettings(session)) {
    return NextResponse.json({ error: "Workspace update permission is required." }, { status: 403 })
  }

  const body = await request.json().catch(() => null) as SettingsBody | null
  const values = normalizeWorkspaceSettings(body)
  if (values.error) return NextResponse.json({ error: values.error }, { status: 400 })

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from("app_shell_workspaces")
    .update({
      name: values.name,
      logo_label: values.logoLabel,
      logo_url: values.logoSrc,
      logo_mark_url: values.logoMarkSrc,
      theme_color: values.themeColor,
      support_email: values.supportEmail,
      updated_at: new Date().toISOString()
    })
    .eq("id", session.workspace.id)
    .eq("application_key", appConfig.product.applicationKey)
    .select("id, name, slug, plan_key, logo_label, logo_url, logo_mark_url, theme_color, support_email")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from("app_shell_audit_log").insert({
    workspace_id: session.workspace.id,
    actor_user_id: session.user.id,
    action: "workspace.settings.update",
    metadata: {
      changedFields: values.changedFields,
      platformWorkspaceContext: session.platformWorkspaceContext,
      isPlatformAdmin: session.isPlatformAdmin
    }
  })

  return NextResponse.json({
    workspace: {
      id: data.id,
      name: data.name,
      slug: data.slug,
      planKey: data.plan_key,
      logoLabel: data.logo_label,
      logoSrc: data.logo_url,
      logoMarkSrc: data.logo_mark_url,
      themeColor: data.theme_color,
      supportEmail: data.support_email
    }
  })
}
