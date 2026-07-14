import { NextResponse } from "next/server"
import { appConfig } from "@/config/app.config"
import { createServerSupabaseClient } from "@/lib/platform/supabase"

export async function POST(request: Request) {
  const form = await request.formData()
  const email = String(form.get("email") || "").toLowerCase()
  const supabase = createServerSupabaseClient()
  const { data: user } = await supabase.from("app_shell_workspace_users").select("id").eq("email", email).limit(1).single()
  const response = NextResponse.redirect(new URL(appConfig.auth.afterLoginPath, request.url), { status: 303 })

  if (user?.id) {
    response.cookies.set(appConfig.auth.sessionCookieName, user.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/"
    })
  }

  return response
}
