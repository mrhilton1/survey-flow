import { NextResponse } from "next/server"
import { appConfig } from "@/config/app.config"
import { getCurrentSession } from "@/lib/platform/auth"
import { resolveEntitlements } from "@/lib/platform/entitlements"
import { hasPermission } from "@/lib/platform/permissions"
import { createServerSupabaseClient } from "@/lib/platform/supabase"

interface TeamActionBody {
  action?: "invite" | "updateRole" | "removeMember" | "cancelInvite"
  email?: string
  role?: string
  memberId?: string
  inviteId?: string
}

const INVITE_DAYS = 14

export async function GET() {
  const session = await getCurrentSession()
  if (!session.authenticated) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!session.workspace || !session.user) return NextResponse.json({ error: "Workspace context is required." }, { status: 400 })
  if (!canReadTeam(session)) return NextResponse.json({ error: "Team access is required." }, { status: 403 })

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
      .order("created_at", { ascending: false }),
    resolveEntitlements(session.workspace.id, session.workspace.planKey)
  ])

  if (membersError || invitesError) {
    return NextResponse.json({ error: membersError?.message || invitesError?.message }, { status: 500 })
  }

  const teamLimit = entitlements.limits.find((limit) => limit.key === "team_members")
  const activeMembers = members || []
  const pendingInvites = (invites || []).filter((invite) => !isExpired(invite.expires_at))
  const seatLimit = teamLimit?.value ?? "unlimited"

  return NextResponse.json({
    members: activeMembers,
    invites: pendingInvites,
    roles: appConfig.roles,
    seatLimit,
    seatUsage: activeMembers.length + pendingInvites.length,
    permissions: {
      canInvite: canInviteTeam(session),
      canUpdateRoles: canUpdateTeam(session),
      canRemoveMembers: canRemoveTeam(session),
      isPlatformAdmin: session.isPlatformAdmin,
      isPlatformWorkspaceView: session.isImpersonating
    }
  })
}

export async function POST(request: Request) {
  const session = await getCurrentSession()
  if (!session.authenticated) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!session.workspace || !session.user) return NextResponse.json({ error: "Workspace context is required." }, { status: 400 })

  const body = await request.json().catch(() => null) as TeamActionBody | null
  if (!body?.action) return NextResponse.json({ error: "Action is required." }, { status: 400 })

  if (body.action === "invite") return inviteMember(session, body)
  if (body.action === "updateRole") return updateRole(session, body)
  if (body.action === "removeMember") return removeMember(session, body)
  if (body.action === "cancelInvite") return cancelInvite(session, body)

  return NextResponse.json({ error: "Unknown action." }, { status: 400 })
}

async function inviteMember(session: Awaited<ReturnType<typeof getCurrentSession>>, body: TeamActionBody) {
  if (!canInviteTeam(session)) return NextResponse.json({ error: "Invite permission is required." }, { status: 403 })
  const email = normalizeEmail(body.email)
  if (!email) return NextResponse.json({ error: "A valid email is required." }, { status: 400 })
  if (!body.role || !Object.prototype.hasOwnProperty.call(appConfig.roles, body.role)) {
    return NextResponse.json({ error: "A valid role is required." }, { status: 400 })
  }
  if (body.role === "owner" && !canUpdateTeam(session)) {
    return NextResponse.json({ error: "Only team managers can invite another owner." }, { status: 403 })
  }

  const supabase = createServerSupabaseClient()
  const workspaceId = session.workspace!.id
  const [{ data: existingMember, error: memberError }, { data: existingInvite, error: inviteError }] = await Promise.all([
    supabase
      .from("app_shell_workspace_users")
      .select("id")
      .eq("application_key", appConfig.product.applicationKey)
      .eq("workspace_id", workspaceId)
      .eq("email", email)
      .maybeSingle(),
    supabase
      .from("app_shell_invites")
      .select("id, expires_at")
      .eq("workspace_id", workspaceId)
      .eq("email", email)
      .is("accepted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ])

  if (memberError || inviteError) return NextResponse.json({ error: memberError?.message || inviteError?.message }, { status: 500 })
  if (existingMember) return NextResponse.json({ error: "That email is already a team member." }, { status: 409 })

  const limitCheck = await checkSeatLimit(workspaceId, session.workspace!.planKey, existingInvite && !isExpired(existingInvite.expires_at) ? 0 : 1)
  if (!limitCheck.allowed) return NextResponse.json({ error: limitCheck.error }, { status: 403 })

  const expiresAt = new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const payload = { email, role: body.role, token: crypto.randomUUID(), expires_at: expiresAt, accepted_at: null }
  const { data, error } = existingInvite
    ? await supabase.from("app_shell_invites").update(payload).eq("id", existingInvite.id).select("id, email, role, token, accepted_at, expires_at, created_at").single()
    : await supabase.from("app_shell_invites").insert({ workspace_id: workspaceId, ...payload }).select("id, email, role, token, accepted_at, expires_at, created_at").single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await writeAudit("team.invite.upsert", session, { inviteId: data.id, email, role: body.role })
  return NextResponse.json({ invite: data })
}

async function updateRole(session: Awaited<ReturnType<typeof getCurrentSession>>, body: TeamActionBody) {
  if (!canUpdateTeam(session)) return NextResponse.json({ error: "Role update permission is required." }, { status: 403 })
  if (!body.memberId || !body.role || !Object.prototype.hasOwnProperty.call(appConfig.roles, body.role)) {
    return NextResponse.json({ error: "A valid member and role are required." }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const workspaceId = session.workspace!.id
  const { data: target, error: targetError } = await supabase
    .from("app_shell_workspace_users")
    .select("id, email, role")
    .eq("id", body.memberId)
    .eq("application_key", appConfig.product.applicationKey)
    .eq("workspace_id", workspaceId)
    .maybeSingle()

  if (targetError) return NextResponse.json({ error: targetError.message }, { status: 500 })
  if (!target) return NextResponse.json({ error: "Team member not found." }, { status: 404 })

  if (target.role === "owner" && body.role !== "owner") {
    const ownerCheck = await canChangeOwner(workspaceId, target.id)
    if (!ownerCheck.allowed) return NextResponse.json({ error: ownerCheck.error }, { status: 403 })
  }

  const { data, error } = await supabase
    .from("app_shell_workspace_users")
    .update({ role: body.role })
    .eq("id", target.id)
    .eq("application_key", appConfig.product.applicationKey)
    .eq("workspace_id", workspaceId)
    .select("id, email, display_name, role, created_at")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await writeAudit("team.member.role_update", session, { memberId: target.id, email: target.email, previousRole: target.role, role: body.role })
  return NextResponse.json({ member: data })
}

async function removeMember(session: Awaited<ReturnType<typeof getCurrentSession>>, body: TeamActionBody) {
  if (!canRemoveTeam(session)) return NextResponse.json({ error: "Remove permission is required." }, { status: 403 })
  if (!body.memberId) return NextResponse.json({ error: "A valid member is required." }, { status: 400 })

  const supabase = createServerSupabaseClient()
  const workspaceId = session.workspace!.id
  const { data: target, error: targetError } = await supabase
    .from("app_shell_workspace_users")
    .select("id, email, role")
    .eq("id", body.memberId)
    .eq("application_key", appConfig.product.applicationKey)
    .eq("workspace_id", workspaceId)
    .maybeSingle()

  if (targetError) return NextResponse.json({ error: targetError.message }, { status: 500 })
  if (!target) return NextResponse.json({ error: "Team member not found." }, { status: 404 })

  if (target.role === "owner") {
    const ownerCheck = await canChangeOwner(workspaceId, target.id)
    if (!ownerCheck.allowed) return NextResponse.json({ error: ownerCheck.error }, { status: 403 })
  }

  const { error } = await supabase
    .from("app_shell_workspace_users")
    .delete()
    .eq("id", target.id)
    .eq("application_key", appConfig.product.applicationKey)
    .eq("workspace_id", workspaceId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await writeAudit("team.member.remove", session, { memberId: target.id, email: target.email, role: target.role })
  return NextResponse.json({ removed: target.id })
}

async function cancelInvite(session: Awaited<ReturnType<typeof getCurrentSession>>, body: TeamActionBody) {
  if (!canInviteTeam(session)) return NextResponse.json({ error: "Invite permission is required." }, { status: 403 })
  if (!body.inviteId) return NextResponse.json({ error: "A valid invite is required." }, { status: 400 })

  const supabase = createServerSupabaseClient()
  const { data: target, error: targetError } = await supabase
    .from("app_shell_invites")
    .select("id, email, role")
    .eq("id", body.inviteId)
    .eq("workspace_id", session.workspace!.id)
    .is("accepted_at", null)
    .maybeSingle()

  if (targetError) return NextResponse.json({ error: targetError.message }, { status: 500 })
  if (!target) return NextResponse.json({ error: "Invite not found." }, { status: 404 })

  const { error } = await supabase.from("app_shell_invites").delete().eq("id", target.id).eq("workspace_id", session.workspace!.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await writeAudit("team.invite.cancel", session, { inviteId: target.id, email: target.email, role: target.role })
  return NextResponse.json({ removed: target.id })
}

async function checkSeatLimit(workspaceId: string, planKey: string, additionalSeats: number) {
  const supabase = createServerSupabaseClient()
  const [entitlements, { count: memberCount, error: memberError }, { count: inviteCount, error: inviteError }] = await Promise.all([
    resolveEntitlements(workspaceId, planKey),
    supabase
      .from("app_shell_workspace_users")
      .select("id", { count: "exact", head: true })
      .eq("application_key", appConfig.product.applicationKey)
      .eq("workspace_id", workspaceId),
    supabase
      .from("app_shell_invites")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
  ])
  if (memberError || inviteError) return { allowed: false, error: memberError?.message || inviteError?.message || "Unable to check team limit." }
  const limit = entitlements.limits.find((item) => item.key === "team_members")?.value ?? "unlimited"
  if (limit === "unlimited") return { allowed: true }
  const projected = (memberCount || 0) + (inviteCount || 0) + additionalSeats
  return projected <= limit
    ? { allowed: true }
    : { allowed: false, error: `This workspace has ${projected} team seats queued, but the active plan allows ${limit}.` }
}

async function canChangeOwner(workspaceId: string, targetMemberId: string) {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from("app_shell_workspace_users")
    .select("id")
    .eq("application_key", appConfig.product.applicationKey)
    .eq("workspace_id", workspaceId)
    .eq("role", "owner")

  if (error) return { allowed: false, error: error.message }
  const otherOwners = (data || []).filter((owner) => owner.id !== targetMemberId)
  return otherOwners.length > 0
    ? { allowed: true }
    : { allowed: false, error: "A workspace must keep at least one owner." }
}

async function writeAudit(action: string, session: Awaited<ReturnType<typeof getCurrentSession>>, metadata: Record<string, unknown>) {
  const supabase = createServerSupabaseClient()
  await supabase.from("app_shell_audit_log").insert({
    workspace_id: session.workspace?.id || null,
    actor_user_id: session.user?.id || null,
    action,
    metadata: {
      ...metadata,
      platformWorkspaceContext: session.platformWorkspaceContext,
      isPlatformAdmin: session.isPlatformAdmin
    }
  })
}

function normalizeEmail(value?: string) {
  const email = value?.trim().toLowerCase() || ""
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ""
}

function isExpired(value: string) {
  return new Date(value).getTime() <= Date.now()
}

function canReadTeam(session: Awaited<ReturnType<typeof getCurrentSession>>) {
  return session.isPlatformAdmin || hasPermission(session.user?.role || "member", "team:read")
}

function canInviteTeam(session: Awaited<ReturnType<typeof getCurrentSession>>) {
  return session.isPlatformAdmin || hasPermission(session.user?.role || "member", "team:invite")
}

function canUpdateTeam(session: Awaited<ReturnType<typeof getCurrentSession>>) {
  return session.isPlatformAdmin || hasPermission(session.user?.role || "member", "team:update")
}

function canRemoveTeam(session: Awaited<ReturnType<typeof getCurrentSession>>) {
  return session.isPlatformAdmin || hasPermission(session.user?.role || "member", "team:remove")
}
