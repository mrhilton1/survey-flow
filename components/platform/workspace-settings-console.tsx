"use client"

/* eslint-disable @next/next/no-img-element */

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, CheckCircle2, Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface WorkspaceSettingsValues {
  name: string
  logoLabel: string | null
  logoSrc: string | null
  logoMarkSrc: string | null
  themeColor: string | null
  supportEmail: string | null
}

export function WorkspaceSettingsConsole({
  workspace,
  canEdit,
  isPlatformWorkspaceView,
  fallbackLogoLabel,
  fallbackLogoSrc,
  fallbackLogoMarkSrc,
  fallbackThemeColor,
  fallbackSupportEmail
}: {
  workspace: WorkspaceSettingsValues
  canEdit: boolean
  isPlatformWorkspaceView: boolean
  fallbackLogoLabel: string
  fallbackLogoSrc?: string
  fallbackLogoMarkSrc?: string
  fallbackThemeColor: string
  fallbackSupportEmail: string
}) {
  const router = useRouter()
  const [name, setName] = useState(workspace.name)
  const [logoLabel, setLogoLabel] = useState(workspace.logoLabel || "")
  const [logoSrc, setLogoSrc] = useState(workspace.logoSrc || "")
  const [logoMarkSrc, setLogoMarkSrc] = useState(workspace.logoMarkSrc || "")
  const [themeColor, setThemeColor] = useState(workspace.themeColor || fallbackThemeColor)
  const [supportEmail, setSupportEmail] = useState(workspace.supportEmail || "")
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setLoading(true)
    setNotice(null)
    setError(null)
    const response = await fetch("/api/dashboard/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, logoLabel, logoSrc, logoMarkSrc, themeColor, supportEmail })
    })
    const payload = await response.json().catch(() => ({}))
    setLoading(false)
    if (!response.ok) {
      setError(payload.error || "Unable to save workspace settings.")
      return
    }
    setNotice("Workspace settings saved.")
    router.refresh()
  }

  const previewLabel = logoLabel || fallbackLogoLabel
  const previewLogo = logoSrc || fallbackLogoSrc
  const previewMark = logoMarkSrc || fallbackLogoMarkSrc
  const previewSupport = supportEmail || fallbackSupportEmail

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">Brand Settings</h1>
        <p className="mt-2 text-slate-600">Manage the identity, logo, support contact, and theme used across the app shell.</p>
      </div>

      {isPlatformWorkspaceView && (
        <Notice tone="warning">You are viewing this workspace through platform context. Saved changes are scoped to this workspace and logged.</Notice>
      )}
      {notice && <Notice tone="success">{notice}</Notice>}
      {error && <Notice tone="warning">{error}</Notice>}

      <section className="grid gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-5">
          <div>
            <label className="text-sm font-semibold text-slate-700" htmlFor="workspace-name">Brand name</label>
            <input
              id="workspace-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={!canEdit}
              className="mt-2 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-slate-700" htmlFor="logo-src">Full logo URL</label>
              <input
                id="logo-src"
                value={logoSrc}
                onChange={(event) => setLogoSrc(event.target.value)}
                disabled={!canEdit}
                placeholder={fallbackLogoSrc || "/brand/logo.png"}
                className="mt-2 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700" htmlFor="logo-mark-src">Compact mark URL</label>
              <input
                id="logo-mark-src"
                value={logoMarkSrc}
                onChange={(event) => setLogoMarkSrc(event.target.value)}
                disabled={!canEdit}
                placeholder={fallbackLogoMarkSrc || "/brand/mark.png"}
                className="mt-2 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
              />
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-[9rem_minmax(0,1fr)]">
            <div>
              <label className="text-sm font-semibold text-slate-700" htmlFor="logo-label">Logo label</label>
              <input
                id="logo-label"
                value={logoLabel}
                onChange={(event) => setLogoLabel(event.target.value.toUpperCase())}
                disabled={!canEdit}
                maxLength={4}
                placeholder={fallbackLogoLabel}
                className="mt-2 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700" htmlFor="theme-color">Theme color</label>
              <div className="mt-2 flex gap-2">
                <input
                  id="theme-color"
                  type="color"
                  value={themeColor}
                  onChange={(event) => setThemeColor(event.target.value)}
                  disabled={!canEdit}
                  className="h-10 w-12 rounded-xl border border-slate-200 bg-white p-1"
                />
                <input
                  value={themeColor}
                  onChange={(event) => setThemeColor(event.target.value)}
                  disabled={!canEdit}
                  className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
                />
              </div>
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700" htmlFor="support-email">Support email</label>
            <input
              id="support-email"
              type="email"
              value={supportEmail}
              onChange={(event) => setSupportEmail(event.target.value)}
              disabled={!canEdit}
              placeholder={fallbackSupportEmail}
              className="mt-2 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={save} disabled={!canEdit || loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save settings
            </Button>
          </div>
          {!canEdit && <p className="text-sm text-slate-500">Your role can view settings but cannot edit them.</p>}
        </div>

        <aside className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-700">Shell preview</p>
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
            {previewMark ? (
              <img src={previewMark} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover" />
            ) : (
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold text-white" style={{ backgroundColor: themeColor }}>
                {previewLabel}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-950">{name}</p>
              <p className="truncate text-xs text-slate-500">{previewSupport}</p>
            </div>
          </div>
          {previewLogo ? (
            <div className="mt-4 rounded-xl bg-white p-3 shadow-sm">
              <img src={previewLogo} alt={`${name} logo`} className="h-auto max-h-16 max-w-full object-contain" />
            </div>
          ) : null}
        </aside>
      </section>
    </div>
  )
}

function Notice({ tone, children }: { tone: "success" | "warning"; children: React.ReactNode }) {
  return (
    <div className={`flex items-start gap-2 rounded-xl border p-4 text-sm ${tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
      {tone === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
      {children}
    </div>
  )
}
