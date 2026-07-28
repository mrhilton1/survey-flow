"use client"

import { useMemo, useState } from "react"
import { AlertCircle, CheckCircle2, Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ApiEndpoint, ApiEndpointVisibility } from "@/lib/platform/api-endpoints"

export function ApiEndpointsAdminConsole({ initialEndpoints }: { initialEndpoints: ApiEndpoint[] }) {
  const [endpoints, setEndpoints] = useState(initialEndpoints)
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return endpoints
    return endpoints.filter((endpoint) => [endpoint.method, endpoint.path, endpoint.title, endpoint.category, endpoint.visibility, endpoint.doc_status].join(" ").toLowerCase().includes(needle))
  }, [endpoints, query])

  async function updateEndpoint(endpoint: ApiEndpoint, values: Partial<ApiEndpoint>) {
    setLoading(endpoint.id)
    setNotice(null)
    setError(null)
    const response = await fetch("/api/platform/admin/api-endpoints", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: endpoint.id, ...values })
    })
    const payload = await response.json().catch(() => ({}))
    setLoading(null)
    if (!response.ok) {
      setError(payload.error || "Unable to update endpoint.")
      return
    }
    setEndpoints((current) => current.map((item) => item.id === endpoint.id ? payload.endpoint : item))
    setNotice("Endpoint updated.")
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">API Endpoints</h1>
        <p className="mt-2 text-slate-600">Manage endpoint visibility and documentation status.</p>
      </div>

      {notice && <Notice tone="success">{notice}</Notice>}
      {error && <Notice tone="warning">{error}</Notice>}

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Filter endpoints..."
        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
      />

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="divide-y divide-slate-100">
          {filtered.map((endpoint) => (
            <EndpointRow key={endpoint.id} endpoint={endpoint} loading={loading === endpoint.id} onSave={(values) => updateEndpoint(endpoint, values)} />
          ))}
        </div>
      </section>
    </div>
  )
}

function EndpointRow({
  endpoint,
  loading,
  onSave
}: {
  endpoint: ApiEndpoint
  loading: boolean
  onSave: (values: Partial<ApiEndpoint>) => void
}) {
  const [category, setCategory] = useState(endpoint.category)
  const [categoryDraft, setCategoryDraft] = useState("")
  const [visibility, setVisibility] = useState<ApiEndpointVisibility>(endpoint.visibility)
  const docStatus = endpoint.doc_status
  const changed = category !== endpoint.category || visibility !== endpoint.visibility
  const commitCategoryDraft = () => {
    const next = categoryDraft.trim()
    if (!next) return
    setCategory(next)
    setCategoryDraft("")
  }

  return (
    <article className="grid gap-4 p-5 xl:grid-cols-[minmax(0,1fr)_minmax(14rem,22rem)_18rem_auto] xl:items-center">
      <div className="min-w-0">
        <p className="font-semibold text-slate-950">{endpoint.title}</p>
        <code className="mt-1 block truncate text-sm text-slate-600">{endpoint.method} {endpoint.path}</code>
        {endpoint.summary && <p className="mt-2 text-sm text-slate-500">{endpoint.summary}</p>}
        <p className={`mt-2 text-xs font-semibold lowercase ${docStatus === "documented" ? "text-emerald-700" : docStatus === "draft" ? "text-amber-700" : "text-red-700"}`}>
          {docStatus === "documented" ? "documented" : docStatus === "draft" ? "draft docs" : "not documented"}
        </p>
      </div>
      <div className="flex min-h-14 w-full flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 transition focus-within:border-slate-400">
        {category.trim() ? (
          <span className="inline-flex h-8 max-w-full items-center gap-2 rounded-full bg-slate-950 px-3 text-xs font-semibold text-white">
            <span className="truncate">{category}</span>
            <button
              type="button"
              aria-label={`Clear ${category} category`}
              onClick={() => {
                setCategory("")
                setCategoryDraft("")
              }}
              className="grid h-4 w-4 shrink-0 place-items-center rounded-full text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              ×
            </button>
          </span>
        ) : null}
        <input
          value={categoryDraft}
          onChange={(event) => setCategoryDraft(event.target.value)}
          onBlur={commitCategoryDraft}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              commitCategoryDraft()
            }
          }}
          placeholder={category.trim() ? "" : "Category"}
          className="h-8 min-w-24 flex-1 bg-transparent px-1 text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {(["public", "internal", "admin_only"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setVisibility(option)}
            className={`h-8 rounded-full border px-3 text-xs font-semibold capitalize transition ${
              visibility === option
                ? "border-slate-950 bg-slate-950 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            {option.replace("_", " ")}
          </button>
        ))}
      </div>
      <Button className="w-fit" variant="secondary" onClick={() => onSave({ category: category.trim(), visibility, doc_status: docStatus })} disabled={!changed || !category.trim() || loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save
      </Button>
    </article>
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
