"use client"

import { Menu } from "lucide-react"
import { Logo } from "./logo"
import { SideMenu } from "./side-menu"
import type { AppSession, EntitlementSnapshot } from "@/lib/platform/types"

export function AppHeader({
  session,
  entitlements,
  title
}: {
  session: AppSession
  entitlements?: EntitlementSnapshot
  title?: string
}) {
  return (
    <header className="sticky top-0 z-40 w-full overflow-x-hidden border-b border-border/80 bg-white/85 shadow-sm shadow-slate-950/[0.03] backdrop-blur-xl">
      <div className="flex h-16 min-w-0 items-center justify-between px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <Logo />
          {title ? <span className="hidden text-sm text-muted-foreground sm:block">{title}</span> : null}
        </div>
        <SideMenu
          session={session}
          entitlements={entitlements}
          trigger={
            <button aria-label="Open navigation menu" className="rounded-xl border border-border bg-white p-2 shadow-sm transition hover:bg-muted">
              <Menu className="h-5 w-5" />
            </button>
          }
        />
      </div>
    </header>
  )
}
