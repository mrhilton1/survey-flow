import { ScriptsAdminConsole } from "@/components/platform/scripts-admin-console"
import { appConfig } from "@/config/app.config"
import { createServerSupabaseClient } from "@/lib/platform/supabase"

export default async function ScriptsAdminPage() {
  const supabase = createServerSupabaseClient()
  const [{ data: scripts, error: scriptsError }, { data: workspaces, error: workspacesError }] = await Promise.all([
    supabase
      .from("app_shell_scripts")
      .select("id, name, description, scope, workspace_id, placement, environment, script_type, content, src_url, run_on_navigation, enabled, display_order")
      .eq("application_key", appConfig.product.applicationKey)
      .order("display_order", { ascending: true }),
    supabase
      .from("app_shell_workspaces")
      .select("id, name")
      .eq("application_key", appConfig.product.applicationKey)
      .order("name", { ascending: true })
  ])

  if (scriptsError || workspacesError) throw new Error(scriptsError?.message || workspacesError?.message)

  return <ScriptsAdminConsole initialScripts={scripts || []} workspaces={workspaces || []} />
}
