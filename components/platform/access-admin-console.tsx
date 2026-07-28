"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertCircle, Check, ChevronDown, ChevronRight, DollarSign, Edit3, Flag, Gauge, KeyRound, Layers3, Loader2, Package, Plus, RefreshCw, Shield, ShoppingCart, SlidersHorizontal, Trash2, Users, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { AppShellConfig, FeatureAccessDefinition, FeatureDefinition, LimitDefinition, RoleDefinition } from "@/lib/platform/types"
import type { PlanBillingType } from "@/lib/platform/billing-logic"

type ConsoleMode = "flags" | "entitlements" | "permissions" | "plans" | "plan-detail"

interface AccessAdminConsoleProps {
  mode: ConsoleMode
  planId?: string
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
  billing_type: PlanBillingType
  description: string | null
  status: string
  price_monthly: number | null
  price_yearly: number | null
  currency: string
  stripe_product_id: string | null
  stripe_monthly_price_id: string | null
  stripe_yearly_price_id: string | null
  stripe_sync_status: string
  stripe_sync_error: string | null
  stripe_synced_at: string | null
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
  overage_enabled: boolean | null
  overage_price: number | null
}

interface FeatureRegistryRow {
  id: string
  feature_key: string
  feature_name: string
  description: string | null
  category: string
  display_order: number
  icon: string | null
  purchase_type: string
  locked_behavior: string
  associated_flags: string[]
  required_permissions: string[]
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
  operationWarning?: string | null
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

export function AccessAdminConsole({ mode, planId }: AccessAdminConsoleProps) {
  const router = useRouter()
  const [data, setData] = useState<AdminAccessData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setWarning(null)
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

  async function mutate(payload: Record<string, unknown>, success = "Saved", options?: { refreshShell?: boolean }) {
    setSaving(true)
    setMessage(null)
    setWarning(null)
    setError(null)
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 30_000)
    try {
      const response = await fetch("/api/platform/admin/access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(json.error || "Unable to save changes.")
        return
      }
      setData(json)
      if (json.operationWarning) {
        setWarning(json.operationWarning)
      } else {
        setMessage(success)
      }
      if (options?.refreshShell) {
        router.refresh()
      }
    } catch (requestError) {
      setError(requestError instanceof DOMException && requestError.name === "AbortError"
        ? "The request timed out while contacting Stripe. Your plan changes may have saved locally; refresh to check the sync status."
        : "The request could not be completed. Check your connection and try again.")
    } finally {
      window.clearTimeout(timeout)
      setSaving(false)
    }
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
      {(message || warning || error) && (
        <div className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : warning ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {error || warning ? <AlertCircle className="h-4 w-4" /> : <Check className="h-4 w-4" />}
          {error || warning || message}
        </div>
      )}

      {mode === "flags" && <FlagsPanel data={data} mutate={mutate} />}
      {mode === "entitlements" && <EntitlementsPanel data={data} mutate={mutate} />}
      {mode === "plans" && <PlansPanel data={data} mutate={mutate} />}
      {mode === "plan-detail" && <PlanDetailPanel data={data} mutate={mutate} planId={planId || ""} saving={saving} />}
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
      title: "Entitlements Registry",
      description: "Manage the master catalog of features and limits. Plans package these records for customers."
    },
    plans: {
      icon: Layers3,
      title: "Plan Management",
      description: "Create plans, edit packaging, attach features and limits, and assign plans to workspaces."
    },
    "plan-detail": {
      icon: Layers3,
      title: "Edit Plan",
      description: "Manage plan details, pricing, Stripe IDs, included features, and usage limits."
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
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="space-y-5">
        <FeatureRegistryPanel data={data} mutate={mutate} />
        <LimitTypesPanel limits={data.data.limitTypes} mutate={mutate} />
        <WorkspaceOverrides data={data} mutate={mutate} />
      </div>

      <aside className="space-y-4">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">How This Fits</h2>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <p><span className="font-semibold text-slate-950">Plans</span> are customer-facing packages.</p>
            <p><span className="font-semibold text-slate-950">Entitlements</span> are the master features and limit meters plans can include.</p>
            <p><span className="font-semibold text-slate-950">Flags</span> are rollout switches. They should not be the source of truth for billing ownership.</p>
          </div>
          <Link href="/admin/plans" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
            Manage Plans
            <ChevronRight className="h-4 w-4" />
          </Link>
        </section>
        <FeatureAccessSummary data={data} />
        <DiagnosticsPanel data={data} />
      </aside>
    </div>
  )
}

function PlansPanel({ data, mutate }: { data: AdminAccessData; mutate: (payload: Record<string, unknown>, success?: string) => Promise<void> }) {
  const [statusFilter, setStatusFilter] = useState("all")
  const [planKey, setPlanKey] = useState("")
  const [planName, setPlanName] = useState("")
  const statuses = ["all", "active", "legacy", "draft", "archived"]
  const filteredPlans = data.data.plans
    .filter((plan) => statusFilter === "all" || normalizedPlanStatus(plan) === statusFilter)
    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0) || a.name.localeCompare(b.name))

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Plans</h2>
            <p className="mt-1 text-sm text-slate-600">Create any package shape you need, then edit the included entitlements and limits on the plan detail page.</p>
          </div>
          <form
            className="grid gap-2 md:grid-cols-[10rem_14rem_9rem_8rem_auto]"
            onSubmit={(event) => {
              event.preventDefault()
              const form = new FormData(event.currentTarget)
              void mutate({
                action: "upsertPlan",
                planKey,
                name: planName,
                billingType: String(form.get("billingType") || "paid"),
                status: String(form.get("status") || "draft"),
                active: form.get("status") !== "archived"
              }, "Plan created")
              setPlanKey("")
              setPlanName("")
            }}
          >
            <input className={inputClass} placeholder="plan_key" value={planKey} onChange={(event) => setPlanKey(event.target.value)} required />
            <input className={inputClass} placeholder="Plan name" value={planName} onChange={(event) => setPlanName(event.target.value)} required />
            <select name="billingType" className={inputClass} defaultValue="paid" aria-label="Billing type">
              <option value="paid">Paid</option>
              <option value="free">Free</option>
              <option value="grant_only">Grant only</option>
            </select>
            <select name="status" className={inputClass} defaultValue="draft">
              <option value="draft">draft</option>
              <option value="active">active</option>
              <option value="legacy">legacy</option>
              <option value="archived">archived</option>
            </select>
            <Button type="submit">
              <Plus className="h-4 w-4" />
              New Plan
            </Button>
          </form>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-500">Filter:</span>
          {statuses.map((status) => (
            <button
              key={status}
              type="button"
              className={`rounded-full px-3 py-2 text-sm font-semibold transition ${statusFilter === status ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              onClick={() => setStatusFilter(status)}
            >
              {statusLabel(status)} ({status === "all" ? data.data.plans.length : data.data.plans.filter((plan) => normalizedPlanStatus(plan) === status).length})
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        {filteredPlans.map((plan) => {
          const workspaceCount = countPlanWorkspaces(data, plan)
          return (
            <div key={plan.plan_key} className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[2rem_minmax(0,1fr)_auto_auto] md:items-center">
              <Link href={`/admin/plans/${encodeURIComponent(plan.id || plan.plan_key)}`} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-950" aria-label={`Edit ${plan.name}`}>
                <ChevronRight className="h-5 w-5" />
              </Link>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-slate-950">{plan.name}</h3>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusBadgeClass(normalizedPlanStatus(plan))}`}>{normalizedPlanStatus(plan)}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{billingTypeLabel(plan.billing_type)}</span>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${stripeSyncBadgeClass(plan.stripe_sync_status)}`} title={plan.stripe_sync_error || undefined}>
                    Stripe: {plan.stripe_sync_status.replaceAll("_", " ")}
                  </span>
                  {plan.badge_text && <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">{plan.badge_text}</span>}
                  {plan.is_featured && <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">Featured</span>}
                </div>
                <p className="text-sm text-slate-500">{plan.plan_key}</p>
                {plan.description && <p className="mt-1 text-sm text-slate-600">{plan.description}</p>}
              </div>
              <div className="flex items-center gap-6 text-sm text-slate-600">
                <div className="text-right">
                  <p className="flex items-center justify-end gap-1 font-semibold text-slate-950"><DollarSign className="h-4 w-4 text-slate-400" /> {formatPrice(plan.price_monthly, plan.currency)}/mo</p>
                  <p>{formatPrice(plan.price_yearly, plan.currency)}/yr</p>
                </div>
                <div className="flex items-center gap-1 font-semibold">
                  <Users className="h-4 w-4" />
                  {workspaceCount}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link href={`/admin/plans/${encodeURIComponent(plan.id || plan.plan_key)}`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  <Edit3 className="h-4 w-4" />
                  Edit
                </Link>
                <Button variant="danger" onClick={() => mutate({ action: "deletePlan", planKey: plan.plan_key }, "Plan archived")}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )
        })}
      </section>

      <WorkspacePlanAssignments data={data} mutate={mutate} />
    </div>
  )
}

function PlanDetailPanel({ data, mutate, planId, saving }: { data: AdminAccessData; mutate: (payload: Record<string, unknown>, success?: string) => Promise<void>; planId: string; saving: boolean }) {
  const decodedPlanId = decodeURIComponent(planId)
  const plan = data.data.plans.find((item) => item.id === decodedPlanId || item.plan_key === decodedPlanId)
  const features = getFeatureRows(data)
  const limits = getLimitRows(data)
  const groupedFeatures = groupByCategory(features, (feature) => feature.category)
  const groupedLimits = groupByCategory(limits, (limit) => limit.category)
  const [editingFeature, setEditingFeature] = useState<FeatureRegistryRow | null>(null)
  const flagOptions = useMemo(() => getFlagOptions(data), [data])
  const permissionOptions = useMemo(() => getPermissionOptions(data), [data])

  if (!plan) {
    return (
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-800">
        <h2 className="font-semibold">Plan not found</h2>
        <p className="mt-1 text-sm">The plan identifier could not be matched. Return to plan management and choose a current plan.</p>
        <Link href="/admin/plans" className="mt-4 inline-flex items-center gap-2 font-semibold text-amber-900">
          <ChevronRight className="h-4 w-4 rotate-180" />
          Back to Plans
        </Link>
      </section>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link href="/admin/plans" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950">
          <ChevronRight className="h-4 w-4 rotate-180" />
          Back to Plans
        </Link>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${statusBadgeClass(normalizedPlanStatus(plan))}`}>{normalizedPlanStatus(plan)}</span>
      </div>

      <form
        className="grid gap-5 xl:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          void mutate({
            action: "upsertPlan",
            planKey: plan.plan_key,
            name: String(form.get("name")),
            billingType: String(form.get("billingType")),
            description: String(form.get("description") || ""),
            status: String(form.get("status")),
            priceMonthly: form.get("priceMonthly") ? Number(form.get("priceMonthly")) : null,
            priceYearly: form.get("priceYearly") ? Number(form.get("priceYearly")) : null,
            currency: String(form.get("currency") || "usd"),
            displayOrder: Number(form.get("displayOrder") || 0),
            badgeText: String(form.get("badgeText") || ""),
            trialDays: Number(form.get("trialDays") || 0),
            active: form.get("status") !== "archived",
            isFeatured: form.get("isFeatured") === "on"
          }, "Plan updated")
        }}
      >
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Basic Information</h2>
          <div className="mt-4 grid gap-3">
            <label className="space-y-1 text-sm font-semibold text-slate-700">
              Plan Name
              <input name="name" className={inputClass} defaultValue={plan.name} required />
            </label>
            <label className="space-y-1 text-sm font-semibold text-slate-700">
              Plan Key
              <input className={inputClass} value={plan.plan_key} readOnly />
            </label>
            <label className="space-y-1 text-sm font-semibold text-slate-700">
              Description
              <textarea name="description" className={`${inputClass} min-h-24 py-3`} defaultValue={plan.description || ""} />
            </label>
            <div className="grid gap-3 md:grid-cols-4">
              <label className="space-y-1 text-sm font-semibold text-slate-700">
                Status
                <select name="status" className={inputClass} defaultValue={plan.status || "active"}>
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="legacy">Legacy</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <label className="space-y-1 text-sm font-semibold text-slate-700">
                Billing Type
                <select name="billingType" className={inputClass} defaultValue={plan.billing_type || "paid"}>
                  <option value="paid">Paid</option>
                  <option value="free">Free</option>
                  <option value="grant_only">Grant only</option>
                </select>
              </label>
              <label className="space-y-1 text-sm font-semibold text-slate-700">
                Display Order
                <input name="displayOrder" className={inputClass} type="number" defaultValue={plan.display_order || 0} />
              </label>
              <label className="space-y-1 text-sm font-semibold text-slate-700">
                Trial Days
                <input name="trialDays" className={inputClass} type="number" defaultValue={plan.trial_days || 0} />
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <label className="space-y-1 text-sm font-semibold text-slate-700">
                Badge Text
                <input name="badgeText" className={inputClass} placeholder="Most Popular" defaultValue={plan.badge_text || ""} />
              </label>
              <label className="flex h-11 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700">
                <input name="isFeatured" type="checkbox" defaultChecked={plan.is_featured} />
                Featured Plan
              </label>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Pricing</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <label className="space-y-1 text-sm font-semibold text-slate-700">
                Monthly Price
                <input name="priceMonthly" className={inputClass} type="number" step="0.01" defaultValue={plan.price_monthly ?? ""} />
              </label>
              <label className="space-y-1 text-sm font-semibold text-slate-700">
                Annual Price
                <input name="priceYearly" className={inputClass} type="number" step="0.01" defaultValue={plan.price_yearly ?? ""} />
              </label>
              <label className="space-y-1 text-sm font-semibold text-slate-700">
                Currency
                <input name="currency" className={inputClass} defaultValue={plan.currency || "usd"} />
              </label>
            </div>
            <p className="mt-3 text-xs text-slate-500">Free plans are available without payment. Grant-only plans can be assigned by an administrator. Only paid plans use these prices and Stripe.</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Stripe Integration</h2>
                <p className="mt-1 text-sm text-slate-600">Saving an active paid plan automatically synchronizes its Product and recurring Prices. Changed Prices are replaced and archived.</p>
              </div>
              <Button
                type="button"
                variant="secondary"
                disabled={saving || plan.billing_type !== "paid"}
                onClick={() => mutate({ action: "syncStripePlan", planKey: plan.plan_key }, "Stripe catalog synchronized")}
              >
                <RefreshCw className={`h-4 w-4 ${saving ? "animate-spin" : ""}`} />
                {saving ? "Syncing..." : plan.billing_type === "paid" ? "Sync with Stripe" : "Stripe not required"}
              </Button>
            </div>
            <div className={`mt-4 rounded-lg border p-3 text-sm ${stripeSyncPanelClass(plan.stripe_sync_status)}`}>
              <p className="font-semibold">Status: {plan.stripe_sync_status.replaceAll("_", " ")}</p>
              {plan.stripe_sync_error && <p className="mt-1">{plan.stripe_sync_error}</p>}
              {plan.stripe_synced_at && <p className="mt-1 text-xs opacity-75">Last synchronized {new Date(plan.stripe_synced_at).toLocaleString()}</p>}
            </div>
            <div className="mt-4 grid gap-3">
              <input className={inputClass} aria-label="Stripe product ID" placeholder="Stripe product ID" value={plan.stripe_product_id || ""} readOnly />
              <div className="grid gap-3 md:grid-cols-2">
                <input className={inputClass} aria-label="Stripe monthly price ID" placeholder="Monthly price ID" value={plan.stripe_monthly_price_id || ""} readOnly />
                <input className={inputClass} aria-label="Stripe annual price ID" placeholder="Annual price ID" value={plan.stripe_yearly_price_id || ""} readOnly />
              </div>
              <p className="text-xs text-slate-500">Stripe IDs are managed by SurveyFlow. Free and grant-only plans stay local; draft, legacy, and archived plans are unavailable for new Stripe purchases.</p>
            </div>
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? "Saving and syncing..." : "Save Changes"}
          </Button>
        </section>
      </form>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Features</h2>
            <p className="mt-1 text-sm text-slate-600">Toggle which registry features are included in this plan.</p>
          </div>
          <Link href="/admin/entitlements" className="text-sm font-semibold text-slate-600 hover:text-slate-950">Edit Registry</Link>
        </div>
        <div className="mt-4 space-y-3">
          {Object.entries(groupedFeatures).map(([category, categoryFeatures]) => (
            <div key={category} className="overflow-hidden rounded-lg border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-950">{category}</div>
              <div>
                {categoryFeatures.map((feature) => {
                  const row = data.data.planFeatures.find((item) => item.plan_key === plan.plan_key && (item.feature_key === feature.feature_key || item.feature_id === feature.id))
                  const enabled = row?.is_included ?? row?.enabled ?? false
                  return (
                    <div key={feature.feature_key} className="grid gap-3 border-b border-slate-100 px-3 py-2 last:border-b-0 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-950">{feature.feature_name}</p>
                        <p className="text-xs text-slate-500">{feature.feature_key}</p>
                        {feature.description && <p className="mt-1 text-sm text-slate-600">{feature.description}</p>}
                      </div>
                      <Toggle
                        checked={enabled}
                        label={enabled ? "Included" : "Off"}
                        onChange={(next) => mutate({ action: "setPlanFeature", planKey: plan.plan_key, featureKey: feature.feature_key, featureId: feature.id || null, enabled: next }, "Feature updated")}
                      />
                      <button type="button" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-950" onClick={() => setEditingFeature(feature)} aria-label={`Edit ${feature.feature_name}`}>
                        <Edit3 className="h-4 w-4" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
      {editingFeature && (
        <FeatureRegistryModal
          feature={editingFeature}
          featureAccess={data.definitions.featureAccess}
          flagOptions={flagOptions}
          permissionOptions={permissionOptions}
          isNew={false}
          onClose={() => setEditingFeature(null)}
          onSave={async (payload) => {
            await mutate(payload, "Feature updated")
            setEditingFeature(null)
          }}
          onArchive={async (id) => {
            await mutate({ action: "deleteFeatureRegistry", id }, "Feature archived")
            setEditingFeature(null)
          }}
        />
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <Gauge className="mt-0.5 h-5 w-5 text-slate-950" />
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Limits</h2>
            <p className="mt-1 text-sm text-slate-600">Set limit values and overage pricing for this plan.</p>
          </div>
        </div>
        <div className="mt-5 space-y-4">
          {Object.entries(groupedLimits).map(([category, categoryLimits]) => (
            <div key={category} className="rounded-lg border border-slate-200">
              <div className="px-4 py-4 text-lg font-semibold text-slate-950">{category}</div>
              <div className="space-y-3 p-4 pt-0">
                {categoryLimits.map((limit) => {
                  const configLimit = data.definitions.limits.find((item) => item.key === limit.limit_key)
                  const row = data.data.planLimits.find((item) => item.plan_key === plan.plan_key && (item.limit_key === limit.limit_key || item.limit_type_id === limit.id))
                  return (
                    <form
                      key={limit.limit_key}
                      className="grid gap-3 rounded-lg border border-slate-200 p-4 md:grid-cols-[minmax(12rem,1fr)_10rem_auto_auto_auto_auto] md:items-center"
                      onSubmit={(event) => {
                        event.preventDefault()
                        const form = new FormData(event.currentTarget)
                        const isUnlimited = form.get("isUnlimited") === "on"
                        const overageEnabled = form.get("overageEnabled") === "on"
                        void mutate({
                          action: "setPlanLimit",
                          planKey: plan.plan_key,
                          limitKey: limit.limit_key,
                          limitTypeId: limit.id || null,
                          limitValue: isUnlimited ? "unlimited" : String(form.get("value") || ""),
                          isUnlimited,
                          overageEnabled,
                          overagePrice: overageEnabled && form.get("overagePrice") ? Number(form.get("overagePrice")) : null
                        }, "Limit saved")
                      }}
                    >
                      <div>
                        <p className="font-semibold text-slate-950">{limit.limit_name}</p>
                        <p className="text-xs text-slate-500">{limit.limit_key}{limit.unit_label ? ` | ${limit.unit_label}` : ""}</p>
                      </div>
                      <input name="value" className={inputClass} defaultValue={row?.is_unlimited ? "" : row?.limit_value ?? String(configLimit?.defaultValue ?? 0)} />
                      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <input name="isUnlimited" type="checkbox" defaultChecked={row?.is_unlimited ?? false} disabled={!limit.is_unlimited_available} />
                        Unlimited
                      </label>
                      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <input name="overageEnabled" type="checkbox" defaultChecked={row?.overage_enabled ?? false} />
                        Allow Overage
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-500">$</span>
                        <input name="overagePrice" className={`${inputClass} w-24`} type="number" step="0.0001" placeholder="Price" defaultValue={row?.overage_price ?? limit.overage_unit_price ?? ""} />
                        <span className="text-sm text-slate-500">/extra</span>
                      </div>
                      <Button type="submit" variant="secondary">Save</Button>
                    </form>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function FeatureRegistryPanel({ data, mutate }: { data: AdminAccessData; mutate: (payload: Record<string, unknown>, success?: string) => Promise<void> }) {
  const [editingFeature, setEditingFeature] = useState<FeatureRegistryRow | "new" | null>(null)
  const features = data.data.featureRegistry
  const groupedFeatures = groupByCategory(features, (feature) => feature.category)
  const flagOptions = useMemo(() => getFlagOptions(data), [data])
  const permissionOptions = useMemo(() => getPermissionOptions(data), [data])
  const blankFeature: FeatureRegistryRow = {
    id: "",
    feature_key: "",
    feature_name: "",
    description: "",
    category: "General",
    display_order: 0,
    icon: null,
    purchase_type: "plan_only",
    locked_behavior: "show_locked",
    associated_flags: [],
    required_permissions: [],
    is_active: true
  }
  const modalFeature = editingFeature === "new" ? blankFeature : editingFeature

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Entitlements Registry</h2>
          <p className="mt-1 text-sm text-slate-600">Features with their purchase behavior, locked behavior, and plan packaging metadata.</p>
        </div>
        <Button type="button" onClick={() => setEditingFeature("new")}>
          <Plus className="h-4 w-4" />
          Add Feature
        </Button>
      </div>
      <div className="mt-4 flex flex-wrap gap-5 text-sm text-slate-600">
        <span className="inline-flex items-center gap-2"><Package className="h-4 w-4 text-blue-600" /> Feature - On/off capability per plan</span>
        <span className="inline-flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-violet-600" /> Purchase behavior - Plan or add-on availability</span>
      </div>
      <div className="mt-5 space-y-3">
        {Object.entries(groupedFeatures).map(([category, categoryFeatures]) => (
          <details key={category} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm" open={categoryFeatures.some((feature) => feature.is_active)}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <span className="inline-flex items-center gap-2 text-lg font-semibold text-slate-950">
                <ChevronDown className="h-4 w-4 text-slate-400" />
                {category}
              </span>
              <span className="text-sm text-slate-500">{categoryFeatures.length} features</span>
            </summary>
            <div>
              {categoryFeatures.map((feature) => {
                const associations = getFeatureAssociationValues(feature, data.definitions.featureAccess)
                return (
                  <div key={feature.id || feature.feature_key} className="grid gap-3 border-b border-slate-200 px-4 py-4 last:border-b-0 md:grid-cols-[2rem_minmax(0,1fr)_auto_auto_auto] md:items-center">
                    <Package className="h-4 w-4 text-blue-600" />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-950">{feature.feature_name}</p>
                        <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600">{feature.feature_key}</span>
                      </div>
                      {feature.description && <p className="mt-1 text-sm text-slate-600">{feature.description}</p>}
                      <p className="mt-1 text-xs text-slate-500">{purchaseTypeLabel(feature.purchase_type)} | {lockedBehaviorLabel(feature.locked_behavior)}</p>
                      {(associations.flags.length > 0 || associations.permissions.length > 0) && (
                        <p className="mt-1 text-xs text-slate-500">
                          {associations.flags.length} flags | {associations.permissions.length} permissions associated
                        </p>
                      )}
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${feature.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {feature.is_active ? "Active" : "Inactive"}
                    </span>
                    <button type="button" className="text-violet-600 hover:text-violet-800" title="Add limit to this feature">
                      <Plus className="h-4 w-4" />
                    </button>
                    <button type="button" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-950" onClick={() => setEditingFeature(feature)} aria-label={`Edit ${feature.feature_name}`}>
                      <Edit3 className="h-4 w-4" />
                    </button>
                  </div>
                )
              })}
            </div>
          </details>
        ))}
      </div>
      {modalFeature && (
        <FeatureRegistryModal
          feature={modalFeature}
          featureAccess={data.definitions.featureAccess}
          flagOptions={flagOptions}
          permissionOptions={permissionOptions}
          isNew={editingFeature === "new"}
          onClose={() => setEditingFeature(null)}
          onSave={async (payload) => {
            await mutate(payload, editingFeature === "new" ? "Feature created" : "Feature updated")
            setEditingFeature(null)
          }}
          onArchive={async (id) => {
            await mutate({ action: "deleteFeatureRegistry", id }, "Feature archived")
            setEditingFeature(null)
          }}
        />
      )}
    </section>
  )
}

function FeatureRegistryModal({
  feature,
  featureAccess,
  flagOptions,
  permissionOptions,
  isNew,
  onClose,
  onSave,
  onArchive
}: {
  feature: FeatureRegistryRow
  featureAccess: FeatureAccessDefinition[]
  flagOptions: string[]
  permissionOptions: string[]
  isNew: boolean
  onClose: () => void
  onSave: (payload: Record<string, unknown>) => Promise<void>
  onArchive: (id: string) => Promise<void>
}) {
  const associations = getFeatureAssociationValues(feature, featureAccess)
  const [selectedFlags, setSelectedFlags] = useState(associations.flags)
  const [selectedPermissions, setSelectedPermissions] = useState(associations.permissions)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <form
        className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl bg-white shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          void onSave({
            action: "upsertFeatureRegistry",
            id: isNew ? undefined : feature.id,
            featureKey: String(form.get("featureKey")),
            featureName: String(form.get("featureName")),
            description: String(form.get("description") || ""),
            category: String(form.get("category") || "General"),
            displayOrder: Number(form.get("displayOrder") || 0),
            purchaseType: String(form.get("purchaseType") || "plan_only"),
            lockedBehavior: String(form.get("lockedBehavior") || "show_locked"),
            associatedFlags: selectedFlags,
            requiredPermissions: selectedPermissions,
            isActive: form.get("isActive") === "on"
          })
        }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
          <h3 className="inline-flex items-center gap-2 text-xl font-semibold text-slate-950">
            {isNew ? "Add Feature" : "Edit Feature"}
            <Package className="h-4 w-4 text-blue-600" />
          </h3>
          <button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-950" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 p-4">
          <section className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
            <h4 className="text-base font-semibold text-slate-700">Basic Information</h4>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm font-semibold text-slate-700">
                Feature Key
                <input name="featureKey" className={inputClass} defaultValue={feature.feature_key} readOnly={!isNew} required />
                <span className="text-xs font-normal text-slate-400">Key cannot be changed after creation.</span>
              </label>
              <label className="space-y-1 text-sm font-semibold text-slate-700">
                Display Name
                <input name="featureName" className={inputClass} defaultValue={feature.feature_name} required />
              </label>
              <label className="space-y-1 text-sm font-semibold text-slate-700 md:col-span-2">
                Description
                <textarea name="description" className={`${inputClass} min-h-24 py-3`} defaultValue={feature.description || ""} />
              </label>
              <label className="space-y-1 text-sm font-semibold text-slate-700">
                Category
                <input name="category" className={inputClass} defaultValue={feature.category || "General"} />
              </label>
              <label className="space-y-1 text-sm font-semibold text-slate-700">
                Display Order
                <input name="displayOrder" className={inputClass} type="number" defaultValue={feature.display_order || 0} />
                <span className="text-xs font-normal text-slate-400">Controls sort order inside the category. Lower numbers show first.</span>
              </label>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h4 className="inline-flex items-center gap-2 text-base font-semibold text-slate-700">
              <ShoppingCart className="h-5 w-5" />
              Purchase & Pricing
            </h4>
            <div className="mt-3 grid gap-3">
              <label className="space-y-1 text-sm font-semibold text-slate-700">
                Purchase Type
                <select name="purchaseType" className={inputClass} defaultValue={feature.purchase_type || "plan_only"}>
                  <option value="plan_only">Plan Only - Must upgrade plan to unlock</option>
                  <option value="addon_available">Add-on Available - Can buy separately OR via plan</option>
                  <option value="addon_only">Add-on Only - Only available as separate purchase</option>
                </select>
              </label>
              <label className="space-y-1 text-sm font-semibold text-slate-700">
                When Locked (not in plan)
                <select name="lockedBehavior" className={inputClass} defaultValue={feature.locked_behavior || "show_locked"}>
                  <option value="show_locked">Show Locked - Display with upgrade prompt (PLG)</option>
                  <option value="hide">Hide - Don&apos;t show to users without access</option>
                </select>
              </label>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h4 className="inline-flex items-center gap-2 text-base font-semibold text-slate-700">
              <SlidersHorizontal className="h-5 w-5" />
              Associated Flags & Permissions
            </h4>
            <p className="mt-1 text-xs text-slate-500">These are the rollout switches and role permissions that should be checked when troubleshooting this entitlement. Entitlements remain the billing source of truth.</p>
            <div className="mt-3 space-y-3">
              <ChipPicker
                label="Associated Flags"
                options={flagOptions}
                placeholder="Type to find a flag..."
                selected={selectedFlags}
                onChange={setSelectedFlags}
              />
              <ChipPicker
                label="Required Permissions"
                options={permissionOptions}
                placeholder="Type to find a permission..."
                selected={selectedPermissions}
                onChange={setSelectedPermissions}
              />
            </div>
          </section>

          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700">
            <input name="isActive" type="checkbox" defaultChecked={feature.is_active} />
            Active - Available for use in plans
          </label>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 p-4">
          {!isNew ? (
            <Button type="button" variant="danger" onClick={() => onArchive(feature.id)}>
              <Trash2 className="h-4 w-4" />
              Archive
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit">
              <Check className="h-4 w-4" />
              Save Feature
            </Button>
          </div>
        </div>
      </form>
    </div>
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

function WorkspacePlanAssignments({ data, mutate }: { data: AdminAccessData; mutate: (payload: Record<string, unknown>, success?: string, options?: { refreshShell?: boolean }) => Promise<void> }) {
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
                }, "Workspace plan saved", { refreshShell: true })
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

function ChipPicker({
  label,
  options,
  selected,
  placeholder,
  onChange
}: {
  label: string
  options: string[]
  selected: string[]
  placeholder: string
  onChange: (values: string[]) => void
}) {
  const [query, setQuery] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const normalizedSelected = uniqueStrings(selected)
  const trimmedQuery = query.trim()
  const matches = options
    .filter((option) => !normalizedSelected.includes(option))
    .filter((option) => option.toLowerCase().includes(trimmedQuery.toLowerCase()))
    .slice(0, 8)
  const canAddTyped = trimmedQuery.length > 0 && !normalizedSelected.includes(trimmedQuery)
  const showDropdown = isOpen && (matches.length > 0 || canAddTyped)

  function addValue(value: string) {
    const nextValue = value.trim()
    if (!nextValue) return
    onChange(uniqueStrings([...normalizedSelected, nextValue]))
    setQuery("")
    setIsOpen(false)
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-slate-700">{label}</p>
      <div className="relative rounded-lg border border-slate-200 bg-white p-2">
        <div className="flex min-h-10 flex-wrap gap-2">
          {normalizedSelected.map((value) => (
            <span key={value} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
              {value}
              <button
                type="button"
                className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-950"
                onClick={() => onChange(normalizedSelected.filter((item) => item !== value))}
                aria-label={`Remove ${value}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <input
            className="min-w-48 flex-1 border-0 bg-transparent px-2 py-1 text-sm outline-none placeholder:text-slate-400"
            value={query}
            placeholder={normalizedSelected.length > 0 ? "Add another..." : placeholder}
            onFocus={() => setIsOpen(true)}
            onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
            onChange={(event) => {
              setQuery(event.target.value)
              setIsOpen(true)
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                addValue(matches[0] || query)
              }
              if (event.key === "Backspace" && !query && normalizedSelected.length > 0) {
                onChange(normalizedSelected.slice(0, -1))
              }
            }}
          />
        </div>
        {showDropdown && (
          <div className="absolute left-2 right-2 top-[calc(100%+0.25rem)] z-[60] max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            {matches.map((option) => (
              <button key={option} type="button" className="block w-full px-3 py-2 text-left font-mono text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-950" onMouseDown={(event) => event.preventDefault()} onClick={() => addValue(option)}>
                {option}
              </button>
            ))}
            {canAddTyped && !matches.includes(trimmedQuery) && (
              <button type="button" className="block w-full border-t border-slate-100 px-3 py-2 text-left text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-950" onMouseDown={(event) => event.preventDefault()} onClick={() => addValue(query)}>
                Create &quot;{trimmedQuery}&quot;
              </button>
            )}
          </div>
        )}
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

function getFeatureRows(data: AdminAccessData): FeatureRegistryRow[] {
  if (data.data.featureRegistry.length > 0) return data.data.featureRegistry
  return data.definitions.features.map((feature, index) => ({
    id: "",
    feature_key: feature.key,
    feature_name: feature.label,
    description: null,
    category: "Config",
    display_order: index,
    icon: null,
    purchase_type: "plan_only",
    locked_behavior: "show_locked",
    associated_flags: feature.associatedFlags || [],
    required_permissions: feature.requiredPermissions || [],
    is_active: true
  }))
}

function getFeatureAssociationValues(feature: FeatureRegistryRow, featureAccess: FeatureAccessDefinition[]) {
  const definition = featureAccess.find((item) => item.entitlement === feature.feature_key || item.key === feature.feature_key)
  return {
    flags: uniqueStrings([...(feature.associated_flags || []), ...((feature.associated_flags || []).length > 0 ? [] : definition?.flags || [])]),
    permissions: uniqueStrings([...(feature.required_permissions || []), ...((feature.required_permissions || []).length > 0 ? [] : definition?.permissions || [])])
  }
}

function getFlagOptions(data: AdminAccessData) {
  return uniqueStrings([
    ...data.data.flags.map((flag) => flag.flag_key),
    ...data.definitions.features.flatMap((feature) => feature.associatedFlags || []),
    ...data.definitions.featureAccess.flatMap((definition) => definition.flags)
  ])
}

function getPermissionOptions(data: AdminAccessData) {
  return uniqueStrings([
    ...Object.values(data.definitions.roles).flatMap((role) => role.permissions),
    ...data.definitions.features.flatMap((feature) => feature.requiredPermissions || []),
    ...data.definitions.featureAccess.flatMap((definition) => definition.permissions)
  ])
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b))
}

function getLimitRows(data: AdminAccessData): LimitTypeRow[] {
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
}

function groupByCategory<T>(items: T[], getCategory: (item: T) => string): Record<string, T[]> {
  return items
    .slice()
    .sort((a, b) => {
      const categoryCompare = getCategory(a).localeCompare(getCategory(b))
      if (categoryCompare !== 0) return categoryCompare
      const aOrder = "display_order" in (a as Record<string, unknown>) ? Number((a as Record<string, unknown>).display_order || 0) : 0
      const bOrder = "display_order" in (b as Record<string, unknown>) ? Number((b as Record<string, unknown>).display_order || 0) : 0
      return aOrder - bOrder
    })
    .reduce<Record<string, T[]>>((groups, item) => {
      const category = getCategory(item) || "General"
      groups[category] = [...(groups[category] || []), item]
      return groups
    }, {})
}

function normalizedPlanStatus(plan: PlanRow) {
  if (plan.status) return plan.status
  return plan.active ? "active" : "archived"
}

function statusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function billingTypeLabel(billingType: PlanBillingType) {
  if (billingType === "grant_only") return "Grant only"
  return billingType.charAt(0).toUpperCase() + billingType.slice(1)
}

function statusBadgeClass(status: string) {
  if (status === "active") return "bg-emerald-50 text-emerald-700"
  if (status === "legacy") return "bg-amber-50 text-amber-700"
  if (status === "archived") return "bg-red-50 text-red-700"
  return "bg-slate-100 text-slate-600"
}

function stripeSyncBadgeClass(status: string) {
  if (status === "synced") return "bg-emerald-50 text-emerald-700"
  if (status === "error") return "bg-red-50 text-red-700"
  if (status === "pending") return "bg-amber-50 text-amber-700"
  return "bg-slate-100 text-slate-600"
}

function stripeSyncPanelClass(status: string) {
  if (status === "synced") return "border-emerald-200 bg-emerald-50 text-emerald-800"
  if (status === "error") return "border-red-200 bg-red-50 text-red-800"
  if (status === "pending") return "border-amber-200 bg-amber-50 text-amber-800"
  return "border-slate-200 bg-slate-50 text-slate-700"
}

function purchaseTypeLabel(value: string) {
  if (value === "addon_available") return "Add-on available"
  if (value === "addon_only") return "Add-on only"
  return "Plan only"
}

function lockedBehaviorLabel(value: string) {
  if (value === "hide") return "Hidden when locked"
  return "Shown locked"
}

function formatPrice(value: number | null, currency: string) {
  const amount = value ?? 0
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency || "usd").toUpperCase(),
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2
  }).format(amount)
}

function countPlanWorkspaces(data: AdminAccessData, plan: PlanRow) {
  const workspacePlanCount = data.data.workspacePlans.filter((item) => item.plan_key === plan.plan_key || item.plan_id === plan.id).length
  if (workspacePlanCount > 0) return workspacePlanCount
  return data.data.workspaces.filter((workspace) => workspace.plan_key === plan.plan_key).length
}

const inputClass = "h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
