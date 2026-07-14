import { NextResponse } from "next/server"
import { appConfig } from "@/config/app.config"
import { createServerSupabaseClient } from "@/lib/platform/supabase"

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
}

export async function POST(request: Request) {
  const form = await request.formData()
  const email = String(form.get("email") || "").toLowerCase()
  const password = String(form.get("password") || "")
  const workspaceName = String(form.get("workspaceName") || "New Workspace")
  const supabase = createServerSupabaseClient()
  const errorUrl = new URL(appConfig.auth.loginPath, request.url)
  const response = NextResponse.redirect(new URL(appConfig.auth.afterLoginPath, request.url), { status: 303 })

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  })

  if (authError || !authData.user?.id) {
    errorUrl.searchParams.set("error", authError?.message || "Unable to create auth user.")
    return NextResponse.redirect(errorUrl, { status: 303 })
  }

  const { data: workspace } = await supabase
    .from("app_shell_workspaces")
    .insert({
      application_key: appConfig.product.applicationKey,
      name: workspaceName,
      slug: slugify(workspaceName),
      plan_key: "free"
    })
    .select("id")
    .single()

  if (workspace?.id) {
    const { data: user } = await supabase
      .from("app_shell_workspace_users")
      .insert({
        application_key: appConfig.product.applicationKey,
        auth_user_id: authData.user.id,
        email,
        workspace_id: workspace.id,
        role: "owner"
      })
      .select("id")
      .single()

    if (user?.id) {
      response.cookies.set(appConfig.auth.sessionCookieName, user.id, {
        httpOnly: true,
        sameSite: "lax",
        secure: true,
        path: "/"
      })
    }
  }

  return response
}
