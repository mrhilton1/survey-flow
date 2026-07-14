import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { appConfig } from "@/config/app.config"
import { createServerSupabaseClient } from "@/lib/platform/supabase"

export async function POST(request: Request) {
  const form = await request.formData()
  const email = String(form.get("email") || "").toLowerCase()
  const supabase = createServerSupabaseClient()
  const { data: user } = await supabase.from("app_shell_workspace_users").select("id").eq("email", email).limit(1).single()

  if (user?.id) {
    const cookieStore = await cookies()
    cookieStore.set(appConfig.auth.sessionCookieName, user.id, { httpOnly: true, sameSite: "lax", path: "/" })
  }

  redirect(appConfig.auth.afterLoginPath)
}
