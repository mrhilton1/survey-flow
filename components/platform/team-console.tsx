"use client"

import { useMemo, useState } from "react"
import { AlertCircle, Clock, Copy, Loader2, MailPlus, ShieldCheck, Trash2, UserMinus } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { EmailDeliveryStatus } from "@/lib/platform/email-logic"
import type { RoleDefinition } from "@/lib/platform/types"

export interface TeamMember {
  id: string
  email: string
  display_name: string | null
  role: string
  created_at: string
}

export interface TeamInvite {
  id: string
  email: string
  role: string
  token: string
  accepted_at: string | null
  expires_at: string
  created_at: string
}

export interface TeamPermissions {
  canInvite: boolean
  canUpdateRoles: boolean
  canRemoveMembers: boolean
  isPlatformAdmin: boolean
  isPlatformWorkspaceView: boolean
}

export function TeamConsole({
  initialMembers,
  initialInvites,
  roles,
  seatLimit,
  seatUsage,
  emailDelivery,
  permissions
}: {
  initialMembers: TeamMember[]
  initialInvites: TeamInvite[]
  roles: Record<string, RoleDefinition>
  seatLimit: number | "unlimited"
  seatUsage: number
  emailDelivery: EmailDeliveryStatus
  permissions: TeamPermissions
}) {
  const [members, setMembers] = useState(initialMembers)
  const [invites, setInvites] = useState(initialInvites)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState(defaultInviteRole(roles))
  const [loading, setLoading] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const currentSeatUsage = members.length + invites.length
  const seatsAvailable = seatLimit === "unlimited" || currentSeatUsage < seatLimit
  const roleEntries = useMemo(() => Object.entries(roles), [roles])

  async function mutate(action: string, body: Record<string, unknown>, success: string) {
    setLoading(action)
    setError(null)
    setNotice(null)
    const response = await fetch("/api/dashboard/team", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, ...body })
    })
    const payload = await response.json().catch(() => ({}))
    setLoading(null)
    if (!response.ok) {
      setError(payload.error || "Unable to update team.")
      return null
    }
    setNotice(success)
    return payload
  }

  async function invite() {
    const payload = await mutate("invite", { email, role }, "Invite saved.")
    if (!payload?.invite) return
    setInvites((current) => [payload.invite, ...current.filter((invite) => invite.id !== payload.invite.id)])
    if (payload.emailDelivery?.sent) {
      setNotice("Invite saved and emailed.")
    } else if (payload.emailDelivery?.warning) {
      setNotice(`Invite saved. ${payload.emailDelivery.warning}`)
    }
    setEmail("")
  }

  async function updateRole(memberId: string, nextRole: string) {
    const payload = await mutate(`role-${memberId}`, { memberId, role: nextRole, action: "updateRole" }, "Role updated.")
    if (!payload?.member) return
    setMembers((current) => current.map((member) => member.id === memberId ? payload.member : member))
  }

  async function removeMember(memberId: string) {
    const payload = await mutate(`remove-${memberId}`, { memberId, action: "removeMember" }, "Member removed.")
    if (!payload?.removed) return
    setMembers((current) => current.filter((member) => member.id !== memberId))
  }

  async function cancelInvite(inviteId: string) {
    const payload = await mutate(`cancel-${inviteId}`, { inviteId, action: "cancelInvite" }, "Invite canceled.")
    if (!payload?.removed) return
    setInvites((current) => current.filter((invite) => invite.id !== inviteId))
  }

  async function copyInvite(token: string) {
    const url = `${window.location.origin}/invite/${token}`
    await navigator.clipboard.writeText(url)
    setNotice("Invite link copied.")
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Team</h1>
          <p className="mt-2 text-slate-600">Invite teammates, assign roles, and keep workspace access scoped.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
          <p className="font-semibold text-slate-950">Seats</p>
          <p className={seatsAvailable ? "text-slate-600" : "text-amber-700"}>{currentSeatUsage} of {seatLimit === "unlimited" ? "unlimited" : seatLimit} used</p>
        </div>
      </div>

      {permissions.isPlatformWorkspaceView && (
        <Notice tone="warning">You are viewing this team through platform workspace context. Changes are permission-gated and written to the audit log.</Notice>
      )}
      {!emailDelivery.ready && permissions.canInvite ? (
        <Notice tone="warning">{emailDelivery.message}</Notice>
      ) : null}
      {notice && <Notice tone="success">{notice}</Notice>}
      {error && <Notice tone="warning">{error}</Notice>}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="grow">
            <label className="text-sm font-semibold text-slate-700" htmlFor="team-email">Invite by email</label>
            <input
              id="team-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="teammate@example.com"
              className="mt-2 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
              disabled={!permissions.canInvite}
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700" htmlFor="team-role">Role</label>
            <select
              id="team-role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              className="mt-2 h-10 min-w-40 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
              disabled={!permissions.canInvite}
            >
              {roleEntries.map(([roleKey, definition]) => (
                <option key={roleKey} value={roleKey}>{definition.label}</option>
              ))}
            </select>
          </div>
          <Button onClick={invite} disabled={!permissions.canInvite || !email || !seatsAvailable || Boolean(loading)}>
            {loading === "invite" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailPlus className="h-4 w-4" />}
            Invite
          </Button>
        </div>
        {!permissions.canInvite && <p className="mt-3 text-sm text-slate-500">Your role can view this team but cannot invite new users.</p>}
        {!seatsAvailable && <p className="mt-3 text-sm font-medium text-amber-700">Upgrade the workspace plan or remove a pending seat before inviting another teammate.</p>}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <h2 className="text-lg font-semibold text-slate-950">Members</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {members.map((member) => (
            <div key={member.id} className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-950">{member.display_name || member.email}</p>
                <p className="truncate text-sm text-slate-500">{member.email}</p>
              </div>
              <select
                value={member.role}
                onChange={(event) => updateRole(member.id, event.target.value)}
                disabled={!permissions.canUpdateRoles || loading === `role-${member.id}`}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
              >
                {roleEntries.map(([roleKey, definition]) => (
                  <option key={roleKey} value={roleKey}>{definition.label}</option>
                ))}
              </select>
              <Button variant="ghost" onClick={() => removeMember(member.id)} disabled={!permissions.canRemoveMembers || loading === `remove-${member.id}`}>
                {loading === `remove-${member.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}
                Remove
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <h2 className="text-lg font-semibold text-slate-950">Pending Invites</h2>
        </div>
        {invites.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">No pending invites.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {invites.map((invite) => (
              <div key={invite.id} className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_auto_auto_auto] md:items-center">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-950">{invite.email}</p>
                  <p className="flex items-center gap-1 text-sm text-slate-500"><Clock className="h-3.5 w-3.5" /> Expires {formatDate(invite.expires_at)}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">{roles[invite.role]?.label || invite.role}</span>
                <Button variant="secondary" onClick={() => copyInvite(invite.token)}>
                  <Copy className="h-4 w-4" />
                  Copy link
                </Button>
                <Button variant="ghost" onClick={() => cancelInvite(invite.id)} disabled={!permissions.canInvite || loading === `cancel-${invite.id}`}>
                  {loading === `cancel-${invite.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Cancel
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function Notice({ tone, children }: { tone: "success" | "warning"; children: React.ReactNode }) {
  return (
    <div className={`flex items-start gap-2 rounded-xl border p-4 text-sm ${tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
      {tone === "success" ? <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
      {children}
    </div>
  )
}

function defaultInviteRole(roles: Record<string, RoleDefinition>) {
  return roles.member ? "member" : Object.keys(roles)[0] || "member"
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value))
}
