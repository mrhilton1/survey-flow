"use client"

import { useMemo, useState } from "react"
import { ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ApiEndpoint } from "@/lib/platform/api-endpoints"

export function ApiDocsBrowser({ endpoints }: { endpoints: ApiEndpoint[] }) {
  const [query, setQuery] = useState("")
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return endpoints
    return endpoints.filter((endpoint) => [endpoint.method, endpoint.path, endpoint.title, endpoint.category, endpoint.summary || ""].join(" ").toLowerCase().includes(needle))
  }, [endpoints, query])
  const groups = useMemo(() => {
    const map = new Map<string, ApiEndpoint[]>()
    for (const endpoint of filtered) map.set(endpoint.category, [...(map.get(endpoint.category) || []), endpoint])
    return Array.from(map.entries())
  }, [filtered])

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">API Docs</h1>
          <p className="mt-2 text-sm text-slate-600">Workspace and public endpoints available for SegPIE integrations.</p>
        </div>
        <Button variant="secondary" onClick={() => window.open("/api/openapi.json", "_blank", "noopener,noreferrer")}>
          <ExternalLink className="h-4 w-4" />
          OpenAPI
        </Button>
      </div>

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Filter endpoints..."
        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
      />

      <div className="space-y-5">
        {groups.map(([category, items]) => (
          <section key={category} className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-5">
              <h2 className="text-lg font-semibold text-slate-950">{category}</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {items.map((endpoint) => (
                <article key={endpoint.id} className="grid gap-3 p-5 lg:grid-cols-[9rem_minmax(0,1fr)_auto] lg:items-center">
                  <code className="w-fit rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white">{endpoint.method}</code>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-950">{endpoint.title}</p>
                    <code className="mt-1 block truncate text-sm text-slate-600">{endpoint.path}</code>
                    {endpoint.summary && <p className="mt-2 text-sm text-slate-500">{endpoint.summary}</p>}
                  </div>
                  <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{formatVisibility(endpoint.visibility)}</span>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

function formatVisibility(value: string) {
  return value.replaceAll("_", " ")
}
