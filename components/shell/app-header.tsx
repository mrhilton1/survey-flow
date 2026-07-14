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
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <Logo />
          {title ? <span className="hidden text-sm text-slate-400 sm:block">{title}</span> : null}
        </div>
        <SideMenu
          session={session}
          entitlements={entitlements}
          trigger={
            <button aria-label="Open navigation menu" className="rounded-md border border-slate-200 p-2 hover:bg-slate-50">
              <Menu className="h-5 w-5" />
            </button>
          }
        />
      </div>
    </header>
  )
}
