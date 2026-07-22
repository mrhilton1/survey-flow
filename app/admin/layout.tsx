import { redirect } from "next/navigation"
import { AppFooter } from "@/components/shell/app-footer"
import { AppHeader } from "@/components/shell/app-header"
import { PlatformContextBanner } from "@/components/shell/platform-context-banner"
import { getCurrentSession } from "@/lib/platform/auth"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession()
  if (!session.authenticated) redirect("/login")
  if (!session.isPlatformAdmin) redirect("/dashboard")

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <AppHeader session={session} title="Platform Admin" />
      <PlatformContextBanner session={session} />
      <main className="flex-1 px-4 py-6 sm:px-6">{children}</main>
      <AppFooter />
    </div>
  )
}
