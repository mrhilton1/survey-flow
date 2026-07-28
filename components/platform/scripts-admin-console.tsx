"use client"

import { useMemo, useState } from "react"
import { Code2, Loader2, Plus, Save, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface WorkspaceOption {
  id: string
  name: string
}

interface ScriptRecord {
  id: string
  name: string
  description: string | null
  scope: "global" | "workspace"
  workspace_id: string | null
  placement: "head" | "body_start" | "body_end"
  environment: "all" | "production" | "development"
  script_type: "inline" | "external"
  content: string | null
  src_url: string | null
  enabled: boolean
  display_order: number
}

const inputClass = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-400"

const emptyDraft: Partial<ScriptRecord> = {
  name: "",
  description: "",
  scope: "global",
  workspace_id: null,
  placement: "body_end",
  environment: "all",
  script_type: "inline",
  content: "",
  src_url: "",
  enabled: true,
  display_order: 100
}

export function ScriptsAdminConsole({
  initialScripts,
  workspaces
}: {
  initialScripts: ScriptRecord[]
  workspaces: WorkspaceOption[]
}) {
  const [scripts, setScripts] = useState(initialScripts)
  const [draft, setDraft] = useState<Partial<ScriptRecord>>(emptyDraft)
  const [selectedId, setSelectedId] = useState("new")
  const [loading, setLoading] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const selected = useMemo(() => scripts.find((script) => script.id === selectedId), [scripts, selectedId])
  const form = selected || draft

  function update(values: Partial<ScriptRecord>) {
    if (selected) {
      setScripts((current) => current.map((script) => script.id === selected.id ? { ...script, ...values } : script))
    } else {
      setDraft((current) => ({ ...current, ...values }))
    }
  }

  async function save() {
    setLoading("save")
    setNotice(null)
    setError(null)
    const response = await fetch("/api/platform/admin/scripts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    })
    const payload = await response.json().catch(() => ({}))
    setLoading(null)
    if (!response.ok) {
      setError(payload.error || "Unable to save script.")
      return
    }
    setScripts((current) => [payload.script, ...current.filter((script) => script.id !== payload.script.id)].sort((a, b) => a.display_order - b.display_order))
    setSelectedId(payload.script.id)
    setDraft(emptyDraft)
    setNotice("Script saved.")
  }

  async function remove(id: string) {
    setLoading(`delete-${id}`)
    setNotice(null)
    setError(null)
    const response = await fetch("/api/platform/admin/scripts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    })
    const payload = await response.json().catch(() => ({}))
    setLoading(null)
    if (!response.ok) {
      setError(payload.error || "Unable to delete script.")
      return
    }
    setScripts((current) => current.filter((script) => script.id !== id))
    setSelectedId("new")
    setNotice("Script deleted.")
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <section className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-950">Scripts</h1>
            <p className="mt-1 text-sm text-slate-600">Manage global and workspace snippets.</p>
          </div>
          <Button variant="secondary" onClick={() => setSelectedId("new")} aria-label="New script">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="divide-y divide-slate-100">
          {scripts.map((script) => (
            <button key={script.id} type="button" onClick={() => setSelectedId(script.id)} className={`block w-full px-4 py-3 text-left ${selectedId === script.id ? "bg-slate-50" : ""}`}>
              <p className="truncate text-sm font-semibold text-slate-950">{script.name}</p>
              <p className="mt-1 text-xs text-slate-500">{script.scope} / {script.placement} / {script.environment}</p>
            </button>
          ))}
          {scripts.length === 0 ? <p className="p-4 text-sm text-slate-500">No scripts yet.</p> : null}
        </div>
      </section>

      <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700"><Code2 className="h-4 w-4" /> {selected ? "Edit script" : "New script"}</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">{form.name || "Untitled script"}</h2>
          </div>
          {selected ? (
            <Button variant="ghost" onClick={() => remove(selected.id)} disabled={loading === `delete-${selected.id}`}>
              {loading === `delete-${selected.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete
            </Button>
          ) : null}
        </div>

        {notice ? <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</div> : null}
        {error ? <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{error}</div> : null}

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="Name">
            <input value={form.name || ""} onChange={(event) => update({ name: event.target.value })} className={inputClass} />
          </Field>
          <Field label="Display order">
            <input type="number" value={form.display_order ?? 100} onChange={(event) => update({ display_order: Number(event.target.value) })} className={inputClass} />
          </Field>
          <Field label="Scope">
            <select value={form.scope || "global"} onChange={(event) => update({ scope: event.target.value as ScriptRecord["scope"], workspace_id: null })} className={inputClass}>
              <option value="global">Global</option>
              <option value="workspace">Workspace</option>
            </select>
          </Field>
          <Field label="Workspace">
            <select value={form.workspace_id || ""} onChange={(event) => update({ workspace_id: event.target.value || null })} disabled={form.scope !== "workspace"} className={inputClass}>
              <option value="">Choose workspace</option>
              {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
            </select>
          </Field>
          <Field label="Placement">
            <select value={form.placement || "body_end"} onChange={(event) => update({ placement: event.target.value as ScriptRecord["placement"] })} className={inputClass}>
              <option value="head">Head</option>
              <option value="body_start">Body start</option>
              <option value="body_end">Body end</option>
            </select>
          </Field>
          <Field label="Environment">
            <select value={form.environment || "all"} onChange={(event) => update({ environment: event.target.value as ScriptRecord["environment"] })} className={inputClass}>
              <option value="all">All</option>
              <option value="production">Production</option>
              <option value="development">Development</option>
            </select>
          </Field>
          <Field label="Type">
            <select value={form.script_type || "inline"} onChange={(event) => update({ script_type: event.target.value as ScriptRecord["script_type"] })} className={inputClass}>
              <option value="inline">Inline</option>
              <option value="external">External URL</option>
            </select>
          </Field>
          <label className="flex items-center gap-2 pt-7 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={form.enabled ?? true} onChange={(event) => update({ enabled: event.target.checked })} />
            Enabled
          </label>
        </div>

        <div className="mt-4">
          {form.script_type === "external" ? (
            <Field label="Script URL">
              <input value={form.src_url || ""} onChange={(event) => update({ src_url: event.target.value })} className={inputClass} />
            </Field>
          ) : (
            <Field label="Inline script">
              <textarea value={form.content || ""} onChange={(event) => update({ content: event.target.value })} rows={12} className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-50" spellCheck={false} />
            </Field>
          )}
        </div>

        <div className="mt-5">
          <Button onClick={save} disabled={loading === "save"}>
            {loading === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save script
          </Button>
        </div>
      </section>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      {children}
    </label>
  )
}

