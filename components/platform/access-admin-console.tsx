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
  id: string
  plan_key: string
  name: string
  description: string | null
  status: string
  price_monthly: number | null
  price_yearly: number | null
  currency: string
  stripe_product_id: string | null
  stripe_monthly_price_id: string | null
  stripe_yearly_price_id: string | null
  display_order: number
  is_featured: boolean
  badge_text: string | null
  trial_days: number
  active: boolean
}

interface PlanFeatureRow {
  plan_key: string
  plan_id: string | null
  feature_key: string | null
  feature_id: string | null
  enabled: boolean | null
  is_included: boolean | null
}

interface PlanLimitRow {
  plan_key: string
  plan_id: string | null
  limit_key: string | null
  limit_type_id: string | null
  limit_value: string
  is_unlimited: boolean | null
}

interface FeatureRegistryRow {
  id: string
  feature_key: string
  feature_name: string
  description: string | null
  category: string
  display_order: number
  icon: string | null
  is_active: boolean
}

interface LimitTypeRow {
  id: string
  limit_key: string
  limit_name: string
  description: string | null
  category: string
  unit: string
  unit_label: string | null
  is_unlimited_available: boolean
  overage_enabled: boolean
  overage_unit_price: number | null
  display_order: number
  icon: string | null
  is_active: boolean
}

interface WorkspacePlanRow {
  id: string
  workspace_id: string
  plan_id: string | null
  plan_key: string
  billing_cycle: string
  status: string
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
      featureRegistry: FeatureRegistryRow[]
      limitTypes: LimitTypeRow[]
      plans: PlanRow[]
      workspacePlans: WorkspacePlanRow[]
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
  const features = useMemo(() => {
    if (data.data.featureRegistry.length > 0) return data.data.featureRegistry
    return data.definitions.features.map((feature, index) => ({
      id: "",
      feature_key: feature.key,
      feature_name: feature.label,
      description: null,
      category: "Config",
      display_order: index,
      icon: null,
      is_active: true
    }))
  }, [data])
  const limits = useMemo(() => {
    if (data.data.limitTypes.length > 0) return data.data.limitTypes
    return data.definitions.limits.map((limit, index) => ({
      id: "",
      limit_key: limit.key,
      limit_name: limit.label,
      description: null,
      category: "Config",
      unit: "count",
      unit_label: null,
      is_unlimited_available: true,
      overage_enabled: false,
      overage_unit_price: null,
      display_order: index,
      icon: null,
      is_active: true
    }))
  }, [data])

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-2">
        <FeatureRegistryPanel features={data.data.featureRegistry} mutate={mutate} />
        <LimitTypesPanel limits={data.data.limitTypes} mutate={mutate} />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Plans</h2>
            <p className="mt-1 text-sm text-slate-600">Create any plan shape you need, then attach features and limits from the registries.</p>
          </div>
          <form
            className="grid gap-2 md:grid-cols-[10rem_14rem_8rem_auto]"
            onSubmit={(event) => {
              event.preventDefault()
              const form = new FormData(event.currentTarget)
              void mutate({
                action: "upsertPlan",
                planKey,
                name: planName,
                status: String(form.get("status") || "draft"),
                active: form.get("status") !== "archived"
              }, "Plan saved")
              setPlanKey("")
              setPlanName("")
            }}
          >
            <input className={inputClass} placeholder="plan_key" value={planKey} onChange={(event) => setPlanKey(event.target.value)} required />
            <input className={inputClass} placeholder="Plan name" value={planName} onChange={(event) => setPlanName(event.target.value)} required />
            <select name="status" className={inputClass} defaultValue="draft">
              <option value="draft">draft</option>
              <option value="active">active</option>
              <option value="legacy">legacy</option>
              <option value="archived">archived</option>
            </select>
            <Button type="submit">Create Plan</Button>
          </form>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {data.data.plans.map((plan) => (
            <div key={plan.plan_key} className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-950">{plan.name}</p>
                  <p className="text-sm text-slate-500">{plan.plan_key}</p>
                  <p className="mt-1 text-xs text-slate-500">{plan.description || "No description"}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${plan.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {plan.status || (plan.active ? "active" : "inactive")}
                </span>
              </div>
              <form
                className="mt-4 grid gap-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  const form = new FormData(event.currentTarget)
                  void mutate({
                    action: "upsertPlan",
                    planKey: plan.plan_key,
                    name: String(form.get("name")),
                    description: String(form.get("description") || ""),
                    status: String(form.get("status")),
                    priceMonthly: form.get("priceMonthly") ? Number(form.get("priceMonthly")) : null,
                    priceYearly: form.get("priceYearly") ? Number(form.get("priceYearly")) : null,
                    currency: String(form.get("currency") || "usd"),
                    stripeProductId: String(form.get("stripeProductId") || ""),
                    stripeMonthlyPriceId: String(form.get("stripeMonthlyPriceId") || ""),
                    stripeYearlyPriceId: String(form.get("stripeYearlyPriceId") || ""),
                    displayOrder: Number(form.get("displayOrder") || 0),
                    badgeText: String(form.get("badgeText") || ""),
                    trialDays: Number(form.get("trialDays") || 0),
                    active: form.get("status") !== "archived",
                    isFeatured: form.get("isFeatured") === "on"
                  }, "Plan updated")
                }}
              >
                <input name="name" className={inputClass} defaultValue={plan.name} />
                <input name="description" className={inputClass} placeholder="Description" defaultValue={plan.description || ""} />
                <div className="grid grid-cols-2 gap-2">
                  <select name="status" className={inputClass} defaultValue={plan.status || "active"}>
                    <option value="draft">draft</option>
                    <option value="active">active</option>
                    <option value="legacy">legacy</option>
                    <option value="archived">archived</option>
                  </select>
                  <input name="currency" className={inputClass} defaultValue={plan.currency || "usd"} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input name="priceMonthly" className={inputClass} type="number" step="0.01" placeholder="Monthly $" defaultValue={plan.price_monthly ?? ""} />
                  <input name="priceYearly" className={inputClass} type="number" step="0.01" placeholder="Yearly $" defaultValue={plan.price_yearly ?? ""} />
                </div>
                <input name="stripeProductId" className={inputClass} placeholder="Stripe product ID" defaultValue={plan.stripe_product_id || ""} />
                <div className="grid grid-cols-2 gap-2">
                  <input name="stripeMonthlyPriceId" className={inputClass} placeholder="Monthly price ID" defaultValue={plan.stripe_monthly_price_id || ""} />
                  <input name="stripeYearlyPriceId" className={inputClass} placeholder="Yearly price ID" defaultValue={plan.stripe_yearly_price_id || ""} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input name="displayOrder" className={inputClass} type="number" placeholder="Order" defaultValue={plan.display_order || 0} />
                  <input name="trialDays" className={inputClass} type="number" placeholder="Trial days" defaultValue={plan.trial_days || 0} />
                  <input name="badgeText" className={inputClass} placeholder="Badge" defaultValue={plan.badge_text || ""} />
                </div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input name="isFeatured" type="checkbox" defaultChecked={plan.is_featured} />
                  Featured
                </label>
                <Button type="submit" variant="secondary">Save Plan</Button>
              </form>
              <div className="mt-4 flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => mutate({ action: "upsertPlan", planKey: plan.plan_key, name: plan.name, status: plan.status === "active" ? "draft" : "active", active: plan.status !== "active", stripeMonthlyPriceId: plan.stripe_monthly_price_id, stripeYearlyPriceId: plan.stripe_yearly_price_id })}
                >
                  {plan.status === "active" ? "Move to Draft" : "Activate"}
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
              {features.map((feature) => (
                <tr key={feature.feature_key}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{feature.feature_name}</p>
                    <p className="text-xs text-slate-500">{feature.feature_key}</p>
                  </td>
                  {data.data.plans.map((plan) => {
                    const configFeature = data.definitions.features.find((item) => item.key === feature.feature_key)
                    const row = data.data.planFeatures.find((item) => item.plan_key === plan.plan_key && (item.feature_key === feature.feature_key || item.feature_id === feature.id))
                    const enabled = row?.is_included ?? row?.enabled ?? configFeature?.defaultEnabled ?? false
                    return (
                      <td className="px-4 py-3" key={`${plan.plan_key}-${feature.feature_key}`}>
                        <Toggle
                          checked={enabled}
                          label={enabled ? "On" : "Off"}
                          onChange={(next) => mutate({ action: "setPlanFeature", planKey: plan.plan_key, featureKey: feature.feature_key, featureId: feature.id || null, enabled: next })}
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
          {limits.map((limit) => (
            <div key={limit.limit_key} className="rounded-lg border border-slate-200 p-4">
              <p className="font-semibold text-slate-950">{limit.limit_name}</p>
              <p className="text-xs text-slate-500">{limit.limit_key}</p>
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                {data.data.plans.map((plan) => {
                  const configLimit = data.definitions.limits.find((item) => item.key === limit.limit_key)
                  const row = data.data.planLimits.find((item) => item.plan_key === plan.plan_key && (item.limit_key === limit.limit_key || item.limit_type_id === limit.id))
                  return (
                    <form
                      key={`${plan.plan_key}-${limit.limit_key}`}
                      className="flex gap-2"
                      onSubmit={(event) => {
                        event.preventDefault()
                        const form = new FormData(event.currentTarget)
                        void mutate({ action: "setPlanLimit", planKey: plan.plan_key, limitKey: limit.limit_key, limitTypeId: limit.id || null, limitValue: String(form.get("value") || ""), isUnlimited: form.get("value") === "unlimited" }, "Limit saved")
                      }}
                    >
                      <label className="sr-only">{plan.name}</label>
                      <input name="value" className={inputClass} defaultValue={row?.is_unlimited ? "unlimited" : row?.limit_value ?? String(configLimit?.defaultValue ?? 0)} />
                      <Button type="submit" variant="secondary">Save</Button>
                    </form>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <WorkspacePlanAssignments data={data} mutate={mutate} />
      <WorkspaceOverrides data={data} mutate={mutate} />
      <DiagnosticsPanel data={data} />
    </div>
  )
}

function FeatureRegistryPanel({ features, mutate }: { features: FeatureRegistryRow[]; mutate: (payload: Record<string, unknown>, success?: string) => Promise<void> }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Feature Registry</h2>
      <p className="mt-1 text-sm text-slate-600">The master catalog of sellable capabilities. Plans reference these features.</p>
      <form
        className="mt-4 grid gap-2 md:grid-cols-[1fr_1fr_10rem_auto]"
        onSubmit={(event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          void mutate({
            action: "upsertFeatureRegistry",
            featureKey: String(form.get("featureKey")),
            featureName: String(form.get("featureName")),
            category: String(form.get("category") || "General"),
            displayOrder: Number(form.get("displayOrder") || 0),
            isActive: true
          }, "Feature saved")
          event.currentTarget.reset()
        }}
      >
        <input name="featureKey" className={inputClass} placeholder="feature_key" required />
        <input name="featureName" className={inputClass} placeholder="Feature name" required />
        <input name="category" className={inputClass} placeholder="Category" />
        <Button type="submit">Add Feature</Button>
        <input name="displayOrder" className={`${inputClass} md:col-span-1`} type="number" placeholder="Display order" />
      </form>
      <div className="mt-4 space-y-3">
        {features.map((feature) => (
          <form
            key={feature.id}
            className="grid gap-2 rounded-lg border border-slate-200 p-3 md:grid-cols-[1fr_1fr_10rem_7rem_auto]"
            onSubmit={(event) => {
              event.preventDefault()
              const form = new FormData(event.currentTarget)
              void mutate({
                action: "upsertFeatureRegistry",
                id: feature.id,
                featureKey: String(form.get("featureKey")),
                featureName: String(form.get("featureName")),
                description: String(form.get("description") || ""),
                category: String(form.get("category") || "General"),
                displayOrder: Number(form.get("displayOrder") || 0),
                isActive: form.get("isActive") === "on"
              }, "Feature updated")
            }}
          >
            <input name="featureKey" className={inputClass} defaultValue={feature.feature_key} />
            <input name="featureName" className={inputClass} defaultValue={feature.feature_name} />
            <input name="category" className={inputClass} defaultValue={feature.category} />
            <input name="displayOrder" className={inputClass} type="number" defaultValue={feature.display_order || 0} />
            <Button type="submit" variant="secondary">Save</Button>
            <input name="description" className={`${inputClass} md:col-span-3`} placeholder="Description" defaultValue={feature.description || ""} />
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input name="isActive" type="checkbox" defaultChecked={feature.is_active} />
              Active
            </label>
            <Button type="button" variant="danger" onClick={() => mutate({ action: "deleteFeatureRegistry", id: feature.id }, "Feature archived")}>
              Archive
            </Button>
          </form>
        ))}
      </div>
    </section>
  )
}

function LimitTypesPanel({ limits, mutate }: { limits: LimitTypeRow[]; mutate: (payload: Record<string, unknown>, success?: string) => Promise<void> }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Limit Types</h2>
      <p className="mt-1 text-sm text-slate-600">Define reusable meters like seats, responses, reports, or webhook deliveries.</p>
      <form
        className="mt-4 grid gap-2 md:grid-cols-[1fr_1fr_8rem_auto]"
        onSubmit={(event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          void mutate({
            action: "upsertLimitType",
            limitKey: String(form.get("limitKey")),
            limitName: String(form.get("limitName")),
            unit: String(form.get("unit") || "count"),
            category: String(form.get("category") || "General"),
            isActive: true
          }, "Limit type saved")
          event.currentTarget.reset()
        }}
      >
        <input name="limitKey" className={inputClass} placeholder="limit_key" required />
        <input name="limitName" className={inputClass} placeholder="Limit name" required />
        <input name="unit" className={inputClass} placeholder="Unit" />
        <Button type="submit">Add Limit</Button>
        <input name="category" className={inputClass} placeholder="Category" />
      </form>
      <div className="mt-4 space-y-3">
        {limits.map((limit) => (
          <form
            key={limit.id}
            className="grid gap-2 rounded-lg border border-slate-200 p-3 md:grid-cols-[1fr_1fr_8rem_8rem_auto]"
            onSubmit={(event) => {
              event.preventDefault()
              const form = new FormData(event.currentTarget)
              void mutate({
                action: "upsertLimitType",
                id: limit.id,
                limitKey: String(form.get("limitKey")),
                limitName: String(form.get("limitName")),
                description: String(form.get("description") || ""),
                category: String(form.get("category") || "General"),
                unit: String(form.get("unit") || "count"),
                unitLabel: String(form.get("unitLabel") || ""),
                displayOrder: Number(form.get("displayOrder") || 0),
                isActive: form.get("isActive") === "on"
              }, "Limit type updated")
            }}
          >
            <input name="limitKey" className={inputClass} defaultValue={limit.limit_key} />
            <input name="limitName" className={inputClass} defaultValue={limit.limit_name} />
            <input name="unit" className={inputClass} defaultValue={limit.unit} />
            <input name="unitLabel" className={inputClass} placeholder="Unit label" defaultValue={limit.unit_label || ""} />
            <Button type="submit" variant="secondary">Save</Button>
            <input name="category" className={inputClass} defaultValue={limit.category} />
            <input name="displayOrder" className={inputClass} type="number" defaultValue={limit.display_order || 0} />
            <input name="description" className={`${inputClass} md:col-span-2`} placeholder="Description" defaultValue={limit.description || ""} />
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input name="isActive" type="checkbox" defaultChecked={limit.is_active} />
              Active
            </label>
            <Button type="button" variant="danger" onClick={() => mutate({ action: "deleteLimitType", id: limit.id }, "Limit archived")}>
              Archive
            </Button>
          </form>
        ))}
      </div>
    </section>
  )
}

function WorkspacePlanAssignments({ data, mutate }: { data: AdminAccessData; mutate: (payload: Record<string, unknown>, success?: string) => Promise<void> }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Workspace Plan Assignments</h2>
      <p className="mt-1 text-sm text-slate-600">Assign the active plan per workspace without hardcoding tiers.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {data.data.workspaces.map((workspace) => {
          const assignment = data.data.workspacePlans.find((item) => item.workspace_id === workspace.id)
          const currentPlanKey = assignment?.plan_key || workspace.plan_key
          return (
            <form
              key={workspace.id}
              className="grid gap-3 rounded-lg border border-slate-200 p-4 md:grid-cols-[1fr_10rem_9rem_auto]"
              onSubmit={(event) => {
                event.preventDefault()
                const form = new FormData(event.currentTarget)
                const plan = data.data.plans.find((item) => item.plan_key === form.get("planKey"))
                void mutate({
                  action: "setWorkspacePlan",
                  workspaceId: workspace.id,
                  planKey: String(form.get("planKey")),
                  planId: plan?.id || null,
                  billingCycle: String(form.get("billingCycle") || "monthly"),
                  status: String(form.get("status") || "active")
                }, "Workspace plan saved")
              }}
            >
              <div>
                <p className="font-semibold text-slate-950">{workspace.name}</p>
                <p className="text-xs text-slate-500">{workspace.slug}</p>
              </div>
              <select name="planKey" className={inputClass} defaultValue={currentPlanKey}>
                {data.data.plans.map((plan) => <option key={plan.plan_key} value={plan.plan_key}>{plan.name}</option>)}
              </select>
              <select name="billingCycle" className={inputClass} defaultValue={assignment?.billing_cycle || "monthly"}>
                <option value="monthly">monthly</option>
                <option value="yearly">yearly</option>
                <option value="manual">manual</option>
              </select>
              <select name="status" className={inputClass} defaultValue={assignment?.status || "active"}>
                <option value="active">active</option>
                <option value="trialing">trialing</option>
                <option value="past_due">past_due</option>
                <option value="canceled">canceled</option>
              </select>
              <Button type="submit" variant="secondary">Save</Button>
            </form>
          )
        })}
      </div>
    </section>
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
