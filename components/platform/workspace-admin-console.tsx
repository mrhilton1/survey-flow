"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { BarChart3, Copy, Eye, Loader2, RefreshCw, Search, ShieldCheck, Users } from "lucide-react"
import { Button } from "@/components/ui/button"

interface WorkspaceRow {
  id: string
  name: string
  slug: string
  plan_key: string
  stripe_customer_id: string | null
  created_at: string
}

interface UserRow {
  id: string
  email: string
  display_name: string | null
  role: string
  workspace_id: string
  created_at: string
}

interface PlanRow {
  id: string
  plan_key: string
  name: string
  status: string
}

interface UsageCounterRow {
  id: string
  workspace_id: string
  counter_key: string
  used_value: number
  period_start: string
  period_end: string
}

interface SurveyRow {
  id: string
  workspace_id: string
  owner_user_id: string
  name: string
  status: string
  responses_count: number | null
  views_count: number | null
  updated_at: string
}

interface ResponseRow {
  id: string
  workspace_id: string
  survey_id: string
  status: string
  is_test: boolean | null
  submitted_at: string | null
  last_active_at: string | null
  updated_at: string
}

interface AuditLogRow {
  id: string
  workspace_id: string | null
  actor_user_id: string | null
  action: string
  created_at: string
}

interface WorkspaceStat {
  workspaceId: string
  workspaceName: string
  slug: string
  planKey: string
  ownerEmails: string[]
  userCount: number
  surveyCount: number
  surveyStatusCounts: { published: number; draft: number; testing: number }
  responseCount: number
  completedResponses: number
  partialResponses: number
  testResponses: number
  officialResponses: number
  viewsCount: number
  telemetryCount: number
  webhookDeliveries: number
  webhookFailures: number
  auditEvents: number
  lastResponseAt: string | null
  lastSurveyUpdateAt: string | null
}

interface AdminData {
  data: {
    workspaces: WorkspaceRow[]
    users: UserRow[]
    plans: PlanRow[]
    usageCounters: UsageCounterRow[]
    surveys: SurveyRow[]
    responses: ResponseRow[]
    auditLog: AuditLogRow[]
    workspaceStats: WorkspaceStat[]
  }
}

const roleOptions = ["owner", "admin", "member"]

export function WorkspaceAdminConsole() {
  const router = useRouter()
  const [data, setData] = useState<AdminData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [expanded, setExpanded] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    const response = await fetch("/api/platform/admin/access", { cache: "no-store" })
    const json = await response.json().catch(() => ({}))
    if (!response.ok) {
      setError(json.error || "Unable to load workspace data.")
      setLoading(false)
      return
    }
    setData(json)
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const statsByWorkspace = useMemo(() => {
    const map = new Map<string, WorkspaceStat>()
    data?.data.workspaceStats.forEach((stat) => map.set(stat.workspaceId, stat))
    return map
  }, [data])

  const filteredWorkspaces = useMemo(() => {
    const workspaces = data?.data.workspaces || []
    const term = query.trim().toLowerCase()
    if (!term) return workspaces
    return workspaces.filter((workspace) => {
      const stat = statsByWorkspace.get(workspace.id)
      return [workspace.id, workspace.name, workspace.slug, workspace.plan_key, ...(stat?.ownerEmails || [])]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    })
  }, [data, query, statsByWorkspace])

  async function runAdminAction(payload: Record<string, unknown>, success: string, options?: { refreshShell?: boolean }) {
    setSaving(success)
    setMessage(null)
    setError(null)
    const response = await fetch("/api/platform/admin/access", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    })
    const json = await response.json().catch(() => ({}))
    setSaving(null)
    if (!response.ok) {
      setError(json.error || "Unable to save change.")
      return
    }
    setData(json)
    setMessage(success)
    if (options?.refreshShell) {
      router.refresh()
    }
  }

  async function viewWorkspace(workspaceId: string) {
    setSaving("Opening workspace view...")
    setMessage(null)
    setError(null)
    const response = await fetch("/api/platform/admin/workspace-context", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspaceId })
    })
    const json = await response.json().catch(() => ({}))
    setSaving(null)
    if (!response.ok) {
      setError(json.error || "Unable to open workspace view.")
      return
    }
    router.push("/dashboard/surveys")
    router.refresh()
  }

  async function copy(value: string, label = "Copied") {
    await navigator.clipboard.writeText(value)
    setMessage(label)
  }

  if (loading) {
    return (
      <div className="mx-auto flex max-w-7xl items-center gap-3 rounded-lg border border-slate-200 bg-white p-5 text-slate-700 shadow-sm">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading workspace command center...
      </div>
    )
  }

  const allUsers = data?.data.users || []
  const allSurveys = data?.data.surveys || []
  const allResponses = data?.data.responses || []
  const allUsage = data?.data.usageCounters || []
  const allAudit = data?.data.auditLog || []
  const activePlans = (data?.data.plans || []).filter((plan) => plan.status !== "archived")
  const totals = (data?.data.workspaceStats || []).reduce(
    (acc, stat) => ({
      users: acc.users + stat.userCount,
      surveys: acc.surveys + stat.surveyCount,
      responses: acc.responses + stat.responseCount,
      views: acc.views + stat.viewsCount
    }),
    { users: 0, surveys: 0, responses: 0, views: 0 }
  )

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold uppercase tracking-wide text-emerald-700">
            <ShieldCheck className="mr-2 h-4 w-4" />
            Platform owner
          </p>
          <h1 className="mt-4 text-3xl font-semibold text-slate-950">Workspace Management</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            See every workspace created in this app, change plans and user roles, inspect usage, and open an audited platform workspace view.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={load}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {(message || error || saving) && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {error || saving || message}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Workspaces" value={data?.data.workspaces.length || 0} />
        <MetricCard label="Users" value={totals.users} />
        <MetricCard label="Surveys" value={totals.surveys} />
        <MetricCard label="Responses" value={totals.responses} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">All Workspaces</h2>
            <p className="text-sm text-slate-500">Search by workspace, id, plan, or owner email.</p>
          </div>
          <label className="relative w-full lg:w-96">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="h-11 w-full rounded-md border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-slate-500"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter workspaces, owners, ids..."
            />
          </label>
        </div>

        <div className="divide-y divide-slate-200">
          {filteredWorkspaces.map((workspace) => {
            const stat = statsByWorkspace.get(workspace.id)
            const workspaceUsers = allUsers.filter((user) => user.workspace_id === workspace.id)
            const workspaceSurveys = allSurveys.filter((survey) => survey.workspace_id === workspace.id)
            const workspaceResponses = allResponses.filter((response) => response.workspace_id === workspace.id)
            const workspaceUsage = allUsage.filter((counter) => counter.workspace_id === workspace.id)
            const workspaceAudit = allAudit.filter((entry) => entry.workspace_id === workspace.id)
            const isExpanded = expanded === workspace.id

            return (
              <section key={workspace.id} className="p-4">
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                  <button type="button" className="min-w-0 text-left" onClick={() => setExpanded(isExpanded ? null : workspace.id)}>
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <h3 className="truncate text-lg font-semibold text-slate-950">{workspace.name}</h3>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold uppercase text-slate-600">{workspace.plan_key}</span>
                    </div>
                    <p className="mt-1 truncate text-sm text-slate-500">{workspace.slug} · {workspace.id}</p>
                    <p className="mt-1 truncate text-sm text-slate-600">{stat?.ownerEmails.join(", ") || "No owner email found"}</p>
                  </button>

                  <div className="grid gap-3 sm:grid-cols-2 xl:flex xl:items-center">
                    <MiniStat icon={<Users className="h-4 w-4" />} label="Users" value={stat?.userCount || 0} />
                    <MiniStat icon={<BarChart3 className="h-4 w-4" />} label="Responses" value={stat?.responseCount || 0} />
                    <select
                      className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
                      value={workspace.plan_key}
                      onChange={(event) =>
                        runAdminAction(
                          { action: "setWorkspacePlan", workspaceId: workspace.id, planKey: event.target.value },
                          `Plan updated for ${workspace.name}`,
                          { refreshShell: true }
                        )
                      }
                    >
                      {activePlans.map((plan) => (
                        <option key={plan.plan_key} value={plan.plan_key}>{plan.name}</option>
                      ))}
                    </select>
                    <Button type="button" onClick={() => viewWorkspace(workspace.id)}>
                      <Eye className="mr-2 h-4 w-4" />
                      View workspace
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => copy(workspace.id, "Workspace ID copied")}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy ID
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-5 grid gap-4 xl:grid-cols-3">
                    <DetailPanel title="Usage">
                      <StatLine label="Surveys" value={`${stat?.surveyCount || 0} total · ${stat?.surveyStatusCounts.published || 0} published`} />
                      <StatLine label="Responses" value={`${stat?.completedResponses || 0} completed · ${stat?.partialResponses || 0} partial`} />
                      <StatLine label="Testing" value={`${stat?.testResponses || 0} test · ${stat?.officialResponses || 0} official`} />
                      <StatLine label="Views" value={stat?.viewsCount || 0} />
                      <StatLine label="Webhook failures" value={stat?.webhookFailures || 0} />
                      {workspaceUsage.slice(0, 6).map((counter) => (
                        <StatLine key={counter.id} label={counter.counter_key} value={counter.used_value} />
                      ))}
                    </DetailPanel>

                    <DetailPanel title="Users">
                      {workspaceUsers.map((user) => (
                        <div key={user.id} className="rounded-md border border-slate-200 p-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-950">{user.display_name || user.email}</p>
                            <p className="truncate text-sm text-slate-500">{user.email}</p>
                          </div>
                          <select
                            className="mt-3 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
                            value={user.role}
                            onChange={(event) =>
                              runAdminAction(
                                { action: "updateUserRole", userId: user.id, role: event.target.value },
                                `Role updated for ${user.email}`
                              )
                            }
                          >
                            {roleOptions.map((role) => (
                              <option key={role} value={role}>{role}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </DetailPanel>

                    <DetailPanel title="Recent activity">
                      {workspaceSurveys.slice(0, 5).map((survey) => (
                        <StatLine key={survey.id} label={survey.name} value={`${survey.status} · ${survey.responses_count || 0} responses`} />
                      ))}
                      {workspaceResponses.slice(0, 3).map((response) => (
                        <StatLine key={response.id} label={`Response ${response.id.slice(0, 8)}`} value={`${response.status}${response.is_test ? " · test" : ""}`} />
                      ))}
                      {workspaceAudit.slice(0, 5).map((entry) => (
                        <StatLine key={entry.id} label={entry.action} value={formatDate(entry.created_at)} />
                      ))}
                    </DetailPanel>
                  </div>
                )}
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-950">{value.toLocaleString()}</p>
    </div>
  )
}

function MiniStat({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="flex h-10 items-center gap-2 rounded-md bg-slate-50 px-3 text-sm font-semibold text-slate-700">
      {icon}
      <span>{value.toLocaleString()}</span>
      <span className="text-slate-500">{label}</span>
    </div>
  )
}

function DetailPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <h4 className="font-semibold text-slate-950">{title}</h4>
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  )
}

function StatLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-md bg-white px-3 py-2 text-sm">
      <span className="min-w-0 truncate text-slate-600">{label}</span>
      <span className="shrink-0 font-semibold text-slate-900">{value}</span>
    </div>
  )
}

function formatDate(value: string | null | undefined) {
  if (!value) return "n/a"
  return new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" }).format(new Date(value))
}
