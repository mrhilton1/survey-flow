import { NextResponse } from "next/server"
import { appConfig } from "@/config/app.config"
import { getCurrentSession } from "@/lib/platform/auth"
import { hasPermission } from "@/lib/platform/permissions"
import { createServerSupabaseClient } from "@/lib/platform/supabase"

interface SettingsBody {
  name?: string
  logoLabel?: string
  themeColor?: string
  supportEmail?: string
}

export async function POST(request: Request) {
  const session = await getCurrentSession()
  if (!session.authenticated) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!session.workspace || !session.user) return NextResponse.json({ error: "Workspace context is required." }, { status: 400 })
  if (!session.isPlatformAdmin && !hasPermission(session.user.role, "workspace:update")) {
    return NextResponse.json({ error: "Workspace update permission is required." }, { status: 403 })
  }

  const body = await request.json().catch(() => null) as SettingsBody | null
  const values = normalizeSettings(body)
  if (values.error) return NextResponse.json({ error: values.error }, { status: 400 })

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from("app_shell_workspaces")
    .update({
      name: values.name,
      logo_label: values.logoLabel,
      theme_color: values.themeColor,
      support_email: values.supportEmail,
      updated_at: new Date().toISOString()
    })
    .eq("id", session.workspace.id)
    .eq("application_key", appConfig.product.applicationKey)
    .select("id, name, slug, plan_key, logo_label, theme_color, support_email")
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
      themeColor: data.theme_color,
      supportEmail: data.support_email
    }
  })
}

function normalizeSettings(body: SettingsBody | null): {
  name?: string
  logoLabel?: string | null
  themeColor?: string | null
  supportEmail?: string | null
  changedFields?: string[]
  error?: string
} {
  const name = body?.name?.trim() || ""
  const logoLabel = body?.logoLabel?.trim().toUpperCase() || ""
  const themeColor = body?.themeColor?.trim() || ""
  const supportEmail = body?.supportEmail?.trim().toLowerCase() || ""

  if (name.length < 2) return { error: "Workspace name must be at least 2 characters." }
  if (name.length > 80) return { error: "Workspace name must be 80 characters or fewer." }
  if (logoLabel && !/^[A-Z0-9]{1,4}$/.test(logoLabel)) return { error: "Logo label must be 1 to 4 letters or numbers." }
  if (themeColor && !/^#[0-9a-fA-F]{6}$/.test(themeColor)) return { error: "Theme color must be a hex value like #f27d26." }
  if (supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) return { error: "Support email must be a valid email address." }

  return {
    name,
    logoLabel: logoLabel || null,
    themeColor: themeColor || null,
    supportEmail: supportEmail || null,
    changedFields: ["name", "logoLabel", "themeColor", "supportEmail"]
  }
}
