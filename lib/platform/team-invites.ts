import { appConfig } from "@/config/app.config"
import { createAuthSupabaseClient, createServerSupabaseClient } from "@/lib/platform/supabase"

export async function acceptTeamInvite(input: {
  token: string
  password: string
  displayName?: string
}) {
  const token = input.token.trim()
  const password = input.password
  if (!token || password.length < 8) return { error: "Invite token and an 8+ character password are required.", status: 400 }

  const supabase = createServerSupabaseClient()
  const { data: invite, error: inviteError } = await supabase
    .from("app_shell_invites")
    .select("id, workspace_id, email, role, accepted_at, expires_at, app_shell_workspaces(id, name, slug, plan_key)")
    .eq("token", token)
    .maybeSingle()

  if (inviteError) return { error: inviteError.message, status: 500 }
  if (!invite) return { error: "Invite not found.", status: 404 }
  if (invite.accepted_at) return { error: "Invite has already been accepted.", status: 409 }
  if (new Date(invite.expires_at).getTime() <= Date.now()) return { error: "Invite has expired.", status: 410 }

  const email = String(invite.email).toLowerCase()
  let authUserId: string | null = null
  const created = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: input.displayName ? { name: input.displayName.trim() } : undefined
  })

  if (created.data.user?.id) {
    authUserId = created.data.user.id
  } else {
    const authSupabase = createAuthSupabaseClient()
    const signedIn = await authSupabase.auth.signInWithPassword({ email, password })
    if (signedIn.error || !signedIn.data.user?.id) {
      return { error: "An account already exists for this email. Enter the existing account password to accept the invite.", status: 401 }
    }
    authUserId = signedIn.data.user.id
  }

  const { data: membership, error: membershipError } = await supabase
    .from("app_shell_workspace_users")
    .upsert({
      application_key: appConfig.product.applicationKey,
      auth_user_id: authUserId,
      workspace_id: invite.workspace_id,
      email,
      display_name: input.displayName?.trim() || null,
      role: invite.role
    }, { onConflict: "workspace_id,email" })
    .select("id")
    .single()

  if (membershipError || !membership?.id) return { error: membershipError?.message || "Unable to create workspace membership.", status: 500 }

  await supabase
    .from("app_shell_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id)

  await supabase.from("app_shell_audit_log").insert({
    workspace_id: invite.workspace_id,
    actor_user_id: membership.id,
    action: "team.invite.accept",
    metadata: {
      inviteId: invite.id,
      email,
      role: invite.role
    }
  })

  return { userId: membership.id, workspaceId: invite.workspace_id }
}

