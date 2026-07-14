import { redirect } from "next/navigation"
import { AppFooter } from "@/components/shell/app-footer"
import { AppHeader } from "@/components/shell/app-header"
import { getCurrentSession } from "@/lib/platform/auth"
import { resolveEntitlements } from "@/lib/platform/entitlements"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession()
  if (!session.authenticated) redirect("/login")

  const entitlements = session.workspace
    ? await resolveEntitlements(session.workspace.id, session.workspace.planKey)
    : undefined

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <AppHeader session={session} entitlements={entitlements} />
      <main className="flex-1 px-4 py-6 sm:px-6">{children}</main>
      <AppFooter />
    </div>
  )
}
