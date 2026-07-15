"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import {
  BarChart3,
  Clipboard,
  Edit3,
  ExternalLink,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Share2,
  Trash2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import type { SurveyStatus } from "@/lib/surveyflow/types"

interface SurveyRow {
  id: string
  name: string
  description: string | null
  status: SurveyStatus
  questions: unknown[]
  responses_count: number | null
  views_count: number | null
  updated_at: string
  created_at: string
}

const STATUS_OPTIONS: SurveyStatus[] = ["draft", "testing", "published"]

export function SurveyDashboard() {
  const router = useRouter()
  const [surveys, setSurveys] = useState<SurveyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busySurveyId, setBusySurveyId] = useState<string | null>(null)
  const [copiedSurveyId, setCopiedSurveyId] = useState<string | null>(null)

  const sortedSurveys = useMemo(() => {
    return [...surveys].sort((a, b) => {
      return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
    })
  }, [surveys])

  async function loadSurveys() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/surveys", { cache: "no-store" })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Failed to load surveys")
      setSurveys(payload.surveys || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load surveys")
    } finally {
      setLoading(false)
    }
  }

  async function createSurvey() {
    setCreating(true)
    setError(null)
    try {
      const response = await fetch("/api/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Untitled Survey" })
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Failed to create survey")
      router.push(`/dashboard/surveys/${payload.survey.id}/edit`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create survey")
    } finally {
      setCreating(false)
    }
  }

  async function updateStatus(surveyId: string, status: SurveyStatus) {
    setBusySurveyId(surveyId)
    setError(null)
    try {
      const response = await fetch(`/api/surveys/${surveyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Failed to update survey")
      setSurveys((current) => current.map((survey) => survey.id === surveyId ? payload.survey : survey))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update survey")
    } finally {
      setBusySurveyId(null)
    }
  }

  async function deleteSurvey(surveyId: string) {
    const confirmed = window.confirm("Delete this survey and its responses?")
    if (!confirmed) return

    setBusySurveyId(surveyId)
    setError(null)
    try {
      const response = await fetch(`/api/surveys/${surveyId}`, { method: "DELETE" })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Failed to delete survey")
      setSurveys((current) => current.filter((survey) => survey.id !== surveyId))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete survey")
    } finally {
      setBusySurveyId(null)
    }
  }

  function publicSurveyHref(survey: SurveyRow) {
    return survey.status === "published" ? `/s/${survey.id}` : `/s/${survey.id}?preview=true`
  }

  async function copyPublicLink(survey: SurveyRow) {
    const url = `${window.location.origin}${publicSurveyHref(survey)}`
    await navigator.clipboard.writeText(url)
    setCopiedSurveyId(survey.id)
    window.setTimeout(() => setCopiedSurveyId(null), 1600)
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
    router.refresh()
  }

  useEffect(() => {
    loadSurveys()
  }, [])

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">My Surveys</h1>
          <p className="text-muted-foreground">Manage and track your survey performance.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={loadSurveys} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sync Counts
          </Button>
          <Button onClick={createSurvey} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            New Survey
          </Button>
          <Button variant="secondary" onClick={signOut}>
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>

      {error ? (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid place-items-center rounded-xl border-2 border-dashed border-border bg-white py-20">
          <Loader2 className="h-8 w-8 animate-spin text-brand-700" />
          <p className="mt-3 text-sm text-muted-foreground">Loading surveys...</p>
        </div>
      ) : sortedSurveys.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border bg-white px-6 py-20 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-700">
            <Clipboard className="h-6 w-6" />
          </div>
          <h2 className="mt-5 text-xl font-bold tracking-tight text-foreground">No surveys yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Create the first survey and start shaping the same AI Studio workflow inside the production shell.
          </p>
          <Button className="mt-5" onClick={createSurvey} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create first survey
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sortedSurveys.map((survey) => {
            const isBusy = busySurveyId === survey.id

            return (
              <article key={survey.id} className="group flex min-h-64 flex-col rounded-xl border border-border bg-white shadow-sm transition-shadow hover:shadow-md">
                <div className="flex flex-1 flex-col p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="line-clamp-1 text-lg font-bold tracking-tight text-foreground">{survey.name}</h2>
                      <p className="mt-2 line-clamp-2 text-base text-muted-foreground">
                        {survey.description || "No description yet."}
                      </p>
                    </div>
                    <StatusSelect
                      value={survey.status}
                      disabled={isBusy}
                      onChange={(status) => updateStatus(survey.id, status)}
                    />
                  </div>

                  <div className="mt-7 flex items-center text-sm text-muted-foreground">
                    <BarChart3 className="mr-2 h-4 w-4" />
                    {Math.max(0, survey.responses_count || 0)} responses
                  </div>

                  <div className="mt-auto pt-6 text-xs text-muted-foreground">Updated {formatDate(survey.updated_at || survey.created_at)}</div>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-border bg-muted/30 px-6 py-4">
                  <div className="flex gap-3">
                    <IconLink href={`/dashboard/surveys/${survey.id}/edit`} label="Edit">
                      <Edit3 className="h-5 w-5" />
                    </IconLink>
                    <IconLink href={`/dashboard/surveys/${survey.id}/reports`} label="Reports">
                      <BarChart3 className="h-5 w-5" />
                    </IconLink>
                    <IconButton label={copiedSurveyId === survey.id ? "Copied" : "Copy public link"} onClick={() => copyPublicLink(survey)}>
                      <Share2 className="h-5 w-5" />
                    </IconButton>
                    <IconLink href={publicSurveyHref(survey)} label="Open public survey" target="_blank" accent>
                      <ExternalLink className="h-5 w-5" />
                    </IconLink>
                  </div>
                  <IconButton label="Delete survey" danger disabled={isBusy} onClick={() => deleteSurvey(survey.id)}>
                    {isBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Trash2 className="h-5 w-5" />}
                  </IconButton>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatusSelect({
  value,
  disabled,
  onChange
}: {
  value: SurveyStatus
  disabled: boolean
  onChange: (status: SurveyStatus) => void
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as SurveyStatus)}
      className={[
        "h-7 rounded-md border px-3 text-[10px] font-bold uppercase tracking-wide outline-none transition-colors",
        value === "published" ? "border-green-200 bg-green-50 text-green-600" : "",
        value === "testing" ? "border-amber-200 bg-amber-50 text-amber-600" : "",
        value === "draft" ? "border-yellow-200 bg-yellow-50 text-yellow-600" : "",
        disabled ? "cursor-wait opacity-60" : "cursor-pointer"
      ].join(" ")}
    >
      {STATUS_OPTIONS.map((status) => (
        <option key={status} value={status}>
          {status}
        </option>
      ))}
    </select>
  )
}

function IconButton({
  children,
  label,
  danger,
  disabled,
  onClick
}: {
  children: React.ReactNode
  label: string
  danger?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={[
        "grid h-9 w-9 place-items-center rounded-md border border-transparent text-slate-950 transition-colors hover:bg-white disabled:pointer-events-none disabled:opacity-50",
        danger ? "text-red-600 hover:bg-red-50" : ""
      ].join(" ")}
    >
      {children}
    </button>
  )
}

function IconLink({
  children,
  href,
  label,
  target,
  accent
}: {
  children: React.ReactNode
  href: string
  label: string
  target?: string
  accent?: boolean
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      target={target}
      className={[
        "grid h-9 w-9 place-items-center rounded-md border border-transparent transition-colors hover:bg-white",
        accent ? "text-amber-500 hover:text-amber-600" : "text-slate-950"
      ].join(" ")}
    >
      {children}
    </Link>
  )
}

function formatDate(value: string) {
  if (!value) return "just now"
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value))
}
