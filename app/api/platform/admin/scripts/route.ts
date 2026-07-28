import { NextResponse } from "next/server"
import { appConfig } from "@/config/app.config"
import { getCurrentSession } from "@/lib/platform/auth"
import { normalizePlatformScript, type ScriptInput } from "@/lib/platform/script-logic"
import { createServerSupabaseClient } from "@/lib/platform/supabase"

export async function POST(request: Request) {
  const session = await getCurrentSession()
  if (!session.authenticated) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!session.isPlatformAdmin || !session.user) return NextResponse.json({ error: "Platform owner access is required." }, { status: 403 })

  const body = await request.json().catch(() => null) as (ScriptInput & { id?: string }) | null
  const values = normalizePlatformScript(body)
  if ("error" in values) return NextResponse.json({ error: values.error }, { status: 400 })

  const supabase = createServerSupabaseClient()
  if (values.workspace_id) {
    const { data: workspace, error: workspaceError } = await supabase
      .from("app_shell_workspaces")
      .select("id")
      .eq("id", values.workspace_id)
      .eq("application_key", appConfig.product.applicationKey)
      .maybeSingle()
    if (workspaceError) return NextResponse.json({ error: workspaceError.message }, { status: 500 })
    if (!workspace) return NextResponse.json({ error: "Workspace target not found." }, { status: 404 })
  }

  const payload = {
    application_key: appConfig.product.applicationKey,
    ...values,
    updated_by: session.user.id,
    updated_at: new Date().toISOString()
  }

  const { data, error } = body?.id
    ? await supabase.from("app_shell_scripts").update(payload).eq("id", body.id).eq("application_key", appConfig.product.applicationKey).select("*").single()
    : await supabase.from("app_shell_scripts").insert({ ...payload, created_by: session.user.id }).select("*").single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await supabase.from("app_shell_audit_log").insert({
    actor_user_id: session.user.id,
    workspace_id: values.workspace_id,
    action: "platform.script.upsert",
    metadata: { scriptId: data.id, name: values.name, scope: values.scope, placement: values.placement }
  })
  return NextResponse.json({ script: data })
}

export async function DELETE(request: Request) {
  const session = await getCurrentSession()
  if (!session.authenticated) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!session.isPlatformAdmin || !session.user) return NextResponse.json({ error: "Platform owner access is required." }, { status: 403 })

  const body = await request.json().catch(() => null) as { id?: string } | null
  if (!body?.id) return NextResponse.json({ error: "Script id is required." }, { status: 400 })

  const supabase = createServerSupabaseClient()
  const { data: existing } = await supabase.from("app_shell_scripts").select("id, workspace_id, name").eq("id", body.id).eq("application_key", appConfig.product.applicationKey).maybeSingle()
  const { error } = await supabase.from("app_shell_scripts").delete().eq("id", body.id).eq("application_key", appConfig.product.applicationKey)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await supabase.from("app_shell_audit_log").insert({
    actor_user_id: session.user.id,
    workspace_id: existing?.workspace_id || null,
    action: "platform.script.delete",
    metadata: { scriptId: body.id, name: existing?.name || null }
  })
  return NextResponse.json({ removed: body.id })
}

