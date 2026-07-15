"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, Check, CheckCircle2, GripVertical, Loader2, RotateCcw } from "lucide-react"
import { scoreSurveyResponse } from "@/lib/surveyflow/scoring"
import type { SurveyQuestion, SurveySettings, SurveyStatus, SurveyStyle } from "@/lib/surveyflow/types"

interface PublicSurveyRow {
  id: string
  name: string
  description: string | null
  seo_description: string | null
  questions: SurveyQuestion[] | null
  style: SurveyStyle | null
  settings: SurveySettings | null
  status: SurveyStatus
  workspace_id: string
}

interface Matchup {
  left: string
  right: string
  selected?: string
}

const DEFAULT_STYLE: SurveyStyle = {
  backgroundColor: "#000000",
  textColor: "#ffffff",
  accentColor: "#f27d26",
  fontFamily: "Inter",
  buttonText: "Next"
}

export function PublicSurvey({ surveyId }: { surveyId: string }) {
  const [survey, setSurvey] = useState<PublicSurveyRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [alreadySubmitted, setAlreadySubmitted] = useState(false)
  const [step, setStep] = useState(-1)
  const [history, setHistory] = useState<number[]>([])
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [responseId, setResponseId] = useState<string | null>(null)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [thisOrThatIndex, setThisOrThatIndex] = useState(0)
  const lastSaveRef = useRef<Promise<unknown>>(Promise.resolve())
  const isPreviewRequest = useMemo(() => {
    return readSearchParam("test") === "true" || readSearchParam("preview") === "true"
  }, [])

  const style = survey?.style || DEFAULT_STYLE
  const settings = survey?.settings || {}
  const questions = survey?.questions || []
  const currentQuestion = step >= 0 ? questions[step] : null
  const isTest = survey?.status === "testing" || isPreviewRequest

  const buttonLabel = style.buttonText || "Next"
  const textMuted = withAlpha(style.textColor, 0.72)
  const borderColor = withAlpha(style.textColor, 0.16)
  const panelBg = withAlpha(style.textColor, 0.06)

  const completionPercent = questions.length > 0 && step >= 0
    ? Math.round(((step + 1) / questions.length) * 100)
    : 0

  const reportTelemetry = useCallback(async (type: "error" | "submit_attempt" | "save_progress_error" | "other", payload: Record<string, unknown>, questionId?: string) => {
    try {
      await fetch("/api/public/telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surveyId,
          questionId,
          type,
          payload: {
            ...payload,
            browser: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
            device: typeof window !== "undefined" && window.innerWidth < 768 ? "mobile" : "desktop"
          }
        })
      })
    } catch {
      // Telemetry must never block a survey taker.
    }
  }, [surveyId])

  const loadSurvey = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const previewSuffix = isPreviewRequest ? "?preview=true" : ""
      const response = await fetch(`/api/public/surveys/${surveyId}${previewSuffix}`, { cache: "no-store" })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Survey not found")

      const normalized = normalizeSurvey(payload.survey)
      const initialAnswers = getPrefilledAnswers(normalized, new URLSearchParams(window.location.search))
      const loadedAsTest = normalized.status === "testing" || isPreviewRequest
      setSurvey(normalized)
      setAnswers(initialAnswers)

      if (normalized.settings?.preventMultiple && localStorage.getItem(`survey_submitted_${surveyId}`) === "true" && !loadedAsTest) {
        setAlreadySubmitted(true)
      }

      if (normalized.settings?.skipIntro) {
        setStartedAt(Date.now())
        setStep(findNextUnansweredStep(normalized.questions || [], initialAnswers, 0))
      }

      if (normalized.name) document.title = normalized.name
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load survey"
      setError(message)
      await reportTelemetry("error", { errorMessage: message, phase: "load" })
    } finally {
      setLoading(false)
    }
  }, [isPreviewRequest, reportTelemetry, surveyId])

  async function saveResponse(status: "partial" | "completed", nextAnswers = answers) {
    if (!survey) return null

    const { scores, totalScore } = scoreSurveyResponse(questions, nextAnswers)
    const urlParams = captureUrlParamMetadata(survey, nextAnswers)
    const now = Date.now()
    const metadata = {
      browser: navigator.userAgent,
      device: window.innerWidth < 768 ? "mobile" : "desktop",
      url: window.location.href,
      urlParams,
      ...(status === "completed" && startedAt ? { timeToComplete: Math.round((now - startedAt) / 1000) } : {})
    }

    const runSave = async () => {
      setSaving(true)
      try {
        const response = await fetch(`/api/public/surveys/${survey.id}/responses`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            responseId,
            answers: nextAnswers,
            scores,
            totalScore,
            status,
            isTest,
            metadata
          })
        })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || "Failed to save response")
        if (payload.response?.id) setResponseId(payload.response.id)
        return payload.response
      } catch (err) {
        await reportTelemetry(status === "completed" ? "error" : "save_progress_error", {
          errorMessage: err instanceof Error ? err.message : String(err),
          answers: nextAnswers,
          scores,
          currentStep: step,
          url: window.location.href
        })
        if (status === "completed") throw err
        return null
      } finally {
        setSaving(false)
      }
    }

    const nextSave = lastSaveRef.current.then(runSave, runSave)
    lastSaveRef.current = nextSave
    return nextSave
  }

  function startSurvey() {
    if (!survey) return
    setStartedAt(Date.now())
    setHistory([-1])
    setStep(findNextUnansweredStep(questions, answers, 0))
  }

  async function goNext(nextAnswers = answers) {
    if (!survey || !currentQuestion) return

    if (!isAnswered(currentQuestion, nextAnswers[currentQuestion.id])) {
      setError("Please answer this question to continue.")
      return
    }

    setError(null)
    await saveResponse("partial", nextAnswers)

    const nextStep = getNextStep(survey, currentQuestion, nextAnswers, step + 1)
    if (nextStep >= questions.length) {
      await submit(nextAnswers)
      return
    }

    setHistory((current) => [...current, step])
    setStep(nextStep)
    setThisOrThatIndex(0)
  }

  function goBack() {
    const previous = history[history.length - 1]
    if (previous === undefined) return
    setHistory((current) => current.slice(0, -1))
    setStep(previous)
    setThisOrThatIndex(0)
  }

  async function submit(nextAnswers = answers) {
    setError(null)
    try {
      await reportTelemetry("submit_attempt", { answers: nextAnswers }, currentQuestion?.id)
      await saveResponse("completed", nextAnswers)
      localStorage.setItem(`survey_submitted_${surveyId}`, "true")
      setSubmitted(true)
    } catch (err) {
      setError("Failed to submit response. Please try again.")
    }
  }

  function setAnswer(questionId: string, value: unknown) {
    setAnswers((current) => ({ ...current, [questionId]: value }))
  }

  useEffect(() => {
    loadSurvey()
  }, [loadSurvey])

  if (loading) {
    return (
      <SurveyShell style={style}>
        <div className="grid min-h-screen place-items-center">
          <div className="text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin" style={{ color: style.accentColor }} />
            <p className="mt-3 text-sm" style={{ color: textMuted }}>Loading survey...</p>
          </div>
        </div>
      </SurveyShell>
    )
  }

  if (error && !survey) {
    return (
      <SurveyShell style={style}>
        <div className="grid min-h-screen place-items-center px-4">
          <div className="max-w-md rounded-2xl border p-6 text-center" style={{ borderColor, backgroundColor: panelBg }}>
            <h1 className="text-2xl font-semibold">Survey unavailable</h1>
            <p className="mt-2 text-sm" style={{ color: textMuted }}>{error}</p>
          </div>
        </div>
      </SurveyShell>
    )
  }

  if (!survey) return null

  if (alreadySubmitted) {
    return (
      <SurveyShell style={style}>
        <CenteredPanel style={style}>
          <CheckCircle2 className="mx-auto h-14 w-14" style={{ color: style.accentColor }} />
          <h1 className="mt-5 text-2xl font-semibold">Response already saved</h1>
          <p className="mt-2 text-sm" style={{ color: textMuted }}>
            Multiple responses are restricted for this survey.
          </p>
        </CenteredPanel>
      </SurveyShell>
    )
  }

  if (submitted) {
    return (
      <SurveyShell style={style}>
        <CenteredPanel style={style}>
          <CheckCircle2 className="mx-auto h-16 w-16" style={{ color: style.accentColor }} />
          <h1 className="mt-6 text-3xl font-semibold">{settings.thankYouTitle || "Thank you"}</h1>
          <p className="mx-auto mt-3 max-w-lg text-base" style={{ color: textMuted }}>
            {settings.thankYouMessage || "Your response has been submitted."}
          </p>
          {settings.thankYouShowSubmitAnother !== false && !settings.preventMultiple ? (
            <button
              className="mt-8 rounded-full px-6 py-3 text-sm font-semibold text-white"
              style={{ backgroundColor: style.accentColor }}
              onClick={() => window.location.reload()}
            >
              {settings.thankYouSubmitAnotherButtonText || "Submit another response"}
            </button>
          ) : null}
        </CenteredPanel>
      </SurveyShell>
    )
  }

  return (
    <SurveyShell style={style}>
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-4 py-10">
        {isTest ? (
          <div className="mb-5 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            Test mode: responses will be marked as test entries.
          </div>
        ) : null}

        {step === -1 ? (
          <section className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {style.logoUrl ? <img src={style.logoUrl} alt="" className="mx-auto mb-6 max-h-20" /> : null}
            <h1 className="text-4xl font-semibold tracking-normal md:text-5xl">{survey.name}</h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8" style={{ color: textMuted }}>
              {survey.description}
            </p>
            {questions.length === 0 ? (
              <p className="mt-8 rounded-md border px-4 py-3 text-sm" style={{ borderColor, color: textMuted }}>
                This survey has no questions yet.
              </p>
            ) : (
              <button
                className="mt-8 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white"
                style={{ backgroundColor: style.accentColor }}
                onClick={startSurvey}
              >
                Get Started
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </section>
        ) : currentQuestion ? (
          <section className="rounded-2xl border p-5 shadow-sm md:p-7" style={{ borderColor, backgroundColor: panelBg }}>
            <div className="mb-7">
              <div className="flex items-center justify-between gap-4 text-xs font-semibold uppercase tracking-wide" style={{ color: textMuted }}>
                <span>{currentQuestion.category || "Question"}</span>
                <span>{step + 1} of {questions.length}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ backgroundColor: withAlpha(style.textColor, 0.12) }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${completionPercent}%`, backgroundColor: style.accentColor }} />
              </div>
            </div>

            <h2 className="text-2xl font-semibold leading-tight">{currentQuestion.question}</h2>
            {currentQuestion.description ? (
              <p className="mt-2 text-sm" style={{ color: textMuted }}>{currentQuestion.description}</p>
            ) : null}

            <div className="mt-7">
              <QuestionInput
                question={currentQuestion}
                answers={answers}
                setAnswer={setAnswer}
                style={style}
                matchupIndex={thisOrThatIndex}
                setMatchupIndex={setThisOrThatIndex}
              />
            </div>

            {error ? <p className="mt-5 text-sm text-red-300">{error}</p> : null}

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <button
                className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-40"
                style={{ borderColor, color: style.textColor }}
                disabled={history.length === 0 || saving}
                onClick={goBack}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: style.accentColor }}
                disabled={saving}
                onClick={() => goNext()}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {step === questions.length - 1 ? "Submit" : buttonLabel}
                {!saving ? <ArrowRight className="h-4 w-4" /> : null}
              </button>
            </div>
          </section>
        ) : null}
      </main>
    </SurveyShell>
  )
}

function QuestionInput({
  question,
  answers,
  setAnswer,
  style,
  matchupIndex,
  setMatchupIndex
}: {
  question: SurveyQuestion
  answers: Record<string, unknown>
  setAnswer: (questionId: string, value: unknown) => void
  style: SurveyStyle
  matchupIndex: number
  setMatchupIndex: (index: number) => void
}) {
  const value = answers[question.id]
  const activeOptions = getActiveOptions(question, answers)

  if (question.type === "multiple-choice") {
    const selectedValues = Array.isArray(value) ? value.map(String) : value ? [String(value)] : []
    return (
      <div className="space-y-3">
        {activeOptions.map((option) => {
          const selected = selectedValues.includes(option)
          return (
            <button
              key={option}
              type="button"
              className="flex w-full items-center justify-between rounded-xl border px-4 py-4 text-left text-sm font-medium transition"
              style={{
                borderColor: selected ? style.accentColor : withAlpha(style.textColor, 0.14),
                backgroundColor: selected ? withAlpha(style.accentColor, 0.16) : withAlpha(style.textColor, 0.04)
              }}
              onClick={() => {
                if (question.allowMultiple) {
                  const next = selected
                    ? selectedValues.filter((item) => item !== option)
                    : [...selectedValues, option]
                  setAnswer(question.id, next)
                } else {
                  setAnswer(question.id, option)
                }
              }}
            >
              <span>{option}</span>
              {selected ? <Check className="h-4 w-4" style={{ color: style.accentColor }} /> : null}
            </button>
          )
        })}
        {question.allowOther ? (
          <input
            value={typeof value === "string" && value.startsWith("Other: ") ? value.slice(7) : ""}
            onChange={(event) => setAnswer(question.id, event.target.value ? `Other: ${event.target.value}` : "")}
            className="h-12 w-full rounded-xl border bg-transparent px-4 text-sm outline-none"
            style={{ borderColor: withAlpha(style.textColor, 0.14), color: style.textColor }}
            placeholder="Other..."
          />
        ) : null}
      </div>
    )
  }

  if (question.type === "text" || question.type === "email") {
    return (
      <textarea
        value={String(value || "")}
        onChange={(event) => setAnswer(question.id, event.target.value)}
        className="min-h-32 w-full rounded-xl border bg-transparent px-4 py-3 text-base outline-none"
        style={{ borderColor: withAlpha(style.textColor, 0.16), color: style.textColor }}
        placeholder={question.placeholder || "Type your answer..."}
      />
    )
  }

  if (question.type === "rating") {
    const min = question.minRating || 1
    const max = question.maxRating || 5
    return (
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: max - min + 1 }, (_, index) => min + index).map((rating) => {
          const selected = value === rating
          return (
            <button
              key={rating}
              className="grid h-12 w-12 place-items-center rounded-xl border text-sm font-semibold"
              style={{
                borderColor: selected ? style.accentColor : withAlpha(style.textColor, 0.16),
                backgroundColor: selected ? withAlpha(style.accentColor, 0.16) : "transparent"
              }}
              onClick={() => setAnswer(question.id, rating)}
            >
              {rating}
            </button>
          )
        })}
      </div>
    )
  }

  if (question.type === "ranked-order") {
    const currentOrder = Array.isArray(value) ? value.map(String) : activeOptions
    return (
      <div className="space-y-2">
        {currentOrder.map((option, index) => (
          <div key={`${option}-${index}`} className="flex items-center gap-2 rounded-xl border px-3 py-3" style={{ borderColor: withAlpha(style.textColor, 0.14) }}>
            <GripVertical className="h-4 w-4 opacity-50" />
            <span className="flex-1 text-sm font-medium">{option}</span>
            <button className="text-xs opacity-75 disabled:opacity-30" disabled={index === 0} onClick={() => setAnswer(question.id, moveItem(currentOrder, index, -1))}>Up</button>
            <button className="text-xs opacity-75 disabled:opacity-30" disabled={index === currentOrder.length - 1} onClick={() => setAnswer(question.id, moveItem(currentOrder, index, 1))}>Down</button>
          </div>
        ))}
      </div>
    )
  }

  if (question.type === "this-or-that") {
    const currentMatchups = getMatchups(question, answers)
    const matchup = currentMatchups[matchupIndex] || currentMatchups[0]
    if (!matchup) return <p>No comparison options available.</p>
    return (
      <div className="space-y-5">
        <div className="text-center text-sm opacity-70">
          Pair {Math.min(matchupIndex + 1, currentMatchups.length)} of {currentMatchups.length}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[matchup.left, matchup.right].map((option) => (
            <button
              key={option}
              className="rounded-2xl border px-5 py-8 text-center text-lg font-semibold transition"
              style={{
                borderColor: matchup.selected === option ? style.accentColor : withAlpha(style.textColor, 0.14),
                backgroundColor: matchup.selected === option ? withAlpha(style.accentColor, 0.16) : withAlpha(style.textColor, 0.04)
              }}
              onClick={() => {
                const nextMatchups = currentMatchups.map((item, index) => index === matchupIndex ? { ...item, selected: option } : item)
                setAnswer(question.id, nextMatchups)
                setMatchupIndex(Math.min(matchupIndex + 1, currentMatchups.length - 1))
              }}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (question.type === "contact-info") {
    const fields = question.contactFields || ["first_name", "email"]
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((field) => (
          <input
            key={field}
            value={String(answers[`${question.id}_${field}`] || "")}
            onChange={(event) => {
              setAnswer(`${question.id}_${field}`, event.target.value)
              setAnswer(question.id, "filled")
            }}
            className="h-12 rounded-xl border bg-transparent px-4 text-sm outline-none"
            style={{ borderColor: withAlpha(style.textColor, 0.16), color: style.textColor }}
            placeholder={field.split("_").map((part) => part[0].toUpperCase() + part.slice(1)).join(" ")}
          />
        ))}
      </div>
    )
  }

  return null
}

function SurveyShell({ children, style }: { children: React.ReactNode; style: SurveyStyle }) {
  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: style.backgroundColor,
        color: style.textColor,
        fontFamily: style.fontFamily
      }}
    >
      {children}
    </div>
  )
}

function CenteredPanel({ children, style }: { children: React.ReactNode; style: SurveyStyle }) {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <section className="w-full max-w-xl rounded-2xl border p-8 text-center shadow-sm" style={{ borderColor: withAlpha(style.textColor, 0.16), backgroundColor: withAlpha(style.textColor, 0.06) }}>
        {children}
      </section>
    </main>
  )
}

function normalizeSurvey(row: PublicSurveyRow): PublicSurveyRow {
  return {
    ...row,
    description: row.description || "",
    questions: Array.isArray(row.questions) ? row.questions : [],
    style: { ...DEFAULT_STYLE, ...(row.style || {}) },
    settings: row.settings || {}
  }
}

function getPrefilledAnswers(survey: PublicSurveyRow, params: URLSearchParams) {
  const prefilled: Record<string, unknown> = {}

  for (const question of survey.questions || []) {
    if (question.paramMapping) {
      const value = params.get(question.paramMapping)
      if (value) prefilled[question.id] = value
    }

    if (question.type === "contact-info" && question.contactParamMappings) {
      let hasContactValue = false
      for (const [field, paramName] of Object.entries(question.contactParamMappings)) {
        const value = paramName ? params.get(paramName) : null
        if (value) {
          prefilled[`${question.id}_${field}`] = value
          hasContactValue = true
        }
      }
      if (hasContactValue) prefilled[question.id] = "filled"
    }
  }

  return prefilled
}

function captureUrlParamMetadata(survey: PublicSurveyRow, answers: Record<string, unknown>) {
  const metadata: Record<string, string> = {}

  for (const param of survey.settings?.urlParams || []) {
    const value = readSearchParam(param)
    if (value) metadata[param] = value
  }

  for (const question of survey.questions || []) {
    if (question.paramMapping && answers[question.id]) {
      metadata[question.paramMapping] = String(answers[question.id])
    }
  }

  return metadata
}

function getActiveOptions(question: SurveyQuestion, answers: Record<string, unknown>) {
  if (question.dynamicOptionsFromQuestionId) {
    const source = answers[question.dynamicOptionsFromQuestionId]
    if (Array.isArray(source)) return source.map(String)
    if (source) return [String(source)]
    return []
  }
  return question.options || []
}

function getMatchups(question: SurveyQuestion, answers: Record<string, unknown>): Matchup[] {
  const existing = answers[question.id]
  if (Array.isArray(existing) && existing.every((item) => typeof item === "object" && item !== null && "left" in item && "right" in item)) {
    return existing as Matchup[]
  }

  const options = getActiveOptions(question, answers)
  const matchups: Matchup[] = []
  for (let i = 0; i < options.length; i++) {
    for (let j = i + 1; j < options.length; j++) {
      matchups.push({ left: options[i], right: options[j] })
    }
  }
  return matchups.slice(0, 15)
}

function isAnswered(question: SurveyQuestion, value: unknown) {
  if (!question.required) return true
  if (question.type === "this-or-that") {
    return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "object" && item !== null && "selected" in item)
  }
  if (Array.isArray(value)) return value.length > 0
  return value !== undefined && value !== null && value !== ""
}

function getNextStep(survey: PublicSurveyRow, question: SurveyQuestion, answers: Record<string, unknown>, fallbackStep: number) {
  const answer = answers[question.id]
  const selectedAnswers = Array.isArray(answer) ? answer.map(String) : answer ? [String(answer)] : []
  const target = selectedAnswers.map((value) => question.logic?.[value]).find(Boolean)

  if (target === "end") return (survey.questions || []).length
  if (target) {
    const targetIndex = (survey.questions || []).findIndex((candidate) => candidate.id === target)
    if (targetIndex >= 0) return targetIndex
  }

  return findNextUnansweredStep(survey.questions || [], answers, fallbackStep)
}

function findNextUnansweredStep(questions: SurveyQuestion[], answers: Record<string, unknown>, start: number) {
  let index = start
  while (index < questions.length && answers[questions[index].id]) index += 1
  return index
}

function moveItem(items: string[], index: number, direction: -1 | 1) {
  const target = index + direction
  if (target < 0 || target >= items.length) return items
  const next = [...items]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item)
  return next
}

function readSearchParam(key: string) {
  if (typeof window === "undefined") return null
  return new URLSearchParams(window.location.search).get(key)
}

function withAlpha(hex: string, opacity: number) {
  const normalized = hex.startsWith("#") ? hex.slice(1) : hex
  if (normalized.length !== 6) return hex
  const alpha = Math.round(opacity * 255).toString(16).padStart(2, "0")
  return `#${normalized}${alpha}`
}
