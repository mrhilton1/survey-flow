"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Loader2,
  PlayCircle,
  XCircle
} from "lucide-react"
import type { Survey, SurveyQuestion } from "@/lib/surveyflow/types"

interface SurveyOption {
  id: string
  name: string
  status?: string
  workspace_id?: string
}

interface QaPayload {
  answers: Record<string, unknown>
  urlParams: Record<string, string>
  surveyIdOverride?: string
}

interface QaTestCase {
  id: string
  label: string
  description: string
  payload: QaPayload
  expected: "success" | "client_error" | "not_found"
}

interface QaRunResult {
  id: string
  label: string
  status: "pass" | "fail"
  message: string
  durationMs: number
  response?: unknown
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
  const [selectedSurveyDetail, setSelectedSurveyDetail] = useState<Survey | null>(null)
  const [answersJson, setAnswersJson] = useState(SAMPLE_ANSWERS)
  const [urlParamsJson, setUrlParamsJson] = useState(SAMPLE_URL_PARAMS)
  const [selectedTestId, setSelectedTestId] = useState("manual-router-evaluation")
  const [loading, setLoading] = useState(true)
  const [loadingSurvey, setLoadingSurvey] = useState(false)
  const [evaluating, setEvaluating] = useState(false)
  const [runningAll, setRunningAll] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<unknown>(null)
  const [testResults, setTestResults] = useState<QaRunResult[]>([])

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

  useEffect(() => {
    if (!selectedSurveyId) {
      setSelectedSurveyDetail(null)
      return
    }

    let mounted = true

    async function loadSurveyDetail() {
      setLoadingSurvey(true)
      try {
        const response = await fetch(`/api/surveys/${selectedSurveyId}`)
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || "Unable to load survey details.")
        if (mounted) setSelectedSurveyDetail(payload.survey || null)
      } catch {
        if (mounted) setSelectedSurveyDetail(null)
      } finally {
        if (mounted) setLoadingSurvey(false)
      }
    }

    loadSurveyDetail()
    return () => {
      mounted = false
    }
  }, [selectedSurveyId])

  const selectedSurvey = useMemo(() => surveys.find((survey) => survey.id === selectedSurveyId), [selectedSurveyId, surveys])
  const testCases = useMemo(() => buildQaTestCases(selectedSurveyDetail), [selectedSurveyDetail])
  const selectedTest = testCases.find((test) => test.id === selectedTestId) || testCases[0]
  const passCount = testResults.filter((test) => test.status === "pass").length
  const failCount = testResults.filter((test) => test.status === "fail").length

  function loadSelectedTestPayload(testId: string) {
    const nextTest = testCases.find((test) => test.id === testId)
    setSelectedTestId(testId)
    if (!nextTest || nextTest.id === "manual-router-evaluation") return
    setAnswersJson(formatJson(nextTest.payload.answers))
    setUrlParamsJson(formatJson(nextTest.payload.urlParams))
  }

  async function evaluateRouter() {
    if (!selectedSurveyId) return
    setEvaluating(true)
    setError(null)
    setResult(null)

    try {
      const answers = parseJsonObject(answersJson, "Answers")
      const urlParams = normalizeStringRecord(parseJsonObject(urlParamsJson, "URL params"))
      const response = await postRouterEvaluation({
        surveyId: selectedSurveyId,
        workspaceId: selectedSurvey?.workspace_id,
        answers,
        urlParams
      })
      if (!response.ok) throw new Error(response.error || "Router evaluation failed.")
      setResult(response.payload)
      recordSingleResult("manual-router-evaluation", "Manual router evaluation", {
        status: "pass",
        message: describeRouterPayload(response.payload),
        durationMs: response.durationMs,
        response: response.payload
      })
    } catch (evaluateError) {
      const message = evaluateError instanceof Error ? evaluateError.message : "Router evaluation failed."
      setError(message)
      recordSingleResult("manual-router-evaluation", "Manual router evaluation", {
        status: "fail",
        message,
        durationMs: 0
      })
    } finally {
      setEvaluating(false)
    }
  }

  async function runSelectedTest() {
    if (!selectedTest) return
    if (selectedTest.id === "manual-router-evaluation") {
      await evaluateRouter()
      return
    }
    setEvaluating(true)
    setError(null)
    const nextResult = await runQaTest(selectedTest)
    setResult(nextResult.response || { error: nextResult.message })
    recordSingleResult(nextResult.id, nextResult.label, nextResult)
    setEvaluating(false)
  }

  async function runAllTests() {
    setRunningAll(true)
    setError(null)
    const runnableTests = testCases.filter((test) => test.id !== "manual-router-evaluation")
    const nextResults: QaRunResult[] = []
    for (const test of runnableTests) {
      const nextResult = await runQaTest(test)
      nextResults.push(nextResult)
      setTestResults([...nextResults])
    }
    setResult(nextResults[nextResults.length - 1]?.response || null)
    setRunningAll(false)
  }

  async function runQaTest(test: QaTestCase): Promise<QaRunResult> {
    const startedAt = performance.now()

    if (test.expected === "client_error") {
      try {
        parseJsonObject("{", "Answers")
        return {
          id: test.id,
          label: test.label,
          status: "fail",
          message: "Invalid JSON did not throw.",
          durationMs: Math.round(performance.now() - startedAt)
        }
      } catch (clientError) {
        return {
          id: test.id,
          label: test.label,
          status: "pass",
          message: clientError instanceof Error ? clientError.message : "Invalid JSON was blocked.",
          durationMs: Math.round(performance.now() - startedAt)
        }
      }
    }

    const response = await postRouterEvaluation({
      surveyId: test.payload.surveyIdOverride || selectedSurveyId,
      workspaceId: selectedSurvey?.workspace_id,
      answers: test.payload.answers,
      urlParams: test.payload.urlParams
    })
    const durationMs = response.durationMs

    if (test.expected === "not_found") {
      return {
        id: test.id,
        label: test.label,
        status: response.status === 404 ? "pass" : "fail",
        message: response.status === 404 ? "Missing survey returned 404." : `Expected 404, received ${response.status}.`,
        durationMs,
        response: response.payload
      }
    }

    if (!response.ok) {
      return {
        id: test.id,
        label: test.label,
        status: "fail",
        message: response.error || `Request failed with ${response.status}.`,
        durationMs,
        response: response.payload
      }
    }

    const validation = validateRouterPayload(response.payload)
    return {
      id: test.id,
      label: test.label,
      status: validation.ok ? "pass" : "fail",
      message: validation.message,
      durationMs,
      response: response.payload
    }
  }

  async function postRouterEvaluation(input: {
    surveyId: string
    workspaceId?: string
    answers: Record<string, unknown>
    urlParams: Record<string, string>
  }) {
    const startedAt = performance.now()
    const response = await fetch(`/api/platform/qa/surveys/${input.surveyId}/thank-you-router/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answers: input.answers,
        urlParams: input.urlParams,
        workspaceId: input.workspaceId
      })
    })
    const payload = await response.json().catch(() => ({}))
    return {
      ok: response.ok,
      status: response.status,
      payload,
      error: typeof payload.error === "string" ? payload.error : undefined,
      durationMs: Math.round(performance.now() - startedAt)
    }
  }

  function recordSingleResult(id: string, label: string, nextResult: Omit<QaRunResult, "id" | "label">) {
    setTestResults((current) => [
      { id, label, ...nextResult },
      ...current.filter((resultItem) => resultItem.id !== id)
    ])
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
            Run post-deploy checks for thank-you routing, JSON handling, and survey runtime assumptions from one place.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={runSelectedTest}
            disabled={!selectedSurveyId || evaluating || runningAll}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {evaluating ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
            Run Selected
          </button>
          <button
            type="button"
            onClick={runAllTests}
            disabled={!selectedSurveyId || evaluating || runningAll}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {runningAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
            Run All
          </button>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <section className="grid gap-3 md:grid-cols-3">
        <QaSummaryCard label="Available tests" value={testCases.length} tone="neutral" />
        <QaSummaryCard label="Passing" value={passCount} tone="pass" />
        <QaSummaryCard label="Failing" value={failCount} tone={failCount > 0 ? "fail" : "neutral"} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[390px_1fr]">
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
            {loadingSurvey ? <p className="mt-2 text-xs text-slate-500">Loading survey test context...</p> : null}
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700" htmlFor="qa-test">
              QA test
            </label>
            <select
              id="qa-test"
              value={selectedTestId}
              onChange={(event) => loadSelectedTestPayload(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm"
            >
              {testCases.map((test) => (
                <option key={test.id} value={test.id}>
                  {test.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs leading-5 text-slate-500">{selectedTest?.description}</p>
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

        <div className="space-y-4">
          <QaLightBoard results={testResults} tests={testCases} />
          <JsonOutput
            title="Router Decision Trace"
            description="Selected page, matched rule, fallback, and every evaluated condition."
            value={result ? JSON.stringify(result, null, 2) : "Run a QA test to see the router trace."}
          />
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
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-semibold text-slate-700">{label}</label>
        <CopyButton value={value} label={`Copy ${label}`} />
      </div>
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

function JsonOutput({ title, description, value }: { title: string; description: string; value: string }) {
  return (
    <div className="min-h-[540px] rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
        <CopyButton value={value} label="Copy trace JSON" />
      </div>
      <pre className="max-h-[680px] overflow-auto p-5 text-sm leading-6 text-slate-800">{value}</pre>
    </div>
  )
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  async function copyValue() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <button
      type="button"
      onClick={copyValue}
      className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
      aria-label={label}
    >
      {copied ? <ClipboardCheck className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  )
}

function QaSummaryCard({ label, value, tone }: { label: string; value: number; tone: "neutral" | "pass" | "fail" }) {
  const toneClass = {
    neutral: "border-slate-200 bg-white text-slate-950",
    pass: "border-emerald-200 bg-emerald-50 text-emerald-800",
    fail: "border-red-200 bg-red-50 text-red-800"
  }[tone]

  return (
    <div className={`rounded-xl border px-4 py-3 shadow-sm ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  )
}

function QaLightBoard({ tests, results }: { tests: QaTestCase[]; results: QaRunResult[] }) {
  const resultById = new Map(results.map((result) => [result.id, result]))

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-950">QA Light Board</h2>
        <p className="mt-1 text-sm text-slate-600">Run one test or run everything after each deploy. Green means the check passed.</p>
      </div>
      <div className="grid gap-2 p-4 md:grid-cols-2 xl:grid-cols-3">
        {tests.map((test) => {
          const result = resultById.get(test.id)
          return (
            <div
              key={test.id}
              className={`rounded-lg border px-3 py-3 ${
                result?.status === "pass"
                  ? "border-emerald-200 bg-emerald-50"
                  : result?.status === "fail"
                    ? "border-red-200 bg-red-50"
                    : "border-slate-200 bg-slate-50"
              }`}
            >
              <div className="flex items-start gap-2">
                <QaStatusIcon status={result?.status || "idle"} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-950">{test.label}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{result?.message || test.description}</p>
                  {result ? <p className="mt-1 text-xs font-semibold text-slate-500">{result.durationMs}ms</p> : null}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function QaStatusIcon({ status }: { status: "pass" | "fail" | "idle" }) {
  if (status === "pass") return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
  if (status === "fail") return <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
  return <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
}

function buildQaTestCases(survey: Survey | null): QaTestCase[] {
  const questions = survey?.questions || []
  const firstChoiceQuestion = questions.find((question) => question.type === "multiple-choice")
  const firstThisOrThatQuestion = questions.find((question) => question.type === "this-or-that")
  const firstRankedQuestion = questions.find((question) => question.type === "ranked-order")
  const firstTextQuestion = questions.find((question) => question.type === "text")
  const firstRatingQuestion = questions.find((question) => question.type === "rating")

  return [
    {
      id: "manual-router-evaluation",
      label: "Manual router evaluation",
      description: "Runs the exact Answers JSON and URL Params JSON currently shown in the editors.",
      expected: "success",
      payload: {
        answers: { __contact_email: "test@example.com" },
        urlParams: { em: "test@example.com", utm_source: "qa" }
      }
    },
    {
      id: "router-empty-fallback",
      label: "Router fallback / default page",
      description: "Confirms the runtime returns a selected page or a clear no-page mode with no submitted answers.",
      expected: "success",
      payload: {
        answers: {},
        urlParams: {}
      }
    },
    {
      id: "contact-field-email",
      label: "Contact field condition",
      description: "Confirms normalized contact helper fields can be evaluated by router conditions.",
      expected: "success",
      payload: {
        answers: {
          __contact_email: "qa@example.com",
          __contact_first_name: "QA"
        },
        urlParams: {}
      }
    },
    {
      id: "url-param-capture",
      label: "URL parameter condition",
      description: "Confirms URL params are accepted by the same evaluator used by the public runtime.",
      expected: "success",
      payload: {
        answers: {},
        urlParams: {
          em: "qa@example.com",
          fn: "QA",
          utm_source: "qa_console"
        }
      }
    },
    {
      id: "total-score-threshold",
      label: "Total score condition",
      description: "Confirms score-based router conditions can be evaluated without crashing.",
      expected: "success",
      payload: {
        answers: firstChoiceQuestion ? buildQuestionAnswer(firstChoiceQuestion) : {},
        urlParams: {}
      }
    },
    {
      id: "question-answer-match",
      label: "Question answer condition",
      description: "Uses the first supported question answer shape for answer-based router rules.",
      expected: "success",
      payload: {
        answers: firstChoiceQuestion ? buildQuestionAnswer(firstChoiceQuestion) : firstTextQuestion ? buildQuestionAnswer(firstTextQuestion) : {},
        urlParams: {}
      }
    },
    {
      id: "preference-top-this-or-that",
      label: "Preference top condition",
      description: "Uses a this-or-that comparison payload so preference-top rules have ranked data to inspect.",
      expected: "success",
      payload: {
        answers: firstThisOrThatQuestion ? buildQuestionAnswer(firstThisOrThatQuestion) : {},
        urlParams: {}
      }
    },
    {
      id: "ranked-order-answer",
      label: "Ranked-order answer",
      description: "Uses ranked-order answers so router and payload logic can inspect ordered choices.",
      expected: "success",
      payload: {
        answers: firstRankedQuestion ? buildQuestionAnswer(firstRankedQuestion) : {},
        urlParams: {}
      }
    },
    {
      id: "rating-answer",
      label: "Rating answer",
      description: "Uses a numeric rating answer to exercise numeric answer handling.",
      expected: "success",
      payload: {
        answers: firstRatingQuestion ? buildQuestionAnswer(firstRatingQuestion) : {},
        urlParams: {}
      }
    },
    {
      id: "mixed-response-payload",
      label: "Mixed full response payload",
      description: "Combines contact, URL params, choice, preference, ranked, text, and rating shapes when those question types exist.",
      expected: "success",
      payload: {
        answers: questions.reduce<Record<string, unknown>>((answers, question) => ({ ...answers, ...buildQuestionAnswer(question) }), {
          __contact_email: "qa@example.com",
          __contact_phone: "+14805551212"
        }),
        urlParams: {
          em: "qa@example.com",
          phone: "+14805551212",
          utm_source: "qa_console"
        }
      }
    },
    {
      id: "invalid-json-guard",
      label: "Invalid JSON guard",
      description: "Confirms the console blocks malformed JSON before it reaches the runtime API.",
      expected: "client_error",
      payload: {
        answers: {},
        urlParams: {}
      }
    },
    {
      id: "missing-survey-guard",
      label: "Missing survey guard",
      description: "Confirms the QA API returns 404 for an unknown survey instead of leaking or crashing.",
      expected: "not_found",
      payload: {
        surveyIdOverride: "00000000-0000-4000-8000-000000000000",
        answers: {},
        urlParams: {}
      }
    }
  ]
}

function buildQuestionAnswer(question: SurveyQuestion): Record<string, unknown> {
  if (question.type === "multiple-choice") {
    return { [question.id]: question.options?.[0] || "Option 1" }
  }

  if (question.type === "this-or-that") {
    const options = normalizeOptions(question.options, ["Option 1", "Option 2", "Option 3"])
    return {
      [question.id]: [
        { left: options[0], right: options[1], selected: options[0], inferred: false },
        { left: options[0], right: options[2], selected: options[0], inferred: false },
        { left: options[1], right: options[2], selected: options[1], inferred: false }
      ]
    }
  }

  if (question.type === "ranked-order") {
    return { [question.id]: normalizeOptions(question.options, ["Item 1", "Item 2", "Item 3"]) }
  }

  if (question.type === "text") {
    return { [question.id]: "QA text answer" }
  }

  if (question.type === "rating") {
    return { [question.id]: question.maxRating || 5 }
  }

  if (question.type === "contact-info") {
    return {
      [`${question.id}_first_name`]: "QA",
      [`${question.id}_email`]: "qa@example.com",
      [question.id]: "filled"
    }
  }

  return {}
}

function normalizeOptions(options: string[] | undefined, fallback: string[]) {
  const values = options?.filter(Boolean) || []
  return values.length >= 2 ? values : fallback
}

function parseJsonObject(value: string, label: string) {
  const parsed = JSON.parse(value)
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object.`)
  }
  return parsed as Record<string, unknown>
}

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2)
}

function normalizeStringRecord(value: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, String(entry ?? "")]))
}

function validateRouterPayload(payload: unknown) {
  const record = isRecord(payload) ? payload : {}
  const evaluation = isRecord(record.evaluation) ? record.evaluation : null
  if (!evaluation) return { ok: false, message: "Response did not include an evaluation object." }
  const mode = typeof evaluation.mode === "string" ? evaluation.mode : ""
  if (!mode) return { ok: false, message: "Evaluation did not include a mode." }
  if (mode === "no_pages") return { ok: true, message: "Router returned no_pages mode. No active thank-you pages found." }
  if (!("selectedPageId" in evaluation)) return { ok: false, message: "Evaluation did not include selectedPageId." }
  return { ok: true, message: describeRouterPayload(payload) }
}

function describeRouterPayload(payload: unknown) {
  const record = isRecord(payload) ? payload : {}
  const evaluation = isRecord(record.evaluation) ? record.evaluation : {}
  const mode = typeof evaluation.mode === "string" ? evaluation.mode : "unknown"
  const selectedPage = isRecord(evaluation.selectedPage) ? evaluation.selectedPage : null
  const pageName = selectedPage && typeof selectedPage.name === "string" ? selectedPage.name : "none"
  const matchedRuleLabel = typeof evaluation.matchedRuleLabel === "string" ? evaluation.matchedRuleLabel : null
  return matchedRuleLabel
    ? `${mode}: ${pageName} via ${matchedRuleLabel}.`
    : `${mode}: ${pageName}.`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
