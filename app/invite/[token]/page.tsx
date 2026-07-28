import { redirect } from "next/navigation"
import { appConfig } from "@/config/app.config"
import { createServerSupabaseClient } from "@/lib/platform/supabase"

export default async function InvitePage({
  params,
  searchParams
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { token } = await params
  const { error } = await searchParams
  const supabase = createServerSupabaseClient()
  const { data: invite } = await supabase
    .from("app_shell_invites")
    .select("id, email, role, accepted_at, expires_at, app_shell_workspaces(name)")
    .eq("token", token)
    .maybeSingle()

  if (!invite || invite.accepted_at || new Date(invite.expires_at).getTime() <= Date.now()) {
    redirect(`${appConfig.auth.loginPath}?error=Invite%20is%20invalid%20or%20expired.`)
  }

  const workspace = Array.isArray(invite.app_shell_workspaces) ? invite.app_shell_workspaces[0] : invite.app_shell_workspaces

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{appConfig.product.name}</p>
        <h1 className="mt-3 text-2xl font-semibold text-slate-950">Accept your invite</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Join {workspace?.name || "this workspace"} as {invite.role}. This invite is for {invite.email}.
        </p>
        {error ? <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{error}</div> : null}
        <form action="/api/auth/accept-invite" method="post" className="mt-6 space-y-4">
          <input type="hidden" name="token" value={token} />
          <div>
            <label className="text-sm font-semibold text-slate-700" htmlFor="displayName">Name</label>
            <input id="displayName" name="displayName" className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700" htmlFor="password">Password</label>
            <input id="password" name="password" type="password" minLength={8} required className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" />
            <p className="mt-2 text-xs leading-5 text-slate-500">Use a new password, or the password for your existing account with this email.</p>
          </div>
          <button type="submit" className="h-10 w-full rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white">Accept invite</button>
        </form>
      </section>
    </main>
  )
}
