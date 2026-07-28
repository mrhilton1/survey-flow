import { redirect } from "next/navigation"
import { TeamConsole, type TeamInvite, type TeamMember, type TeamPermissions } from "@/components/platform/team-console"
import { appConfig } from "@/config/app.config"
import { getCurrentSession } from "@/lib/platform/auth"
import { resolveEntitlements } from "@/lib/platform/entitlements"
import { hasPermission } from "@/lib/platform/permissions"
import { createServerSupabaseClient } from "@/lib/platform/supabase"

export default async function TeamPage() {
  const session = await getCurrentSession()
  if (!session.authenticated) redirect(appConfig.auth.loginPath)
  if (!session.workspace || !session.user) {
    return (
      <div className="mx-auto max-w-4xl rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <h1 className="text-xl font-semibold">Workspace required</h1>
        <p className="mt-2 text-sm">Choose a workspace before managing team access.</p>
      </div>
    )
  }
  if (!session.isPlatformAdmin && !hasPermission(session.user.role, "team:read")) {
    return (
      <div className="mx-auto max-w-4xl rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <h1 className="text-xl font-semibold">Team access required</h1>
        <p className="mt-2 text-sm">Your role can’t view or manage team members for this workspace.</p>
      </div>
    )
  }

  const supabase = createServerSupabaseClient()
  const [{ data: members, error: membersError }, { data: invites, error: invitesError }, entitlements] = await Promise.all([
    supabase
      .from("app_shell_workspace_users")
      .select("id, email, display_name, role, created_at")
      .eq("application_key", appConfig.product.applicationKey)
      .eq("workspace_id", session.workspace.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("app_shell_invites")
      .select("id, email, role, token, accepted_at, expires_at, created_at")
      .eq("workspace_id", session.workspace.id)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
    resolveEntitlements(session.workspace.id, session.workspace.planKey)
  ])

  if (membersError || invitesError) {
    throw new Error(membersError?.message || invitesError?.message)
  }

  const seatLimit = entitlements.limits.find((limit) => limit.key === "team_members")?.value ?? "unlimited"
  const safeMembers = (members || []) as TeamMember[]
  const safeInvites = (invites || []) as TeamInvite[]
  const permissions: TeamPermissions = {
    canInvite: session.isPlatformAdmin || hasPermission(session.user.role, "team:invite"),
    canUpdateRoles: session.isPlatformAdmin || hasPermission(session.user.role, "team:update"),
    canRemoveMembers: session.isPlatformAdmin || hasPermission(session.user.role, "team:remove"),
    isPlatformAdmin: session.isPlatformAdmin,
    isPlatformWorkspaceView: session.isImpersonating
  }

  return (
    <TeamConsole
      initialMembers={safeMembers}
      initialInvites={safeInvites}
      roles={appConfig.roles}
      seatLimit={seatLimit}
      seatUsage={safeMembers.length + safeInvites.length}
      permissions={permissions}
    />
  )
}
