import { NextResponse } from "next/server"
import { appConfig } from "@/config/app.config"
import { getCurrentSession, PLATFORM_WORKSPACE_CONTEXT_COOKIE } from "@/lib/platform/auth"
import { createServerSupabaseClient } from "@/lib/platform/supabase"

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 8

export async function GET() {
  const session = await getCurrentSession()
  if (!session.authenticated) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!session.isPlatformAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  return NextResponse.json({ context: session.platformWorkspaceContext })
}

export async function POST(request: Request) {
  const session = await getCurrentSession()
  if (!session.authenticated) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!session.isPlatformAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = (await request.json().catch(() => null)) as { workspaceId?: string } | null
  if (!body?.workspaceId) {
    return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const { data: workspace, error } = await supabase
    .from("app_shell_workspaces")
    .select("id, name, slug, plan_key")
    .eq("id", body.workspaceId)
    .eq("application_key", appConfig.product.applicationKey)
    .single()

  if (error || !workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
  }

  await supabase.from("app_shell_audit_log").insert({
    actor_user_id: session.user?.id || null,
    workspace_id: workspace.id,
    action: "platform.workspace_context.start",
    metadata: {
      targetWorkspaceId: workspace.id,
      targetWorkspaceName: workspace.name,
      originalWorkspaceId: session.workspace?.id || null,
      actorEmail: session.user?.email || null
    }
  })

  const response = NextResponse.json({ context: workspace })
  response.cookies.set(PLATFORM_WORKSPACE_CONTEXT_COOKIE, workspace.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE_SECONDS,
    path: "/"
  })
  return response
}

export async function DELETE() {
  const session = await getCurrentSession()
  if (!session.authenticated) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!session.isPlatformAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const supabase = createServerSupabaseClient()
  await supabase.from("app_shell_audit_log").insert({
    actor_user_id: session.user?.id || null,
    workspace_id: session.platformWorkspaceContext?.workspaceId || session.workspace?.id || null,
    action: "platform.workspace_context.end",
    metadata: {
      targetWorkspaceId: session.platformWorkspaceContext?.workspaceId || null,
      originalWorkspaceId: session.platformWorkspaceContext?.originalWorkspaceId || null,
      actorEmail: session.user?.email || null
    }
  })

  const response = NextResponse.json({ ok: true })
  response.cookies.delete(PLATFORM_WORKSPACE_CONTEXT_COOKIE)
  return response
}
