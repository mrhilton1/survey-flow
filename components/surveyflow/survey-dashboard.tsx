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

  async function copyPublicLink(surveyId: string) {
    const url = `${window.location.origin}/s/${surveyId}`
    await navigator.clipboard.writeText(url)
    setCopiedSurveyId(surveyId)
    window.setTimeout(() => setCopiedSurveyId(null), 1600)
  }

  useEffect(() => {
    loadSurveys()
  }, [])

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Surveys</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Build, publish, share, and monitor SurveyFlow AI survey experiences from inside the reusable app shell.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={loadSurveys} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
          <Button onClick={createSurvey} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            New Survey
          </Button>
        </div>
      </div>

      {error ? (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-10 grid place-items-center rounded-md border border-dashed border-slate-300 bg-white py-16">
          <Loader2 className="h-8 w-8 animate-spin text-brand-700" />
          <p className="mt-3 text-sm text-slate-500">Loading surveys...</p>
        </div>
      ) : sortedSurveys.length === 0 ? (
        <div className="mt-10 rounded-md border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-md bg-brand-50 text-brand-700">
            <Clipboard className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-slate-950">No surveys yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            Create the first survey, then the next migration chunk will wire the full SurveyFlow editor into that route.
          </p>
          <Button className="mt-5" onClick={createSurvey} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create first survey
          </Button>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sortedSurveys.map((survey) => {
            const isBusy = busySurveyId === survey.id
            const questionCount = Array.isArray(survey.questions) ? survey.questions.length : 0

            return (
              <article key={survey.id} className="flex min-h-64 flex-col rounded-md border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-semibold text-slate-950">{survey.name}</h2>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                        {survey.description || "No description yet."}
                      </p>
                    </div>
                    <StatusSelect
                      value={survey.status}
                      disabled={isBusy}
                      onChange={(status) => updateStatus(survey.id, status)}
                    />
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-2 text-sm">
                    <Metric label="Questions" value={questionCount} />
                    <Metric label="Responses" value={survey.responses_count || 0} />
                    <Metric label="Views" value={survey.views_count || 0} />
                  </div>

                  <div className="mt-5 text-xs text-slate-400">
                    Updated {formatDate(survey.updated_at || survey.created_at)}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3">
                  <div className="flex gap-1">
                    <IconLink href={`/dashboard/surveys/${survey.id}/edit`} label="Edit">
                      <Edit3 className="h-4 w-4" />
                    </IconLink>
                    <IconLink href={`/dashboard/surveys/${survey.id}/reports`} label="Reports">
                      <BarChart3 className="h-4 w-4" />
                    </IconLink>
                    <IconButton label={copiedSurveyId === survey.id ? "Copied" : "Copy public link"} onClick={() => copyPublicLink(survey.id)}>
                      <Share2 className="h-4 w-4" />
                    </IconButton>
                    <IconLink href={`/s/${survey.id}`} label="Open public survey" target="_blank">
                      <ExternalLink className="h-4 w-4" />
                    </IconLink>
                  </div>
                  <IconButton label="Delete survey" danger disabled={isBusy} onClick={() => deleteSurvey(survey.id)}>
                    {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
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

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-slate-50 px-3 py-2">
      <div className="text-lg font-semibold text-slate-950">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
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
        "h-8 rounded-md border px-2 text-xs font-semibold uppercase tracking-wide outline-none transition-colors",
        value === "published" ? "border-green-200 bg-green-50 text-green-700" : "",
        value === "testing" ? "border-amber-200 bg-amber-50 text-amber-700" : "",
        value === "draft" ? "border-slate-200 bg-slate-100 text-slate-600" : "",
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
        "grid h-9 w-9 place-items-center rounded-md border border-transparent text-slate-500 transition-colors hover:border-slate-200 hover:bg-white hover:text-slate-950 disabled:pointer-events-none disabled:opacity-50",
        danger ? "hover:border-red-100 hover:bg-red-50 hover:text-red-600" : ""
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
  target
}: {
  children: React.ReactNode
  href: string
  label: string
  target?: string
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      target={target}
      className="grid h-9 w-9 place-items-center rounded-md border border-transparent text-slate-500 transition-colors hover:border-slate-200 hover:bg-white hover:text-slate-950"
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
