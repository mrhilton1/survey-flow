import { redirect } from "next/navigation"
import { DashboardChrome } from "@/components/shell/dashboard-chrome"
import { getCurrentSession } from "@/lib/platform/auth"
import { resolveEntitlements } from "@/lib/platform/entitlements"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession()
  if (!session.authenticated) redirect("/login")

  const entitlements = session.workspace
    ? await resolveEntitlements(session.workspace.id, session.workspace.planKey)
    : undefined

  return (
    <DashboardChrome session={session} entitlements={entitlements}>
      {children}
    </DashboardChrome>
  )
}
