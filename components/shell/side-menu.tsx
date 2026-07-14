"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Lock, LogOut, X } from "lucide-react"
import { useMemo, useState } from "react"
import { resolveNavItems } from "@/lib/platform/navigation"
import type { AppSession, EntitlementSnapshot } from "@/lib/platform/types"

export function SideMenu({
  session,
  entitlements,
  trigger
}: {
  session: AppSession
  entitlements?: EntitlementSnapshot
  trigger: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  const featureMap = useMemo(() => {
    return Object.fromEntries((entitlements?.features || []).map((feature) => [feature.key, feature.isEnabled]))
  }, [entitlements])

  const nav = resolveNavItems({
    role: session.user?.role || "member",
    enabledFeatures: featureMap,
    isPlatformAdmin: session.isPlatformAdmin
  })

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
    router.refresh()
  }

  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      {open ? (
        <div className="fixed inset-x-0 bottom-0 top-16 z-30">
          <button className="absolute inset-0 bg-transparent" aria-label="Close menu" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 right-0 flex w-[min(100vw,24rem)] flex-col border-l border-slate-200 bg-white shadow-xl sm:w-[28rem] sm:max-w-[calc(100vw-2rem)]">
            <div className="border-b border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{session.workspace?.name || "Workspace"}</div>
                  <div className="truncate text-xs text-slate-500">{session.user?.email || "Not signed in"}</div>
                </div>
                <button aria-label="Close menu" className="rounded-md p-2 hover:bg-slate-100" onClick={() => setOpen(false)}>
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs">
                <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">{session.user?.role || "guest"}</span>
                {session.isPlatformAdmin ? <span className="rounded-full bg-brand-50 px-2 py-1 text-brand-700">Platform Admin</span> : null}
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto p-3">
              <MenuSection items={nav.app} pathname={pathname} onClose={() => setOpen(false)} />
              {nav.platformAdmin.length ? (
                <>
                  <div className="px-3 pb-2 pt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">Platform Admin</div>
                  <MenuSection items={nav.platformAdmin} pathname={pathname} onClose={() => setOpen(false)} admin />
                </>
              ) : null}
            </nav>

            <div className="border-t border-slate-200 bg-slate-50 p-4">
              <button onClick={signOut} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  )
}

function MenuSection({
  items,
  pathname,
  onClose,
  admin
}: {
  items: ReturnType<typeof resolveNavItems>["app"]
  pathname: string
  onClose: () => void
  admin?: boolean
}) {
  return (
    <div className="space-y-1">
      {items.map((item) => {
        const Icon = item.icon
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
        const href = item.locked ? "/dashboard/billing" : item.href

        return (
          <Link
            key={item.href}
            href={href}
            onClick={onClose}
            className={[
              "flex items-center gap-3 rounded-md px-3 py-3 text-sm transition-colors",
              active ? "bg-slate-100 text-slate-950" : "text-slate-700 hover:bg-slate-50",
              admin && !active ? "text-brand-700" : "",
              item.locked ? "text-slate-400" : ""
            ].join(" ")}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.locked ? <Lock className="h-4 w-4 flex-shrink-0" /> : null}
          </Link>
        )
      })}
    </div>
  )
}
