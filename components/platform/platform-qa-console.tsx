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
import type { Survey, SurveyQuestion, ThankYouPage, ThankYouRouterCondition, ThankYouRouterRule } from "@/lib/surveyflow/types"

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
  successMode?: "default_or_fallback" | "matched" | "any"
  expectedTargetPageId?: string
  warnOnFallback?: boolean
}

interface QaRunResult {
  id: string
  label: string
  status: "pass" | "warning" | "fail"
  message: string
  durationMs: number
  response?: unknown
}

type SurveyWithThankYouPages = Survey & {
  thank_you_pages?: ThankYouPage[] | null
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
  const warningCount = testResults.filter((test) => test.status === "warning").length
  const failCount = testResults.filter((test) => test.status === "fail").length
  const diagnosticPayload = useMemo(
    () =>
      buildQaDiagnosticPayload({
        survey: selectedSurveyDetail,
        selectedSurvey,
        tests: testCases,
        results: testResults,
        lastTrace: result
      }),
    [selectedSurveyDetail, selectedSurvey, testCases, testResults, result]
  )
  const diagnosticJson = useMemo(() => JSON.stringify(diagnosticPayload, null, 2), [diagnosticPayload])

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

    const validation = validateRouterPayload(response.payload, test)
    return {
      id: test.id,
      label: test.label,
      status: validation.status,
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
    <div className="mx-auto w-full max-w-[96rem] space-y-6 overflow-x-hidden px-4 sm:px-6 lg:px-8">
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

      <section className="grid min-w-0 gap-3 md:grid-cols-3">
        <QaSummaryCard label="Available tests" value={testCases.length} tone="neutral" />
        <QaSummaryCard label="Passing" value={passCount} tone="pass" />
        <QaSummaryCard label={failCount > 0 ? "Failing" : "Needs rules"} value={failCount > 0 ? failCount : warningCount} tone={failCount > 0 ? "fail" : warningCount > 0 ? "warning" : "neutral"} />
      </section>

      <section className="grid min-w-0 gap-4 lg:grid-cols-[minmax(260px,360px)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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

        <div className="min-w-0 space-y-4">
          <QaLightBoard results={testResults} tests={testCases} />
          <JsonOutput
            title="QA Diagnostic Payload"
            description="Copy this full summary, trace data, generated payloads, and recommendations when asking AI or another agent what to fix."
            value={diagnosticJson}
            copyLabel="Copy diagnostic JSON"
          />
          <JsonOutput
            title="Router Decision Trace"
            description="Selected page, matched rule, fallback, and every evaluated condition."
            value={result ? JSON.stringify(result, null, 2) : "Run a QA test to see the router trace."}
            copyLabel="Copy trace JSON"
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

function JsonOutput({
  title,
  description,
  value,
  copyLabel
}: {
  title: string
  description: string
  value: string
  copyLabel: string
}) {
  return (
    <div className="min-h-[540px] min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
        <CopyButton value={value} label={copyLabel} />
      </div>
      <pre className="max-h-[680px] max-w-full overflow-auto whitespace-pre-wrap break-words p-5 text-sm leading-6 text-slate-800">{value}</pre>
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

function QaSummaryCard({ label, value, tone }: { label: string; value: number; tone: "neutral" | "pass" | "warning" | "fail" }) {
  const toneClass = {
    neutral: "border-slate-200 bg-white text-slate-950",
    pass: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
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
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-950">QA Light Board</h2>
        <p className="mt-1 text-sm text-slate-600">Run one test or run everything after each deploy. Green means the check passed.</p>
      </div>
      <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))] gap-2 p-4">
        {tests.map((test) => {
          const result = resultById.get(test.id)
          return (
            <div
              key={test.id}
              className={`min-w-0 overflow-hidden rounded-lg border px-3 py-3 ${
                result?.status === "pass"
                  ? "border-emerald-200 bg-emerald-50"
                  : result?.status === "warning"
                    ? "border-amber-200 bg-amber-50"
                    : result?.status === "fail"
                    ? "border-red-200 bg-red-50"
                    : "border-slate-200 bg-slate-50"
              }`}
            >
              <div className="flex items-start gap-2">
                <QaStatusIcon status={result?.status || "idle"} />
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold text-slate-950">{test.label}</p>
                  <p className="mt-1 line-clamp-2 break-words text-xs leading-5 text-slate-600">{result?.message || test.description}</p>
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

function QaStatusIcon({ status }: { status: "pass" | "warning" | "fail" | "idle" }) {
  if (status === "pass") return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
  if (status === "warning") return <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
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
  const configuredRuleTests = buildConfiguredRouterRuleTests(survey)

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
      successMode: "default_or_fallback",
      payload: {
        answers: {},
        urlParams: {}
      }
    },
    ...configuredRuleTests,
    {
      id: "contact-field-email",
      label: "Contact field condition",
      description: "Smoke-tests normalized contact helper fields. Yellow means no configured contact rule matched, so the default outcome was used.",
      expected: "success",
      warnOnFallback: true,
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
      description: "Smoke-tests URL params. Yellow means no configured URL-param rule matched, so the default outcome was used.",
      expected: "success",
      warnOnFallback: true,
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
      description: "Smoke-tests score calculation. Yellow means no configured score rule matched, so the default outcome was used.",
      expected: "success",
      warnOnFallback: true,
      payload: {
        answers: firstChoiceQuestion ? buildQuestionAnswer(firstChoiceQuestion) : {},
        urlParams: {}
      }
    },
    {
      id: "question-answer-match",
      label: "Question answer condition",
      description: "Smoke-tests question answer payloads. Yellow means no configured answer rule matched, so the default outcome was used.",
      expected: "success",
      warnOnFallback: true,
      payload: {
        answers: firstChoiceQuestion ? buildQuestionAnswer(firstChoiceQuestion) : firstTextQuestion ? buildQuestionAnswer(firstTextQuestion) : {},
        urlParams: {}
      }
    },
    {
      id: "preference-top-this-or-that",
      label: "Preference top condition",
      description: "Smoke-tests this-or-that preference ranking. Yellow means no configured preference rule matched, so the default outcome was used.",
      expected: "success",
      warnOnFallback: true,
      payload: {
        answers: firstThisOrThatQuestion ? buildQuestionAnswer(firstThisOrThatQuestion) : {},
        urlParams: {}
      }
    },
    {
      id: "ranked-order-answer",
      label: "Ranked-order answer",
      description: "Smoke-tests ranked-order payloads. Yellow means no configured ranked-answer rule matched, so the default outcome was used.",
      expected: "success",
      warnOnFallback: true,
      payload: {
        answers: firstRankedQuestion ? buildQuestionAnswer(firstRankedQuestion) : {},
        urlParams: {}
      }
    },
    {
      id: "rating-answer",
      label: "Rating answer",
      description: "Smoke-tests numeric rating answers. Yellow means no configured rating rule matched, so the default outcome was used.",
      expected: "success",
      warnOnFallback: true,
      payload: {
        answers: firstRatingQuestion ? buildQuestionAnswer(firstRatingQuestion) : {},
        urlParams: {}
      }
    },
    {
      id: "mixed-response-payload",
      label: "Mixed full response payload",
      description: "Smoke-tests a full mixed response shape. Yellow means no configured rule matched, so the default outcome was used.",
      expected: "success",
      warnOnFallback: true,
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

function buildConfiguredRouterRuleTests(survey: Survey | null): QaTestCase[] {
  const router = survey?.settings?.thankYouRouter
  const questions = survey?.questions || []
  if (!router?.enabled || !router.rules?.length) return []

  return router.rules
    .filter((rule) => rule.enabled !== false && Boolean(rule.targetPageId))
    .flatMap((rule, index) => {
      const label = rule.label || `Rule ${index + 1}`
      if (rule.match === "any" && rule.conditions.length > 1) {
        return rule.conditions.map((condition, conditionIndex) => ({
          id: `configured-router-rule-${rule.id}-condition-${condition.id}`,
          label: `Configured route: ${label} / condition ${conditionIndex + 1}`,
          description:
            "Uses generated test data for one OR condition in this saved router rule. At least one condition path should match the configured target outcome.",
          expected: "success" as const,
          successMode: "matched" as const,
          expectedTargetPageId: rule.targetPageId,
          payload: buildPayloadForRouterRule({ ...rule, match: "all", conditions: [condition] }, questions)
        }))
      }

      return [
        {
          id: `configured-router-rule-${rule.id}`,
          label: `Configured route: ${label}`,
          description: "Uses generated test data for this saved router rule. This should match the configured target outcome.",
          expected: "success" as const,
          successMode: "matched" as const,
          expectedTargetPageId: rule.targetPageId,
          payload: buildPayloadForRouterRule(rule, questions)
        }
      ]
    })
}

function buildPayloadForRouterRule(rule: ThankYouRouterRule, questions: SurveyQuestion[]): QaPayload {
  const payload: QaPayload = { answers: {}, urlParams: {} }
  const conditions = rule.match === "any" ? rule.conditions.slice(0, 1) : rule.conditions

  conditions.forEach((condition) => {
    const question = condition.questionId ? questions.find((item) => item.id === condition.questionId) : undefined
    applyConditionPayload(payload, condition, question, questions)
  })

  return payload
}

function applyConditionPayload(
  payload: QaPayload,
  condition: ThankYouRouterCondition,
  question: SurveyQuestion | undefined,
  questions: SurveyQuestion[]
) {
  const expected = getExpectedValueForCondition(condition, question)

  if (condition.sourceType === "contact_field" && condition.field) {
    payload.answers[`__contact_${condition.field}`] = expected || sampleContactValue(condition.field)
  }

  if (condition.sourceType === "url_param" && condition.field) {
    payload.urlParams[condition.field] = expected || sampleUrlParamValue(condition.field)
  }

  if (condition.sourceType === "question_answer" && question) {
    payload.answers = {
      ...payload.answers,
      ...buildQuestionAnswerForCondition(question, condition, expected)
    }
  }

  if (condition.sourceType === "preference_top" && question) {
    payload.answers[question.id] = buildTopPreferenceAnswer(question, expected)
  }

  if ((condition.sourceType === "total_score" || condition.sourceType === "question_score") && condition.operator !== "does_not_exist") {
    const scoredQuestions = condition.sourceType === "question_score" && question ? [question] : questions
    payload.answers = {
      ...payload.answers,
      ...buildScoredAnswers(scoredQuestions)
    }
  }
}

function getExpectedValueForCondition(condition: ThankYouRouterCondition, question?: SurveyQuestion) {
  if (condition.operator === "exists") return ""
  if (condition.operator === "does_not_exist") return ""
  if (condition.operator === "greater_than") return String(Number(condition.value || 0) + 1)
  if (condition.operator === "less_than") return String(Number(condition.value || 1) - 1)
  return condition.value || question?.options?.[0] || "QA value"
}

function buildQuestionAnswerForCondition(question: SurveyQuestion, condition: ThankYouRouterCondition, expected: string) {
  if (condition.operator === "does_not_exist") return {}

  if (question.type === "multiple-choice") {
    const value = expected || question.options?.[0] || "Option 1"
    return { [question.id]: question.allowMultiple ? [value] : value }
  }

  if (question.type === "ranked-order") {
    const options = normalizeOptions(question.options, ["Item 1", "Item 2", "Item 3"])
    return { [question.id]: expected ? [expected, ...options.filter((option) => option !== expected)] : options }
  }

  if (question.type === "rating") {
    return { [question.id]: Number(expected || question.maxRating || 5) }
  }

  if (question.type === "text") {
    return { [question.id]: expected || "QA text answer" }
  }

  if (question.type === "contact-info") {
    return {
      [`${question.id}_email`]: expected.includes("@") ? expected : "qa@example.com",
      [question.id]: "filled"
    }
  }

  return buildQuestionAnswer(question)
}

function buildTopPreferenceAnswer(question: SurveyQuestion, expected: string) {
  const options = normalizeOptions(question.options, ["Option 1", "Option 2", "Option 3"])
  const expectedValue = expected.toLowerCase()
  const winner =
    options.find((option) => option === expected) ||
    options.find((option) => option.toLowerCase() === expectedValue) ||
    options.find((option) => option.toLowerCase().includes(expectedValue)) ||
    options[0]
  const rankingOrder = [winner, ...options.filter((option) => option !== winner)]
  const matchups: Array<{ left: string; right: string; selected: string; inferred: boolean }> = []

  options.forEach((left, leftIndex) => {
    options.slice(leftIndex + 1).forEach((right) => {
      const selected =
        left === winner || right === winner
          ? winner
          : rankingOrder.indexOf(left) <= rankingOrder.indexOf(right)
            ? left
            : right

      matchups.push({
        left,
        right,
        selected,
        inferred: false
      })
    })
  })

  return matchups
}

function buildScoredAnswers(questions: SurveyQuestion[]) {
  return questions.reduce<Record<string, unknown>>((answers, question) => {
    if (question.type === "multiple-choice" && question.options?.length) {
      const scoredOptions = question.options.map((option) => ({ option, score: question.scores?.[option] || 0 }))
      const best = scoredOptions.sort((a, b) => b.score - a.score)[0]?.option || question.options[0]
      answers[question.id] = best
    }
    return answers
  }, {})
}

function sampleContactValue(field: string) {
  if (field === "email") return "qa@example.com"
  if (field === "phone") return "+14805551212"
  if (field === "first_name") return "QA"
  if (field === "last_name") return "Tester"
  if (field === "company") return "QA Company"
  return "QA value"
}

function sampleUrlParamValue(field: string) {
  if (field === "em" || field === "email") return "qa@example.com"
  if (field === "fn") return "QA"
  if (field === "phone") return "+14805551212"
  return "qa"
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

function validateRouterPayload(payload: unknown, test?: QaTestCase): { status: QaRunResult["status"]; message: string } {
  const record = isRecord(payload) ? payload : {}
  const evaluation = isRecord(record.evaluation) ? record.evaluation : null
  if (!evaluation) return { status: "fail", message: "Response did not include an evaluation object." }
  const mode = typeof evaluation.mode === "string" ? evaluation.mode : ""
  if (!mode) return { status: "fail", message: "Evaluation did not include a mode." }
  if (mode === "no_pages") return { status: "pass", message: "Router returned no_pages mode. No active thank-you pages found." }
  if (!("selectedPageId" in evaluation)) return { status: "fail", message: "Evaluation did not include selectedPageId." }

  const description = describeRouterPayload(payload)
  if (test?.successMode === "default_or_fallback") {
    if (mode === "fallback" || mode === "disabled") {
      return { status: "pass", message: `${description} This is expected for the default outcome test.` }
    }
    return { status: "warning", message: `${description} A routing rule matched during the fallback test.` }
  }

  if (test?.successMode === "matched" && mode !== "matched") {
    return { status: "fail", message: `${description} Expected a configured router rule to match.` }
  }

  if (test?.expectedTargetPageId) {
    const selectedPageId = typeof evaluation.selectedPageId === "string" ? evaluation.selectedPageId : ""
    if (selectedPageId !== test.expectedTargetPageId) {
      return {
        status: "fail",
        message: `${description} Expected target page ${test.expectedTargetPageId}, but selected ${selectedPageId || "none"}.`
      }
    }
  }

  if (test?.warnOnFallback && (mode === "fallback" || mode === "disabled")) {
    return {
      status: "warning",
      message: `${description} API is healthy, but no enabled rule matched this payload. Configure a router rule to prove this path.`
    }
  }

  return { status: "pass", message: description }
}

function buildQaDiagnosticPayload({
  survey,
  selectedSurvey,
  tests,
  results,
  lastTrace
}: {
  survey: Survey | null
  selectedSurvey?: SurveyOption
  tests: QaTestCase[]
  results: QaRunResult[]
  lastTrace: unknown
}) {
  const resultById = new Map(results.map((result) => [result.id, result]))
  const passCount = results.filter((result) => result.status === "pass").length
  const warningCount = results.filter((result) => result.status === "warning").length
  const failCount = results.filter((result) => result.status === "fail").length
  const surveyWithPages = survey as SurveyWithThankYouPages | null
  const pages = surveyWithPages?.thank_you_pages || []
  const router = survey?.settings?.thankYouRouter

  return {
    generatedAt: new Date().toISOString(),
    purpose:
      "Post-deploy QA diagnostic payload for SurveyFlow. Use this to understand failing checks, router decisions, generated test data, and recommended fixes.",
    survey: {
      id: survey?.id || selectedSurvey?.id || null,
      name: survey?.name || selectedSurvey?.name || null,
      status: survey?.status || selectedSurvey?.status || null,
      workspaceId: survey?.workspaceId || selectedSurvey?.workspace_id || null
    },
    summary: {
      availableTests: tests.length,
      runTests: results.length,
      passCount,
      warningCount,
      failCount,
      overallStatus: failCount > 0 ? "fail" : warningCount > 0 ? "warning" : results.length > 0 ? "pass" : "not_run",
      failedTests: results.filter((result) => result.status === "fail").map((result) => result.label),
      warningTests: results.filter((result) => result.status === "warning").map((result) => result.label)
    },
    qaFixtureGuidance: {
      productionSurveysNeedEveryQuestionType: false,
      recommendation:
        "Production surveys should only contain the questions they need. For post-deploy QA, keep one dedicated fixture survey with representative question types and router rules.",
      idealFixtureIncludes: [
        "contact-info question with hidden and visible capture variants",
        "multiple-choice question with at least two options",
        "this-or-that question with inference enabled and at least four comparison items",
        "ranked-order question",
        "text input question",
        "rating question",
        "URL parameter rules",
        "score rules",
        "preference top rules",
        "a default thank-you page plus non-default thank-you pages for configured routes"
      ],
      yellowWarnings:
        "Yellow smoke tests mean the evaluator is healthy but the selected survey has no enabled rule for that path. They are useful warnings, not automatic product failures."
    },
    recommendations: buildQaRecommendations({ survey, tests, results }),
    router: {
      enabled: Boolean(router?.enabled),
      defaultPageId: router?.defaultPageId || survey?.settings?.thankYouPageId || null,
      defaultPageName: resolvePageName(pages, router?.defaultPageId || survey?.settings?.thankYouPageId),
      pages: pages.map((page) => ({
        id: page.id,
        name: page.name,
        status: page.status,
        isDefault: page.is_default
      })),
      rules:
        router?.rules?.map((rule) => ({
          id: rule.id,
          label: rule.label || null,
          enabled: rule.enabled !== false,
          match: rule.match,
          targetPageId: rule.targetPageId || null,
          targetPageName: resolvePageName(pages, rule.targetPageId),
          conditions: rule.conditions.map((condition) => ({
            id: condition.id,
            sourceType: condition.sourceType,
            questionId: condition.questionId || null,
            questionTitle: resolveQuestionTitle(survey?.questions || [], condition.questionId),
            field: condition.field || null,
            operator: condition.operator,
            value: condition.value || null,
            availableQuestionOptions: resolveQuestionOptions(survey?.questions || [], condition.questionId)
          }))
        })) || []
    },
    tests: tests.map((test) => {
      const testResult = resultById.get(test.id)
      return {
        id: test.id,
        label: test.label,
        description: test.description,
        expected: test.expected,
        successMode: test.successMode || "any",
        expectedTargetPageId: test.expectedTargetPageId || null,
        status: testResult?.status || "not_run",
        message: testResult?.message || null,
        durationMs: testResult?.durationMs || null,
        generatedPayload: test.payload,
        routerEvaluation: summarizeRouterEvaluation(testResult?.response),
        rawResponse: testResult?.response || null,
        recommendations: buildTestRecommendations(test, testResult, survey)
      }
    }),
    lastTrace
  }
}

function buildQaRecommendations({
  survey,
  tests,
  results
}: {
  survey: Survey | null
  tests: QaTestCase[]
  results: QaRunResult[]
}) {
  const recommendations: Array<{ priority: "high" | "medium" | "low"; title: string; details: string; action: string }> = []
  const configuredFailures = results.filter((result) => result.status === "fail" && result.id.startsWith("configured-router-rule"))
  const fallbackWarnings = results.filter((result) => result.status === "warning")
  const router = survey?.settings?.thankYouRouter

  if (configuredFailures.length > 0) {
    recommendations.push({
      priority: "high",
      title: "Configured thank-you routes are falling back instead of matching.",
      details:
        "The QA API is healthy, but one or more saved router rules did not match the generated payload. In the current screenshot, BOB is acting as the default fallback page.",
      action:
        "Open the failed test details in this diagnostic JSON. Compare each rule condition's expected value with its generated payload and the available question options. Fix stale option labels, wrong contact or URL parameter field names, or unsupported condition combinations."
    })
  }

  if (configuredFailures.some((result) => result.message.includes("fallback"))) {
    recommendations.push({
      priority: "high",
      title: "Check whether rules are using outcome names instead of answer values.",
      details:
        "A route named Option 2, Option 3, or Option 4 only matches if its condition value is the actual submitted answer or preference result, not the thank-you page name.",
      action:
        "For each failed configured route, confirm the condition value exactly matches a survey option, ranked item, contact helper, URL parameter, or score threshold."
    })
  }

  if (fallbackWarnings.length > 0) {
    recommendations.push({
      priority: "medium",
      title: "Yellow smoke tests are usually configuration gaps, not runtime failures.",
      details:
        "The contact, URL parameter, score, answer, preference, ranked-order, rating, and mixed-payload checks are designed to prove the API can evaluate those payload shapes. They turn yellow when no enabled rule is configured for that path.",
      action:
        "Only create router rules for the paths you actually want to route. Otherwise treat yellow smoke checks as informational."
    })
  }

  if (router?.rules?.some((rule) => rule.match === "any" && rule.conditions.length > 1)) {
    recommendations.push({
      priority: "medium",
      title: "OR routes should be tested one condition path at a time.",
      details:
        "A multi-condition OR rule can match through any single condition, so the QA console generates a separate test payload for each OR condition.",
      action:
        "Review the per-condition configured-route tests. If one condition fails but another passes, the route can still work, but the failing condition likely needs cleanup."
    })
  }

  if (tests.length <= 3) {
    recommendations.push({
      priority: "low",
      title: "Add representative survey questions before relying on full QA coverage.",
      details: "Several smoke tests only become meaningful when the survey includes the related question type.",
      action: "Keep at least one contact form, multiple choice, this-or-that, ranked-order, text, and rating question in the QA survey."
    })
  }

  if (recommendations.length === 0) {
    recommendations.push({
      priority: "low",
      title: "No immediate QA issues detected.",
      details: "The run did not produce failures or warnings that require product changes.",
      action: "Run the full board again after the next deploy or after changing thank-you router rules."
    })
  }

  return recommendations
}

function buildTestRecommendations(test: QaTestCase, result: QaRunResult | undefined, survey: Survey | null) {
  if (!result) return ["Run this test to collect evidence."]
  if (result.status === "pass") return ["No action required for this test."]

  const evaluation = summarizeRouterEvaluation(result.response)
  const recommendations: string[] = []

  if (test.successMode === "matched" && evaluation.mode === "fallback") {
    recommendations.push("This configured route expected a saved router rule to match, but the router selected the default fallback page.")
    recommendations.push("Compare generatedPayload with router.ruleResults to find the condition whose actual value did not equal the expected value.")
    recommendations.push("If this route targets a this-or-that preference, make sure the condition value is an actual option label from the question, not only the thank-you page or route label.")
  }

  if (result.status === "warning" && test.warnOnFallback) {
    recommendations.push("The API evaluated successfully, but no enabled rule is configured to match this smoke-test payload.")
    recommendations.push("Create a router rule for this condition type only if this should route to a non-default thank-you page.")
  }

  if (test.id.includes("preference") || hasPreferenceCondition(test, survey)) {
    recommendations.push("For preference routing, verify condition values against availableQuestionOptions in the router section of this diagnostic JSON.")
  }

  if (test.expected === "client_error" || test.expected === "not_found") {
    recommendations.push("This is a guard test. Passing means the console or API is rejecting invalid input correctly.")
  }

  return recommendations.length > 0 ? recommendations : ["Inspect the response payload for condition-level actual and expected values."]
}

function summarizeRouterEvaluation(response: unknown) {
  const record = isRecord(response) ? response : {}
  const evaluation = isRecord(record.evaluation) ? record.evaluation : {}
  const selectedPage = isRecord(evaluation.selectedPage) ? evaluation.selectedPage : null
  const matchedRule = isRecord(evaluation.matchedRule) ? evaluation.matchedRule : null

  return {
    mode: typeof evaluation.mode === "string" ? evaluation.mode : null,
    selectedPageId: typeof evaluation.selectedPageId === "string" ? evaluation.selectedPageId : null,
    selectedPageName: selectedPage && typeof selectedPage.name === "string" ? selectedPage.name : null,
    matchedRuleId: matchedRule && typeof matchedRule.id === "string" ? matchedRule.id : null,
    matchedRuleLabel: typeof evaluation.matchedRuleLabel === "string" ? evaluation.matchedRuleLabel : null,
    fallbackPageId: typeof evaluation.fallbackPageId === "string" ? evaluation.fallbackPageId : null,
    ruleResults: Array.isArray(evaluation.ruleResults) ? evaluation.ruleResults : []
  }
}

function resolvePageName(pages: ThankYouPage[], pageId?: string | null) {
  if (!pageId) return null
  return pages.find((page) => page.id === pageId)?.name || null
}

function resolveQuestionTitle(questions: SurveyQuestion[], questionId?: string) {
  if (!questionId) return null
  return questions.find((question) => question.id === questionId)?.question || null
}

function resolveQuestionOptions(questions: SurveyQuestion[], questionId?: string) {
  if (!questionId) return []
  return questions.find((question) => question.id === questionId)?.options || []
}

function hasPreferenceCondition(test: QaTestCase, survey: Survey | null) {
  const configuredRuleId = test.id.replace("configured-router-rule-", "").split("-condition-")[0]
  return Boolean(
    survey?.settings?.thankYouRouter?.rules?.some(
      (rule) => rule.id === configuredRuleId && rule.conditions.some((condition) => condition.sourceType === "preference_top")
    )
  )
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
