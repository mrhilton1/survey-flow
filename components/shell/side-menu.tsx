"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Eye, Lock, LogOut, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
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
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [open])

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

  async function exitWorkspaceView() {
    await fetch("/api/platform/admin/workspace-context", { method: "DELETE" })
    setOpen(false)
    router.push("/admin/workspaces")
    router.refresh()
  }

  const workspaceContext = session.platformWorkspaceContext

  const tray = open && mounted
    ? createPortal(
        <div className="fixed inset-0 z-[2147483647] flex h-dvh w-screen justify-end bg-slate-950/5">
          <button className="hidden flex-1 bg-transparent sm:block" aria-label="Close menu" onClick={() => setOpen(false)} />
          <aside className="flex h-dvh w-full max-w-sm flex-col border-l border-border bg-white shadow-2xl shadow-slate-950/20">
            <div className="border-b border-border p-5">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="truncate text-lg font-bold tracking-tight text-foreground">{session.workspace?.name || "Workspace"}</div>
                  {workspaceContext ? (
                    <div className="truncate text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                      Viewing workspace
                    </div>
                  ) : null}
                  <div className="truncate text-xs font-medium text-muted-foreground">{session.user?.email || "Not signed in"}</div>
                </div>
                <button aria-label="Close menu" className="rounded-xl bg-muted p-2 transition hover:bg-slate-200" onClick={() => setOpen(false)}>
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs">
                <span className="rounded-full bg-muted px-3 py-1 font-medium text-slate-700">{session.user?.role || "guest"}</span>
                {session.isPlatformAdmin ? <span className="rounded-full bg-brand-50 px-3 py-1 font-medium text-brand-700">Platform Admin</span> : null}
              </div>
              {workspaceContext ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                  <div className="flex items-start gap-2">
                    <Eye className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-700" />
                    <div className="min-w-0">
                      <p className="font-semibold">Logged in as {session.user?.email || "platform admin"}</p>
                      <p className="mt-1 text-xs leading-5 text-amber-800">
                        Viewing {workspaceContext.workspaceName}. Actions are scoped to this workspace and logged for audit.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={exitWorkspaceView}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-amber-950 transition hover:bg-amber-100"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Exit workspace view
                  </button>
                </div>
              ) : null}
            </div>

            <nav className="flex-1 overflow-y-auto p-4">
              <MenuSection items={nav.app} pathname={pathname} onClose={() => setOpen(false)} />
              {nav.platformAdmin.length ? (
                <>
                  <div className="px-3 pb-2 pt-6 text-xs font-bold uppercase tracking-widest text-muted-foreground">Platform Admin</div>
                  <MenuSection items={nav.platformAdmin} pathname={pathname} onClose={() => setOpen(false)} admin />
                </>
              ) : null}
            </nav>

            <div className="border-t border-border bg-muted/50 p-4">
              <button onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50">
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </aside>
        </div>,
        document.body
      )
    : null

  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      {tray}
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
              "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors",
              active ? "bg-muted text-foreground shadow-sm" : "text-slate-700 hover:bg-muted/70",
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
