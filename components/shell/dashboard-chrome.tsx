"use client"

import { usePathname } from "next/navigation"
import { AppFooter } from "@/components/shell/app-footer"
import { AppHeader } from "@/components/shell/app-header"
import type { AppSession, EntitlementSnapshot } from "@/lib/platform/types"

export function DashboardChrome({
  children,
  session,
  entitlements
}: {
  children: React.ReactNode
  session: AppSession
  entitlements?: EntitlementSnapshot
}) {
  const pathname = usePathname()
  const isWorkspaceEditor = /^\/dashboard\/surveys\/[^/]+\/edit$/.test(pathname)

  if (isWorkspaceEditor) {
    return <div className="min-h-screen bg-background">{children}</div>
  }

  return (
    <div className="flex min-h-screen min-w-0 flex-col overflow-x-hidden bg-background">
      <AppHeader session={session} entitlements={entitlements} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:py-10">{children}</main>
      <AppFooter workspace={session.workspace} />
    </div>
  )
}
