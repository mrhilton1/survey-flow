"use client"

import { useEffect, useMemo, useState } from "react"
import { ClipboardCheck, Loader2, PlayCircle } from "lucide-react"

interface SurveyOption {
  id: string
  name: string
  status?: string
  workspace_id?: string
}

const SAMPLE_ANSWERS = `{
  "__contact_email": "test@example.com"
}`

const SAMPLE_URL_PARAMS = `{
  "em": "test@example.com",
  "utm_source": "qa"
}`

export function PlatformQaConsole() {
  const [surveys, setSurveys] = useState<SurveyOption[]>([])
  const [selectedSurveyId, setSelectedSurveyId] = useState("")
  const [answersJson, setAnswersJson] = useState(SAMPLE_ANSWERS)
  const [urlParamsJson, setUrlParamsJson] = useState(SAMPLE_URL_PARAMS)
  const [loading, setLoading] = useState(true)
  const [evaluating, setEvaluating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<unknown>(null)

  useEffect(() => {
    let mounted = true

    async function loadSurveys() {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch("/api/surveys")
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || "Unable to load surveys.")
        if (!mounted) return
        const nextSurveys = Array.isArray(payload.surveys) ? payload.surveys : []
        setSurveys(nextSurveys)
        setSelectedSurveyId(nextSurveys[0]?.id || "")
      } catch (loadError) {
        if (mounted) setError(loadError instanceof Error ? loadError.message : "Unable to load surveys.")
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadSurveys()
    return () => {
      mounted = false
    }
  }, [])

  const selectedSurvey = useMemo(() => surveys.find((survey) => survey.id === selectedSurveyId), [selectedSurveyId, surveys])

  async function evaluateRouter() {
    if (!selectedSurveyId) return
    setEvaluating(true)
    setError(null)
    setResult(null)

    try {
      const answers = parseJsonObject(answersJson, "Answers")
      const urlParams = parseJsonObject(urlParamsJson, "URL params")
      const response = await fetch(`/api/platform/qa/surveys/${selectedSurveyId}/thank-you-router/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers,
          urlParams,
          workspaceId: selectedSurvey?.workspace_id
        })
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Router evaluation failed.")
      setResult(payload)
    } catch (evaluateError) {
      setError(evaluateError instanceof Error ? evaluateError.message : "Router evaluation failed.")
    } finally {
      setEvaluating(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
            <ClipboardCheck className="h-3.5 w-3.5" />
            Platform only
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-950">QA Console</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Simulate thank-you page routing with the same evaluator used by the public survey runtime.
          </p>
        </div>
        <button
          type="button"
          onClick={evaluateRouter}
          disabled={!selectedSurveyId || evaluating}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {evaluating ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
          Evaluate Router
        </button>
      </section>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <label className="text-sm font-semibold text-slate-700" htmlFor="qa-survey">
              Survey
            </label>
            <select
              id="qa-survey"
              value={selectedSurveyId}
              onChange={(event) => setSelectedSurveyId(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm"
              disabled={loading}
            >
              {loading && <option>Loading surveys...</option>}
              {!loading && surveys.length === 0 && <option>No surveys found</option>}
              {surveys.map((survey) => (
                <option key={survey.id} value={survey.id}>
                  {survey.name} {survey.status ? `(${survey.status})` : ""}
                </option>
              ))}
            </select>
          </div>

          <JsonEditor
            label="Answers JSON"
            value={answersJson}
            onChange={setAnswersJson}
            help="Use response answer keys exactly as the survey stores them. Contact helpers like __contact_email work here."
          />
          <JsonEditor
            label="URL Params JSON"
            value={urlParamsJson}
            onChange={setUrlParamsJson}
            help="Use normalized incoming URL parameters, for example em, fn, utm_source, or any survey param."
          />
        </div>

        <div className="min-h-[540px] rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-950">Router Decision Trace</h2>
            <p className="mt-1 text-sm text-slate-600">Selected page, matched rule, fallback, and every evaluated condition.</p>
          </div>
          <pre className="max-h-[680px] overflow-auto p-5 text-sm leading-6 text-slate-800">
            {result ? JSON.stringify(result, null, 2) : "Run an evaluation to see the router trace."}
          </pre>
        </div>
      </section>
    </div>
  )
}

function JsonEditor({
  label,
  value,
  onChange,
  help
}: {
  label: string
  value: string
  onChange: (value: string) => void
  help: string
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={10}
        className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-950 px-3 py-2 font-mono text-xs leading-5 text-slate-50 shadow-sm"
        spellCheck={false}
      />
      <p className="mt-2 text-xs leading-5 text-slate-500">{help}</p>
    </div>
  )
}

function parseJsonObject(value: string, label: string) {
  const parsed = JSON.parse(value)
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object.`)
  }
  return parsed as Record<string, unknown>
}
