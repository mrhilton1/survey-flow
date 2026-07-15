"use client"

import Link from "next/link"
import type React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  BarChart3,
  Bot,
  Clock3,
  Download,
  Eye,
  FileText,
  Radio,
  Loader2,
  RefreshCw,
  Trash2,
  Webhook
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { computeThisOrThatRankings, isThisOrThatMatchupArray } from "@/lib/surveyflow/this-or-that"
import type { ResponseStatus, SurveyQuestion, SurveySettings, SurveyStatus, SurveyStyle } from "@/lib/surveyflow/types"

interface SurveyRow {
  id: string
  name: string
  description: string | null
  questions: SurveyQuestion[] | null
  style: SurveyStyle | null
  settings: SurveySettings | null
  status: SurveyStatus
  responses_count: number | null
  views_count: number | null
  updated_at: string
  created_at: string
}

interface ResponseRow {
  id: string
  answers: Record<string, unknown> | null
  scores: Record<string, number> | null
  total_score: number | null
  status: ResponseStatus
  is_test: boolean | null
  metadata: Record<string, unknown> | null
  submitted_at: string | null
  last_active_at: string | null
  created_at: string
}

interface TelemetryRow {
  id: string
  question_id: string | null
  type: string
  payload: Record<string, unknown> | null
  created_at: string
}

interface WebhookDeliveryRow {
  id: string
  response_id: string | null
  target_url: string
  status: "pending" | "delivered" | "failed"
  response_status: number | null
  response_body: string | null
  error_message: string | null
  attempted_at: string | null
  created_at: string
}

type FilterMode = "completed" | "partial" | "test" | "all"

export function SurveyReports({ surveyId }: { surveyId: string }) {
  const [survey, setSurvey] = useState<SurveyRow | null>(null)
  const [responses, setResponses] = useState<ResponseRow[]>([])
  const [telemetryEvents, setTelemetryEvents] = useState<TelemetryRow[]>([])
  const [webhookDeliveries, setWebhookDeliveries] = useState<WebhookDeliveryRow[]>([])
  const [selectedResponseId, setSelectedResponseId] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterMode>("completed")
  const [loading, setLoading] = useState(true)
  const [busyResponseId, setBusyResponseId] = useState<string | null>(null)
  const [clearingTests, setClearingTests] = useState(false)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [aiReport, setAiReport] = useState("")
  const [error, setError] = useState<string | null>(null)

  const questions = survey?.questions || []

  const filteredResponses = useMemo(() => {
    return responses.filter((response) => {
      if (filter === "all") return true
      if (filter === "test") return response.is_test
      return response.status === filter && !response.is_test
    })
  }, [filter, responses])

  const selectedResponse = useMemo(() => {
    return filteredResponses.find((response) => response.id === selectedResponseId) || filteredResponses[0] || null
  }, [filteredResponses, selectedResponseId])

  const metrics = useMemo(() => {
    const completed = responses.filter((response) => response.status === "completed" && !response.is_test)
    const partial = responses.filter((response) => response.status === "partial" && !response.is_test)
    const test = responses.filter((response) => response.is_test)
    const averageScore = completed.length
      ? Math.round(completed.reduce((total, response) => total + Number(response.total_score || 0), 0) / completed.length)
      : 0
    const averageSeconds = completed
      .map((response) => Number(response.metadata?.timeToComplete || 0))
      .filter(Boolean)
    const averageTime = averageSeconds.length
      ? Math.round(averageSeconds.reduce((total, value) => total + value, 0) / averageSeconds.length)
      : 0

    return {
      completed: completed.length,
      partial: partial.length,
      test: test.length,
      views: survey?.views_count || 0,
      averageScore,
      averageTime
    }
  }, [responses, survey?.views_count])

  const loadReports = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [surveyResponse, responsesResponse, telemetryResponse, webhooksResponse] = await Promise.all([
        fetch(`/api/surveys/${surveyId}`, { cache: "no-store" }),
        fetch(`/api/surveys/${surveyId}/responses`, { cache: "no-store" }),
        fetch(`/api/surveys/${surveyId}/telemetry`, { cache: "no-store" }),
        fetch(`/api/surveys/${surveyId}/webhooks`, { cache: "no-store" })
      ])
      const surveyPayload = await surveyResponse.json()
      const responsesPayload = await responsesResponse.json()
      const telemetryPayload = await telemetryResponse.json()
      const webhooksPayload = await webhooksResponse.json()
      if (!surveyResponse.ok) throw new Error(surveyPayload.error || "Failed to load survey")
      if (!responsesResponse.ok) throw new Error(responsesPayload.error || "Failed to load responses")
      if (!telemetryResponse.ok) throw new Error(telemetryPayload.error || "Failed to load telemetry")
      if (!webhooksResponse.ok) throw new Error(webhooksPayload.error || "Failed to load webhooks")
      setSurvey(surveyPayload.survey)
      setResponses(responsesPayload.responses || [])
      setTelemetryEvents(telemetryPayload.events || [])
      setWebhookDeliveries(webhooksPayload.deliveries || [])
      setSelectedResponseId((current) => current || responsesPayload.responses?.[0]?.id || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reports")
    } finally {
      setLoading(false)
    }
  }, [surveyId])

  async function deleteResponse(responseId: string) {
    const confirmed = window.confirm("Delete this response?")
    if (!confirmed) return

    setBusyResponseId(responseId)
    setError(null)
    try {
      const response = await fetch(`/api/surveys/${surveyId}/responses/${responseId}`, { method: "DELETE" })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Failed to delete response")
      setResponses((current) => current.filter((item) => item.id !== responseId))
      if (selectedResponseId === responseId) setSelectedResponseId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete response")
    } finally {
      setBusyResponseId(null)
    }
  }

  async function clearTestResponses() {
    if (metrics.test === 0) return
    const confirmed = window.confirm(`Delete ${metrics.test} test response${metrics.test === 1 ? "" : "s"}? Official responses will be kept.`)
    if (!confirmed) return

    setClearingTests(true)
    setError(null)
    try {
      const response = await fetch(`/api/surveys/${surveyId}/responses?kind=test`, { method: "DELETE" })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Failed to clear test responses")
      setResponses((current) => current.filter((item) => !item.is_test))
      if (selectedResponse?.is_test) setSelectedResponseId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear test responses")
    } finally {
      setClearingTests(false)
    }
  }

  async function generateReport() {
    setGeneratingReport(true)
    setError(null)
    try {
      const response = await fetch(`/api/surveys/${surveyId}/ai-report`, { method: "POST" })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Failed to generate report")
      setAiReport(payload.report || "")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate report")
    } finally {
      setGeneratingReport(false)
    }
  }

  function downloadCsv() {
    const csv = buildResponseCsv(questions, filteredResponses)
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${survey?.name || "survey"}-responses.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  useEffect(() => {
    loadReports()
  }, [loadReports])

  return (
    <div className="mx-auto min-w-0 max-w-7xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/dashboard/surveys" className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:text-brand-900">
            <ArrowLeft className="h-4 w-4" />
            Back to surveys
          </Link>
          <h1 className="mt-4 text-2xl font-semibold text-slate-950">{survey?.name || "Survey reports"}</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Review response detail, inspect scoring, export filtered responses, and generate an AI summary.
          </p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
          <Button className="w-full sm:w-auto" variant="secondary" onClick={loadReports} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
          <Button className="w-full sm:w-auto" variant="secondary" onClick={downloadCsv} disabled={filteredResponses.length === 0}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button className="w-full sm:w-auto" onClick={generateReport} disabled={generatingReport || responses.length === 0}>
            {generatingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
            Generate AI Report
          </Button>
          <Button className="w-full sm:w-auto" variant="secondary" onClick={clearTestResponses} disabled={clearingTests || metrics.test === 0}>
            {clearingTests ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Clear Test Data
          </Button>
        </div>
      </div>

      {error ? (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mt-8 grid min-w-0 grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Metric label="Completed" value={metrics.completed} />
        <Metric label="Partial" value={metrics.partial} />
        <Metric label="Test" value={metrics.test} />
        <Metric label="Views" value={metrics.views} />
        <Metric label="Avg. score" value={metrics.averageScore} />
        <Metric label="Avg. seconds" value={metrics.averageTime} />
      </div>

      {survey ? (
        <QuestionInsights questions={questions} responses={responses.filter((response) => response.status === "completed" && !response.is_test)} />
      ) : null}

      {aiReport ? (
        <section className="mt-8 rounded-md border border-brand-200 bg-brand-50 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-brand-800">
            <Bot className="h-4 w-4" />
            AI report
          </div>
          <div className="mt-4 whitespace-pre-wrap rounded-md border border-brand-100 bg-white p-4 text-sm leading-6 text-slate-700">
            {aiReport}
          </div>
        </section>
      ) : null}

      <div className="mt-8 grid min-w-0 gap-6 xl:grid-cols-[minmax(240px,25%)_minmax(0,75%)]">
        <section className="min-w-0 rounded-md border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-4">
            <div className="flex flex-wrap gap-2">
              {(["completed", "partial", "test", "all"] as FilterMode[]).map((mode) => (
                <button
                  key={mode}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize ${
                    filter === mode ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                  onClick={() => {
                    setFilter(mode)
                    setSelectedResponseId(null)
                  }}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="grid place-items-center py-16 text-sm text-slate-500">
              <Loader2 className="mb-3 h-7 w-7 animate-spin text-brand-700" />
              Loading responses...
            </div>
          ) : filteredResponses.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="mx-auto h-10 w-10 text-slate-300" />
              <h2 className="mt-3 text-sm font-semibold text-slate-950">No responses in this view</h2>
              <p className="mt-1 text-sm text-slate-500">Switch filters or submit a response from the public survey.</p>
            </div>
          ) : (
            <div className="max-h-[680px] overflow-y-auto">
              {filteredResponses.map((response) => {
                const selected = selectedResponse?.id === response.id
                return (
                  <button
                    key={response.id}
                    className={`block w-full border-b border-slate-100 p-4 text-left transition ${
                      selected ? "bg-brand-50" : "hover:bg-slate-50"
                    }`}
                    onClick={() => setSelectedResponseId(response.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-950">{formatResponseTitle(response)}</div>
                        <div className="mt-1 text-xs text-slate-500">{formatDate(response.submitted_at || response.last_active_at || response.created_at)}</div>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                        response.is_test ? "bg-amber-100 text-amber-800" : response.status === "completed" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                      }`}>
                        {response.is_test ? "test" : response.status}
                      </span>
                    </div>
                    <div className="mt-3 flex gap-4 text-xs text-slate-500">
                      <span>Score {response.total_score || 0}</span>
                      <span>{String(response.metadata?.device || "unknown")}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <section className="min-w-0 rounded-md border border-slate-200 bg-white">
          {selectedResponse ? (
            <ResponseDetail
              questions={questions}
              response={selectedResponse}
              busy={busyResponseId === selectedResponse.id}
              onDelete={() => deleteResponse(selectedResponse.id)}
            />
          ) : (
            <div className="grid min-h-96 place-items-center p-8 text-center">
              <div>
                <Eye className="mx-auto h-10 w-10 text-slate-300" />
                <h2 className="mt-3 text-sm font-semibold text-slate-950">Select a response</h2>
                <p className="mt-1 text-sm text-slate-500">Response detail and scoring will appear here.</p>
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="mt-8 grid min-w-0 gap-6 xl:grid-cols-2">
        <OperationalPanel
          icon={<Radio className="h-4 w-4" />}
          title="Telemetry"
          emptyTitle="No telemetry events"
          emptyText="Public survey load, save, submit, and error events will appear here."
        >
          {telemetryEvents.map((event) => (
            <div key={event.id} className="border-b border-slate-100 p-4 last:border-b-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-950">{event.type}</div>
                  <div className="mt-1 text-xs text-slate-500">{formatDate(event.created_at)}</div>
                </div>
                {event.question_id ? (
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">{event.question_id}</span>
                ) : null}
              </div>
              <pre className="mt-3 max-h-48 max-w-full overflow-auto rounded-md bg-slate-950 p-3 text-xs leading-5 text-slate-100">
                {JSON.stringify(event.payload || {}, null, 2)}
              </pre>
            </div>
          ))}
        </OperationalPanel>

        <OperationalPanel
          icon={<Webhook className="h-4 w-4" />}
          title="Webhook deliveries"
          emptyTitle="No webhook deliveries"
          emptyText="Completed submissions with a configured webhook URL will be logged here."
        >
          {webhookDeliveries.map((delivery) => (
            <div key={delivery.id} className="border-b border-slate-100 p-4 last:border-b-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-950">{delivery.target_url}</div>
                  <div className="mt-1 text-xs text-slate-500">{formatDate(delivery.attempted_at || delivery.created_at)}</div>
                </div>
                <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${statusClass(delivery.status)}`}>
                  {delivery.status}
                </span>
              </div>
              <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                <div>HTTP {delivery.response_status || "none"}</div>
                <div>Response {delivery.response_id?.slice(0, 8) || "n/a"}</div>
              </div>
              {delivery.error_message ? (
                <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {delivery.error_message}
                </div>
              ) : null}
              {delivery.response_body ? (
                <pre className="mt-3 max-h-32 max-w-full overflow-auto rounded-md bg-slate-950 p-3 text-xs leading-5 text-slate-100">
                  {delivery.response_body}
                </pre>
              ) : null}
            </div>
          ))}
        </OperationalPanel>
      </div>
    </div>
  )
}

function OperationalPanel({
  icon,
  title,
  emptyTitle,
  emptyText,
  children
}: {
  icon: React.ReactNode
  title: string
  emptyTitle: string
  emptyText: string
  children: React.ReactNode
}) {
  const isEmpty = Array.isArray(children) ? children.length === 0 : !children
  return (
    <section className="min-w-0 rounded-md border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-100 p-4 text-sm font-semibold text-slate-950">
        {icon}
        {title}
      </div>
      {isEmpty ? (
        <div className="p-8 text-center">
          <h2 className="text-sm font-semibold text-slate-950">{emptyTitle}</h2>
          <p className="mt-1 text-sm text-slate-500">{emptyText}</p>
        </div>
      ) : (
        <div className="max-h-[520px] overflow-y-auto">{children}</div>
      )}
    </section>
  )
}

function QuestionInsights({ questions, responses }: { questions: SurveyQuestion[]; responses: ResponseRow[] }) {
  const insightQuestions = questions.filter((question) => ["multiple-choice", "rating", "ranked-order", "this-or-that"].includes(question.type))
  if (!insightQuestions.length) return null

  return (
    <section className="mt-8 rounded-md border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-100 p-4 text-sm font-semibold text-slate-950">
        <BarChart3 className="h-4 w-4" />
        Question analytics breakdown
      </div>
      <div className="grid min-w-0 gap-5 p-4 sm:p-5 lg:grid-cols-2">
        {insightQuestions.map((question, index) => (
          <div key={question.id} className="min-w-0 rounded-md border border-slate-200">
            <div className="border-b border-slate-100 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold uppercase tracking-widest text-brand-700">Q{index + 1}</span>
                <span className="rounded bg-white px-2 py-1 text-[10px] font-bold uppercase text-slate-500">{question.type.replaceAll("-", " ")}</span>
              </div>
              <h3 className="mt-2 text-sm font-semibold leading-5 text-slate-950">{question.question}</h3>
            </div>
            <div className="space-y-3 p-4">
              <QuestionInsightBody question={question} responses={responses} />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function QuestionInsightBody({ question, responses }: { question: SurveyQuestion; responses: ResponseRow[] }) {
  if (question.type === "multiple-choice") {
    return (
      <div className="space-y-3">
        {getMultipleChoiceAggregates(question, responses).map((item) => (
          <ProgressRow key={item.option} label={item.option} detail={`${item.count} votes (${item.percentage}%)`} percentage={item.percentage} />
        ))}
      </div>
    )
  }

  if (question.type === "rating") {
    const ratings = responses.map((response) => Number(response.answers?.[question.id])).filter((value) => Number.isFinite(value))
    const average = ratings.length ? ratings.reduce((total, value) => total + value, 0) / ratings.length : 0
    const max = question.maxRating || 5
    return (
      <div className="flex items-center gap-4">
        <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-center text-brand-700">
          <div className="text-3xl font-extrabold">{average ? average.toFixed(1) : "N/A"}</div>
          <div className="text-[10px] font-bold uppercase">Avg rating</div>
        </div>
        <div className="flex-1">
          <ProgressRow label={`${ratings.length} response${ratings.length === 1 ? "" : "s"}`} detail={`Max ${max}`} percentage={max > 0 ? Math.round((average / max) * 100) : 0} />
        </div>
      </div>
    )
  }

  if (question.type === "ranked-order") {
    return (
      <div className="space-y-3">
        <p className="text-xs leading-5 text-slate-500">Aggregated rankings use average preference index. Lower rank numbers are more preferred.</p>
        {getRankedOrderAggregates(question, responses).map((item, index) => (
          <ProgressRow key={item.option} label={`#${index + 1} ${item.option}`} detail={item.count ? `Avg #${item.average.toFixed(1)}` : "No rankings"} percentage={item.percentage} />
        ))}
      </div>
    )
  }

  if (question.type === "this-or-that") {
    return (
      <div className="space-y-3">
        <p className="text-xs leading-5 text-slate-500">Aggregate ranking shows preferred items across completed official submissions. Inferred outcomes are included when enabled for the question.</p>
        {getThisOrThatAggregates(question, responses).map((item) => (
          <ProgressRow
            key={item.option}
            label={`#${item.rank} ${item.option}`}
            detail={`${Math.round(item.winPercentage * 100)}% wins (${item.wins}/${item.matches || 0})`}
            percentage={Math.round(item.winPercentage * 100)}
          />
        ))}
      </div>
    )
  }

  return null
}

function ProgressRow({ label, detail, percentage }: { label: string; detail: string; percentage: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-xs font-semibold">
        <span className="truncate text-slate-700">{label}</span>
        <span className="shrink-0 text-brand-700">{detail}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }} />
      </div>
    </div>
  )
}

function getMultipleChoiceAggregates(question: SurveyQuestion, responses: ResponseRow[]) {
  const options = question.options || []
  const total = responses.filter((response) => response.answers?.[question.id]).length
  return options.map((option) => {
    const count = responses.filter((response) => {
      const answer = response.answers?.[question.id]
      return Array.isArray(answer) ? answer.map(String).includes(option) : String(answer || "") === option
    }).length
    return {
      option,
      count,
      percentage: total ? Math.round((count / total) * 100) : 0
    }
  })
}

function getRankedOrderAggregates(question: SurveyQuestion, responses: ResponseRow[]) {
  const options = question.options || []
  const max = options.length || 1
  return options.map((option) => {
    const ranks = responses
      .map((response) => {
        const answer = response.answers?.[question.id]
        if (!Array.isArray(answer)) return 0
        const index = answer.map(String).indexOf(option)
        return index >= 0 ? index + 1 : 0
      })
      .filter(Boolean)
    const average = ranks.length ? ranks.reduce((total, rank) => total + rank, 0) / ranks.length : 0
    return {
      option,
      count: ranks.length,
      average,
      percentage: average && max > 1 ? Math.round(((max - average) / (max - 1)) * 100) : ranks.length ? 100 : 0
    }
  }).sort((a, b) => (a.average || Number.POSITIVE_INFINITY) - (b.average || Number.POSITIVE_INFINITY))
}

function getThisOrThatAggregates(question: SurveyQuestion, responses: ResponseRow[]) {
  const options = question.options || []
  const totals = new Map(options.map((option) => [option, { wins: 0, matches: 0, totalWins: 0, winPercentage: 0 }]))

  responses.forEach((response) => {
    const rankings = computeThisOrThatRankings({ question, answer: response.answers?.[question.id], options })
    rankings.forEach((ranking) => {
      const current = totals.get(ranking.option)
      if (!current) return
      current.wins += ranking.wins
      current.matches += ranking.matches
      current.totalWins += ranking.totalWins
    })
  })

  return options.map((option) => {
    const current = totals.get(option) || { wins: 0, matches: 0, totalWins: 0, winPercentage: 0 }
    const winPercentage = current.matches ? current.wins / current.matches : 0
    return {
      option,
      rank: 0,
      wins: current.wins,
      matches: current.matches,
      totalWins: current.totalWins,
      winPercentage
    }
  }).sort((a, b) => b.totalWins - a.totalWins || b.winPercentage - a.winPercentage || a.option.localeCompare(b.option))
    .map((item, index) => ({ ...item, rank: index + 1 }))
}

function ResponseDetail({
  questions,
  response,
  busy,
  onDelete
}: {
  questions: SurveyQuestion[]
  response: ResponseRow
  busy: boolean
  onDelete: () => void
}) {
  const answers = response.answers || {}
  const scores = response.scores || {}

  return (
    <div className="min-w-0">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">{formatResponseTitle(response)}</h2>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{formatDate(response.submitted_at || response.last_active_at || response.created_at)}</span>
            <span>Total score {response.total_score || 0}</span>
            <span>{response.is_test ? "Test response" : response.status}</span>
          </div>
        </div>
        <Button className="w-full sm:w-auto" variant="secondary" onClick={onDelete} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Delete
        </Button>
      </div>

      <div className="divide-y divide-slate-100">
        {questions.map((question) => (
          <div key={question.id} className="min-w-0 p-4 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-950">{question.question}</div>
                <div className="mt-1 text-xs uppercase tracking-wide text-slate-400">{question.type}</div>
              </div>
              <div className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                Score {scores[question.id] || 0}
              </div>
            </div>
            <div className="mt-3 min-w-0 overflow-x-auto rounded-md bg-slate-50 p-3 text-sm text-slate-700">
              {formatAnswer(question, answers)}
            </div>
          </div>
        ))}

        <div className="min-w-0 p-4 sm:p-5">
          <div className="text-sm font-semibold text-slate-950">Metadata</div>
          <pre className="mt-3 max-h-64 max-w-full overflow-auto rounded-md bg-slate-950 p-4 text-xs leading-5 text-slate-100">
            {JSON.stringify(response.metadata || {}, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-4 py-3">
      <div className="text-2xl font-semibold text-slate-950">{value}</div>
      <div className="text-xs font-medium text-slate-500">{label}</div>
    </div>
  )
}

function formatAnswer(question: SurveyQuestion, answers: Record<string, unknown>) {
  if (question.type === "contact-info") {
    const fields = question.contactFields || ["first_name", "email"]
    const values = fields
      .map((field) => `${titleize(field)}: ${String(answers[`${question.id}_${field}`] || "Not provided")}`)
      .join("\n")
    return <pre className="whitespace-pre-wrap font-sans">{values}</pre>
  }

  const value = answers[question.id]
  if (Array.isArray(value)) {
    if (isThisOrThatMatchupArray(value)) {
      const rankings = computeThisOrThatRankings({ question, answer: value, options: question.options || [] })
      return (
        <div className="space-y-4">
          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Computed rankings</div>
            <div className="space-y-1">
              {rankings.map((ranking) => (
                <div key={ranking.option} className="flex items-center justify-between gap-3 rounded bg-white px-2 py-1">
                  <span className="font-medium">#{ranking.rank} {ranking.option}</span>
                  <span className="text-xs text-slate-500">{Math.round(ranking.winPercentage * 100)}% win rate</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Match history</div>
            <div className="space-y-1">
              {value.map((matchup, index) => (
                <div key={`${matchup.left}-${matchup.right}-${index}`}>
                  {matchup.left} vs {matchup.right}: <span className="font-medium">{matchup.selected || "No choice"}</span>
                  {matchup.inferred ? <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">inferred</span> : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    }
    return value.map(String).join(", ")
  }

  if (value === undefined || value === null || value === "") return "No answer"
  return String(value)
}

function buildResponseCsv(questions: SurveyQuestion[], responses: ResponseRow[]) {
  const headers = [
    "response_id",
    "status",
    "is_test",
    "submitted_at",
    "total_score",
    ...questions.map((question) => question.question)
  ]
  const rows = responses.map((response) => {
    const answers = response.answers || {}
    return [
      response.id,
      response.status,
      response.is_test ? "true" : "false",
      response.submitted_at || response.last_active_at || "",
      String(response.total_score || 0),
      ...questions.map((question) => flattenAnswer(question, answers))
    ]
  })
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n")
}

function flattenAnswer(question: SurveyQuestion, answers: Record<string, unknown>) {
  if (question.type === "contact-info") {
    const fields = question.contactFields || ["first_name", "email"]
    return fields.map((field) => `${field}: ${String(answers[`${question.id}_${field}`] || "")}`).join("; ")
  }
  const value = answers[question.id]
  if (Array.isArray(value)) return value.map((item) => typeof item === "object" ? JSON.stringify(item) : String(item)).join("; ")
  return value === undefined || value === null ? "" : String(value)
}

function csvCell(value: string) {
  return `"${value.replaceAll("\"", "\"\"")}"`
}

function formatResponseTitle(response: ResponseRow) {
  const metadata = response.metadata || {}
  const urlParams = typeof metadata.urlParams === "object" && metadata.urlParams !== null ? metadata.urlParams as Record<string, string> : {}
  return urlParams.email || urlParams.name || `Response ${response.id.slice(0, 8)}`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value))
}

function titleize(value: string) {
  return value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ")
}

function statusClass(status: WebhookDeliveryRow["status"]) {
  if (status === "delivered") return "bg-emerald-100 text-emerald-700"
  if (status === "failed") return "bg-red-100 text-red-700"
  return "bg-slate-100 text-slate-600"
}
