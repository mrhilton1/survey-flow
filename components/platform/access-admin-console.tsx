"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertCircle, Check, Flag, KeyRound, Layers3, Loader2, RefreshCw, Shield, SlidersHorizontal, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { AppShellConfig, FeatureAccessDefinition, FeatureDefinition, LimitDefinition, RoleDefinition } from "@/lib/platform/types"

type ConsoleMode = "flags" | "entitlements" | "permissions"

interface AccessAdminConsoleProps {
  mode: ConsoleMode
}

interface WorkspaceRow {
  id: string
  name: string
  slug: string
  plan_key: string
}

interface UserRow {
  id: string
  email: string
  display_name: string | null
  role: string
  workspace_id: string
}

interface FlagRow {
  flag_key: string
  enabled: boolean
  workspace_overrides: Record<string, boolean>
  description: string | null
  updated_at: string
}

interface PlanRow {
  plan_key: string
  name: string
  stripe_monthly_price_id: string | null
  stripe_yearly_price_id: string | null
  active: boolean
}

interface PlanFeatureRow {
  plan_key: string
  feature_key: string
  enabled: boolean
}

interface PlanLimitRow {
  plan_key: string
  limit_key: string
  limit_value: string
}

interface WorkspaceOverrideRow {
  id: string
  workspace_id: string
  target_type: "feature" | "limit"
  target_key: string
  override_value: string
  reason: string | null
  active: boolean
}

interface DiagnosticFeature {
  key: string
  label: string
  entitlement: { key: string; enabled: boolean }
  flags: Array<{ key: string; enabled: boolean }>
  permissionsByRole: Record<string, boolean>
  enabledForOwners: boolean
}

interface WorkspaceDiagnostic {
  workspaceId: string
  workspaceName: string
  planKey: string
  features: DiagnosticFeature[]
}

interface AdminAccessData {
  definitions: {
    features: FeatureDefinition[]
    limits: LimitDefinition[]
    roles: AppShellConfig["roles"]
    featureAccess: Array<FeatureAccessDefinition & { entitlementLabel?: string }>
  }
  data: {
    workspaces: WorkspaceRow[]
    users: UserRow[]
    flags: FlagRow[]
    plans: PlanRow[]
    planFeatures: PlanFeatureRow[]
    planLimits: PlanLimitRow[]
    overrides: WorkspaceOverrideRow[]
  }
  diagnostics: WorkspaceDiagnostic[]
}

export function AccessAdminConsole({ mode }: AccessAdminConsoleProps) {
  const [data, setData] = useState<AdminAccessData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    const response = await fetch("/api/platform/admin/access", { cache: "no-store" })
    const json = await response.json().catch(() => ({}))
    if (!response.ok) {
      setError(json.error || "Unable to load platform access data.")
      setLoading(false)
      return
    }
    setData(json)
    setLoading(false)
  }

  async function mutate(payload: Record<string, unknown>, success = "Saved") {
    setSaving(true)
    setMessage(null)
    setError(null)
    const response = await fetch("/api/platform/admin/access", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    })
    const json = await response.json().catch(() => ({}))
    setSaving(false)
    if (!response.ok) {
      setError(json.error || "Unable to save changes.")
      return
    }
    setData(json)
    setMessage(success)
  }

  useEffect(() => {
    void load()
  }, [])

  if (loading) {
    return (
      <div className="mx-auto flex max-w-6xl items-center gap-3 rounded-lg border border-slate-200 bg-white p-5 text-slate-700 shadow-sm">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading platform access controls...
      </div>
    )
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-6xl rounded-lg border border-red-200 bg-red-50 p-5 text-red-700">
        {error || "Platform access controls could not be loaded."}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <ConsoleHeader mode={mode} onRefresh={load} saving={saving} />
      {(message || error) && (
        <div className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {error ? <AlertCircle className="h-4 w-4" /> : <Check className="h-4 w-4" />}
          {error || message}
        </div>
      )}

      {mode === "flags" && <FlagsPanel data={data} mutate={mutate} />}
      {mode === "entitlements" && <EntitlementsPanel data={data} mutate={mutate} />}
      {mode === "permissions" && <PermissionsPanel data={data} mutate={mutate} />}
    </div>
  )
}

function ConsoleHeader({ mode, onRefresh, saving }: { mode: ConsoleMode; onRefresh: () => void; saving: boolean }) {
  const copy = {
    flags: {
      icon: Flag,
      title: "Feature Flags",
      description: "Roll out, pause, or workspace-target features without changing plans or code."
    },
    entitlements: {
      icon: SlidersHorizontal,
      title: "Entitlements",
      description: "Manage plan access, limits, workspace overrides, and feature-access diagnostics."
    },
    permissions: {
      icon: Shield,
      title: "Roles & Permissions",
      description: "Review role grants and update workspace user roles for granular access control."
    }
  }[mode]
  const Icon = copy.icon

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
      <div className="flex gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-950 text-white">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">{copy.title}</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">{copy.description}</p>
        </div>
      </div>
      <Button variant="secondary" onClick={onRefresh} disabled={saving}>
        <RefreshCw className="h-4 w-4" />
        Refresh
      </Button>
    </div>
  )
}

function FlagsPanel({ data, mutate }: { data: AdminAccessData; mutate: (payload: Record<string, unknown>, success?: string) => Promise<void> }) {
  const [flagKey, setFlagKey] = useState("")
  const [description, setDescription] = useState("")
  const firstFlag = data.data.flags[0]?.flag_key || ""
  const firstWorkspace = data.data.workspaces[0]?.id || ""
  const [overrideFlag, setOverrideFlag] = useState(firstFlag)
  const [overrideWorkspace, setOverrideWorkspace] = useState(firstWorkspace)
  const associatedFlags = useMemo(() => {
    const flags = new Map<string, string[]>()
    for (const definition of data.definitions.featureAccess) {
      for (const flag of definition.flags) {
        flags.set(flag, [...(flags.get(flag) || []), definition.label])
      }
    }
    return flags
  }, [data.definitions.featureAccess])

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Flags</h2>
          <p className="mt-1 text-sm text-slate-600">Flags are operational switches. Entitlements still decide whether a workspace owns the feature.</p>
        </div>
        <form
          className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault()
            void mutate({ action: "upsertFlag", flagKey, description, enabled: true }, "Flag created")
            setFlagKey("")
            setDescription("")
          }}
        >
          <input className={inputClass} placeholder="flag_key" value={flagKey} onChange={(event) => setFlagKey(event.target.value)} required />
          <input className={inputClass} placeholder="Description" value={description} onChange={(event) => setDescription(event.target.value)} />
          <Button type="submit">Create Flag</Button>
        </form>
        <div className="overflow-hidden rounded-lg border border-slate-200">
          {data.data.flags.map((flag) => (
            <div key={flag.flag_key} className="grid gap-3 border-b border-slate-200 p-4 last:border-b-0 md:grid-cols-[1fr_auto_auto] md:items-center">
              <div>
                <p className="font-semibold text-slate-950">{flag.flag_key}</p>
                <p className="mt-1 text-sm text-slate-600">{flag.description || "No description"}</p>
                {associatedFlags.has(flag.flag_key) && (
                  <p className="mt-2 text-xs font-semibold uppercase text-emerald-700">Used by {associatedFlags.get(flag.flag_key)?.join(", ")}</p>
                )}
              </div>
              <Toggle
                checked={flag.enabled}
                label={flag.enabled ? "Enabled" : "Disabled"}
                onChange={(enabled) =>
                  mutate({
                    action: "upsertFlag",
                    flagKey: flag.flag_key,
                    description: flag.description,
                    workspaceOverrides: flag.workspace_overrides || {},
                    enabled
                  })
                }
              />
              <Button variant="danger" onClick={() => mutate({ action: "deleteFlag", flagKey: flag.flag_key }, "Flag deleted")}>
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </div>
          ))}
        </div>
      </section>

      <aside className="space-y-4">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Workspace Override</h2>
          <p className="mt-1 text-sm text-slate-600">Target a flag for one workspace during rollout or troubleshooting.</p>
          <div className="mt-4 space-y-3">
            <select className={inputClass} value={overrideFlag} onChange={(event) => setOverrideFlag(event.target.value)}>
              {data.data.flags.map((flag) => <option key={flag.flag_key}>{flag.flag_key}</option>)}
            </select>
            <select className={inputClass} value={overrideWorkspace} onChange={(event) => setOverrideWorkspace(event.target.value)}>
              {data.data.workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
            </select>
            <div className="grid grid-cols-3 gap-2">
              <Button variant="secondary" onClick={() => mutate({ action: "setFlagWorkspaceOverride", flagKey: overrideFlag, workspaceId: overrideWorkspace, enabled: true }, "Override saved")}>On</Button>
              <Button variant="secondary" onClick={() => mutate({ action: "setFlagWorkspaceOverride", flagKey: overrideFlag, workspaceId: overrideWorkspace, enabled: false }, "Override saved")}>Off</Button>
              <Button variant="ghost" onClick={() => mutate({ action: "setFlagWorkspaceOverride", flagKey: overrideFlag, workspaceId: overrideWorkspace, enabled: null }, "Override removed")}>Clear</Button>
            </div>
          </div>
        </section>
        <FeatureAccessSummary data={data} />
      </aside>
    </div>
  )
}

function EntitlementsPanel({ data, mutate }: { data: AdminAccessData; mutate: (payload: Record<string, unknown>, success?: string) => Promise<void> }) {
  const [planKey, setPlanKey] = useState("")
  const [planName, setPlanName] = useState("")

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Plans</h2>
            <p className="mt-1 text-sm text-slate-600">Plans are the durable source for paid access. Flags can still pause rollout per feature.</p>
          </div>
          <form
            className="grid gap-2 md:grid-cols-[10rem_14rem_auto]"
            onSubmit={(event) => {
              event.preventDefault()
              void mutate({ action: "upsertPlan", planKey, name: planName, active: true }, "Plan saved")
              setPlanKey("")
              setPlanName("")
            }}
          >
            <input className={inputClass} placeholder="plan_key" value={planKey} onChange={(event) => setPlanKey(event.target.value)} required />
            <input className={inputClass} placeholder="Plan name" value={planName} onChange={(event) => setPlanName(event.target.value)} required />
            <Button type="submit">Create Plan</Button>
          </form>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {data.data.plans.map((plan) => (
            <div key={plan.plan_key} className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-950">{plan.name}</p>
                  <p className="text-sm text-slate-500">{plan.plan_key}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${plan.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {plan.active ? "active" : "inactive"}
                </span>
              </div>
              <div className="mt-4 flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => mutate({ action: "upsertPlan", planKey: plan.plan_key, name: plan.name, active: !plan.active, stripeMonthlyPriceId: plan.stripe_monthly_price_id, stripeYearlyPriceId: plan.stripe_yearly_price_id })}
                >
                  {plan.active ? "Deactivate" : "Activate"}
                </Button>
                <Button variant="danger" onClick={() => mutate({ action: "deletePlan", planKey: plan.plan_key }, "Plan deleted")}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Plan Feature Matrix</h2>
        <div className="mt-4 overflow-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className={thClass}>Feature</th>
                {data.data.plans.map((plan) => <th className={thClass} key={plan.plan_key}>{plan.name}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {data.definitions.features.map((feature) => (
                <tr key={feature.key}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{feature.label}</p>
                    <p className="text-xs text-slate-500">{feature.key}</p>
                  </td>
                  {data.data.plans.map((plan) => {
                    const enabled = data.data.planFeatures.find((row) => row.plan_key === plan.plan_key && row.feature_key === feature.key)?.enabled ?? feature.defaultEnabled
                    return (
                      <td className="px-4 py-3" key={`${plan.plan_key}-${feature.key}`}>
                        <Toggle
                          checked={enabled}
                          label={enabled ? "On" : "Off"}
                          onChange={(next) => mutate({ action: "setPlanFeature", planKey: plan.plan_key, featureKey: feature.key, enabled: next })}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Plan Limits</h2>
        <div className="mt-4 grid gap-4">
          {data.definitions.limits.map((limit) => (
            <div key={limit.key} className="rounded-lg border border-slate-200 p-4">
              <p className="font-semibold text-slate-950">{limit.label}</p>
              <p className="text-xs text-slate-500">{limit.key}</p>
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                {data.data.plans.map((plan) => {
                  const row = data.data.planLimits.find((item) => item.plan_key === plan.plan_key && item.limit_key === limit.key)
                  return (
                    <form
                      key={`${plan.plan_key}-${limit.key}`}
                      className="flex gap-2"
                      onSubmit={(event) => {
                        event.preventDefault()
                        const form = new FormData(event.currentTarget)
                        void mutate({ action: "setPlanLimit", planKey: plan.plan_key, limitKey: limit.key, limitValue: String(form.get("value") || "") }, "Limit saved")
                      }}
                    >
                      <label className="sr-only">{plan.name}</label>
                      <input name="value" className={inputClass} defaultValue={row?.limit_value ?? String(limit.defaultValue)} />
                      <Button type="submit" variant="secondary">Save</Button>
                    </form>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <WorkspaceOverrides data={data} mutate={mutate} />
      <DiagnosticsPanel data={data} />
    </div>
  )
}

function PermissionsPanel({ data, mutate }: { data: AdminAccessData; mutate: (payload: Record<string, unknown>, success?: string) => Promise<void> }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_28rem]">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Workspace Users</h2>
        <p className="mt-1 text-sm text-slate-600">Roles are assigned per workspace user. The role registry is code-backed so product authorization is reviewable.</p>
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
          {data.data.users.map((user) => {
            const workspace = data.data.workspaces.find((item) => item.id === user.workspace_id)
            return (
              <div key={user.id} className="grid gap-3 border-b border-slate-200 p-4 last:border-b-0 md:grid-cols-[1fr_13rem_auto] md:items-center">
                <div>
                  <p className="font-semibold text-slate-950">{user.display_name || user.email}</p>
                  <p className="text-sm text-slate-600">{user.email}</p>
                  <p className="text-xs text-slate-500">{workspace?.name || "Unknown workspace"}</p>
                </div>
                <select
                  className={inputClass}
                  value={user.role}
                  onChange={(event) => mutate({ action: "updateUserRole", userId: user.id, role: event.target.value }, "Role updated")}
                >
                  {Object.entries(data.definitions.roles).map(([role, definition]) => (
                    <option key={role} value={role}>{definition.label}</option>
                  ))}
                </select>
                <span className="rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">{user.role}</span>
              </div>
            )
          })}
        </div>
      </section>

      <aside className="space-y-4">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Role Registry</h2>
          <div className="mt-4 space-y-3">
            {Object.entries(data.definitions.roles).map(([role, definition]) => (
              <RoleCard key={role} role={role} definition={definition} />
            ))}
          </div>
        </section>
        <FeatureAccessSummary data={data} />
      </aside>
    </div>
  )
}

function WorkspaceOverrides({ data, mutate }: { data: AdminAccessData; mutate: (payload: Record<string, unknown>, success?: string) => Promise<void> }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Workspace Overrides</h2>
      <p className="mt-1 text-sm text-slate-600">Use these for comped access, trials, temporary limit bumps, and support exceptions.</p>
      <form
        className="mt-4 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_9rem_1fr_10rem_1fr_auto]"
        onSubmit={(event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          void mutate({
            action: "upsertWorkspaceOverride",
            workspaceId: String(form.get("workspaceId")),
            targetType: form.get("targetType"),
            targetKey: String(form.get("targetKey")),
            overrideValue: String(form.get("overrideValue")),
            reason: String(form.get("reason") || "")
          }, "Override saved")
          event.currentTarget.reset()
        }}
      >
        <select name="workspaceId" className={inputClass}>
          {data.data.workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
        </select>
        <select name="targetType" className={inputClass}>
          <option value="feature">Feature</option>
          <option value="limit">Limit</option>
        </select>
        <input name="targetKey" className={inputClass} placeholder="target_key" required />
        <input name="overrideValue" className={inputClass} placeholder="true, false, 5000..." required />
        <input name="reason" className={inputClass} placeholder="Reason" />
        <Button type="submit">Add</Button>
      </form>
      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
        {data.data.overrides.map((override) => {
          const workspace = data.data.workspaces.find((item) => item.id === override.workspace_id)
          return (
            <div key={override.id} className="grid gap-3 border-b border-slate-200 p-4 last:border-b-0 md:grid-cols-[1fr_auto_auto] md:items-center">
              <div>
                <p className="font-semibold text-slate-950">{workspace?.name || "Unknown workspace"}: {override.target_key}</p>
                <p className="text-sm text-slate-600">{override.target_type} override to <span className="font-semibold">{override.override_value}</span></p>
                {override.reason && <p className="text-xs text-slate-500">{override.reason}</p>}
              </div>
              <Toggle
                checked={override.active}
                label={override.active ? "Active" : "Inactive"}
                onChange={(active) => mutate({ action: "upsertWorkspaceOverride", id: override.id, workspaceId: override.workspace_id, targetType: override.target_type, targetKey: override.target_key, overrideValue: override.override_value, reason: override.reason, active })}
              />
              <Button variant="danger" onClick={() => mutate({ action: "deleteWorkspaceOverride", id: override.id }, "Override deleted")}>
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function DiagnosticsPanel({ data }: { data: AdminAccessData }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Access Diagnostics</h2>
      <p className="mt-1 text-sm text-slate-600">This shows how entitlements, flags, and role permissions combine for each workspace.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {data.diagnostics.map((workspace) => (
          <div key={workspace.workspaceId} className="rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-950">{workspace.workspaceName}</p>
                <p className="text-xs text-slate-500">Plan: {workspace.planKey}</p>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {workspace.features.map((feature) => (
                <div key={feature.key} className="rounded-lg bg-slate-50 p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-slate-900">{feature.label}</span>
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${feature.enabledForOwners ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {feature.enabledForOwners ? "Owner access" : "Blocked"}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-600">Entitlement: {feature.entitlement.enabled ? "on" : "off"} | Flags: {feature.flags.map((flag) => `${flag.key} ${flag.enabled ? "on" : "off"}`).join(", ")}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function FeatureAccessSummary({ data }: { data: AdminAccessData }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Feature Access Registry</h2>
      <div className="mt-4 space-y-3">
        {data.definitions.featureAccess.map((definition) => (
          <div key={definition.key} className="rounded-lg border border-slate-200 p-3">
            <p className="font-semibold text-slate-950">{definition.label}</p>
            <p className="mt-1 text-sm text-slate-600">{definition.description}</p>
            <div className="mt-3 space-y-2 text-xs text-slate-600">
              <p className="flex items-center gap-2"><Layers3 className="h-3.5 w-3.5" /> Entitlement: {definition.entitlement}</p>
              <p className="flex items-center gap-2"><Flag className="h-3.5 w-3.5" /> Flags: {definition.flags.join(", ") || "none"}</p>
              <p className="flex items-center gap-2"><KeyRound className="h-3.5 w-3.5" /> Permissions: {definition.permissions.join(", ") || "none"}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function RoleCard({ role, definition }: { role: string; definition: RoleDefinition }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-slate-950">{definition.label}</p>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{role}</span>
      </div>
      {definition.inherits.length > 0 && <p className="mt-2 text-xs text-slate-500">Inherits: {definition.inherits.join(", ")}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {definition.permissions.map((permission) => (
          <span key={permission} className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">{permission}</span>
        ))}
      </div>
    </div>
  )
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return (
    <button type="button" className="flex items-center gap-2 text-sm font-semibold text-slate-700" onClick={() => onChange(!checked)}>
      <span className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-slate-950" : "bg-slate-200"}`}>
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${checked ? "left-6" : "left-1"}`} />
      </span>
      {label}
    </button>
  )
}

const inputClass = "h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
const thClass = "px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500"
