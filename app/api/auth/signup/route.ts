import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { appConfig } from "@/config/app.config"
import { createServerSupabaseClient } from "@/lib/platform/supabase"

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
}

export async function POST(request: Request) {
  const form = await request.formData()
  const email = String(form.get("email") || "").toLowerCase()
  const workspaceName = String(form.get("workspaceName") || "New Workspace")
  const supabase = createServerSupabaseClient()

  const { data: workspace } = await supabase
    .from("app_shell_workspaces")
    .insert({ name: workspaceName, slug: slugify(workspaceName), plan_key: "free" })
    .select("id")
    .single()

  if (workspace?.id) {
    const { data: user } = await supabase
      .from("app_shell_workspace_users")
      .insert({ email, workspace_id: workspace.id, role: "owner" })
      .select("id")
      .single()

    if (user?.id) {
      const cookieStore = await cookies()
      cookieStore.set(appConfig.auth.sessionCookieName, user.id, { httpOnly: true, sameSite: "lax", path: "/" })
    }
  }

  redirect(appConfig.auth.afterLoginPath)
}
