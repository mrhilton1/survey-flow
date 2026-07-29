import { NextResponse } from "next/server"
import { appConfig } from "@/config/app.config"
import { createAuthSupabaseClient, createServerSupabaseClient } from "@/lib/platform/supabase"

export async function POST(request: Request) {
  const form = await request.formData()
  const email = String(form.get("email") || "").toLowerCase()
  const password = String(form.get("password") || "")
  const authSupabase = createAuthSupabaseClient()
  const supabase = createServerSupabaseClient()
  const errorUrl = new URL(appConfig.auth.loginPath, request.url)

  const { data: authData, error: authError } = await authSupabase.auth.signInWithPassword({ email, password })

  if (authError) {
    errorUrl.searchParams.set("error", "Invalid email or password.")
    return NextResponse.redirect(errorUrl, { status: 303 })
  }

  let { data: user, error: userError } = await supabase
    .from("app_shell_workspace_users")
    .select("id")
    .eq("application_key", appConfig.product.applicationKey)
    .eq("auth_user_id", authData.user.id)
    .limit(1)
    .single()

  if (userError || !user?.id) {
    const { data: linkedUser, error: linkError } = await supabase
      .from("app_shell_workspace_users")
      .update({ auth_user_id: authData.user.id })
      .eq("application_key", appConfig.product.applicationKey)
      .eq("email", email)
      .select("id")
      .limit(1)
      .single()

    user = linkedUser

    if (!user?.id) {
      errorUrl.searchParams.set("error", "Your login works, but no SegPIE workspace is linked to this email.")
      return NextResponse.redirect(errorUrl, { status: 303 })
    }
  }

  const response = NextResponse.redirect(new URL(appConfig.auth.afterLoginPath, request.url), { status: 303 })

  response.cookies.set(appConfig.auth.sessionCookieName, user.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/"
  })

  return response
}
