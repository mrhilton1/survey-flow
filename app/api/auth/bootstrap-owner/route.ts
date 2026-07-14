import { NextResponse } from "next/server"
import { appConfig } from "@/config/app.config"
import { getRuntimeEnv } from "@/lib/platform/env"
import { createServerSupabaseClient } from "@/lib/platform/supabase"

export async function POST(request: Request) {
  const expectedToken = getRuntimeEnv("SURVEYFLOW_BOOTSTRAP_TOKEN")
  const providedToken = request.headers.get("x-bootstrap-token")

  if (!expectedToken || providedToken !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const email = String(body?.email || "").toLowerCase()
  const password = String(body?.password || "")

  if (!email || password.length < 8) {
    return NextResponse.json({ error: "Email and an 8+ character password are required." }, { status: 400 })
  }

  if (!appConfig.platformAdmins.includes(email)) {
    return NextResponse.json({ error: "Email is not configured as a platform admin." }, { status: 403 })
  }

  const supabase = createServerSupabaseClient()
  const { data: workspaceUser, error: workspaceUserError } = await supabase
    .from("app_shell_workspace_users")
    .select("id, email, role")
    .eq("application_key", appConfig.product.applicationKey)
    .eq("email", email)
    .limit(1)
    .single()

  if (workspaceUserError || !workspaceUser) {
    return NextResponse.json({ error: "No app-shell workspace user exists for this email." }, { status: 404 })
  }

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  })

  if (!createError && created.user) {
    const { error: linkError } = await supabase
      .from("app_shell_workspace_users")
      .update({ auth_user_id: created.user.id })
      .eq("application_key", appConfig.product.applicationKey)
      .eq("email", email)

    if (linkError) {
      return NextResponse.json({ error: linkError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, action: "created", email })
  }

  const { data: users, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const existingUser = users?.users.find((user) => user.email?.toLowerCase() === email)

  if (listError || !existingUser) {
    return NextResponse.json({ error: createError?.message || listError?.message || "Unable to create auth user." }, { status: 500 })
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(existingUser.id, {
    password,
    email_confirm: true
  })

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  const { error: linkError } = await supabase
    .from("app_shell_workspace_users")
    .update({ auth_user_id: existingUser.id })
    .eq("application_key", appConfig.product.applicationKey)
    .eq("email", email)

  if (linkError) {
    return NextResponse.json({ error: linkError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, action: "updated", email })
}
