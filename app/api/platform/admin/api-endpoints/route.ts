import { NextResponse } from "next/server"
import { appConfig } from "@/config/app.config"
import { getCurrentSession } from "@/lib/platform/auth"
import { createServerSupabaseClient } from "@/lib/platform/supabase"

interface UpdateEndpointBody {
  id?: string
  category?: string
  visibility?: "public" | "internal" | "admin_only"
  doc_status?: "documented" | "undocumented" | "draft"
}

export async function PATCH(request: Request) {
  const session = await getCurrentSession()
  if (!session.authenticated) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!session.isPlatformAdmin || !session.user) return NextResponse.json({ error: "Platform owner access is required." }, { status: 403 })

  const body = await request.json().catch(() => null) as UpdateEndpointBody | null
  if (!body?.id) return NextResponse.json({ error: "Endpoint id is required." }, { status: 400 })
  if (!body.category?.trim()) return NextResponse.json({ error: "Category is required." }, { status: 400 })
  if (!body.visibility || !["public", "internal", "admin_only"].includes(body.visibility)) return NextResponse.json({ error: "Valid visibility is required." }, { status: 400 })
  if (!body.doc_status || !["documented", "undocumented", "draft"].includes(body.doc_status)) return NextResponse.json({ error: "Valid docs status is required." }, { status: 400 })

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from("app_shell_api_endpoints")
    .update({
      category: body.category.trim(),
      visibility: body.visibility,
      doc_status: body.doc_status,
      updated_at: new Date().toISOString()
    })
    .eq("id", body.id)
    .eq("application_key", appConfig.product.applicationKey)
    .select("id, route_key, method, path, title, summary, category, visibility, doc_status, auth_type, request_schema, response_schema, display_order")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from("app_shell_audit_log").insert({
    workspace_id: session.workspace?.id || null,
    actor_user_id: session.user.id,
    action: "platform.api_endpoint.update",
    metadata: {
      endpointId: body.id,
      category: body.category.trim(),
      visibility: body.visibility,
      docStatus: body.doc_status
    }
  })

  return NextResponse.json({ endpoint: data })
}
