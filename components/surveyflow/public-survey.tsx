"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ExternalLink, GripVertical, Loader2 } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { scoreSurveyResponse } from "@/lib/surveyflow/scoring"
import { computeThisOrThatRankings, shouldUseInferenceAlgorithm } from "@/lib/surveyflow/this-or-that"
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
  selected?: string | null
  inferred?: boolean | null
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
  const responseIdRef = useRef<string | null>(null)
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
            responseId: responseIdRef.current || responseId,
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
        if (payload.response?.id) {
          responseIdRef.current = payload.response.id
          setResponseId(payload.response.id)
        }
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

  async function handleThisOrThatSelection(option: string) {
    if (!survey || !currentQuestion || currentQuestion.type !== "this-or-that") return

    const currentMatchups = getMatchups(currentQuestion, answers)
    let updatedMatchups = currentMatchups.map((matchup, index) => (
      index === thisOrThatIndex ? { ...matchup, selected: option, inferred: false } : matchup
    ))

    if (shouldUseInferenceAlgorithm(currentQuestion)) {
      updatedMatchups = runTransitiveInference(updatedMatchups, getActiveOptions(currentQuestion, answers))
    }

    const nextAnswers = { ...answers, [currentQuestion.id]: updatedMatchups }
    setAnswers(nextAnswers)
    void saveResponse("partial", nextAnswers)

    const nextIndex = findNextUnansweredMatchup(updatedMatchups, thisOrThatIndex)
    if (nextIndex >= 0) {
      window.setTimeout(() => setThisOrThatIndex(nextIndex), 350)
      return
    }

    window.setTimeout(() => {
      void goNext(nextAnswers)
    }, 400)
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

  function renderThankYouResults() {
    if (!survey) return null

    const configuredQuestion = settings.thankYouShowResults && settings.thankYouHighlightedQuestionId
      ? questions.find((candidate) => candidate.id === settings.thankYouHighlightedQuestionId)
      : undefined
    const fallbackThisOrThatQuestion = questions.find((candidate) => (
      candidate.type === "this-or-that" &&
      answers[candidate.id] &&
      getRankedOptionsForAnswer(candidate, answers).length > 0
    ))
    const question = configuredQuestion || fallbackThisOrThatQuestion
    if (!question) return null

    const answer = answers[question.id]
    if (!answer) return null

    const rankedOptions = getRankedOptionsForAnswer(question, answers)
    if (!rankedOptions.length) return null

    const hasAnyLinks = rankedOptions.some((item) => {
      const option = typeof item === "string" ? item : item.option
      return Boolean(getThankYouOptionPresentation(question, option, settings).redirectUrl)
    })

    return (
      <div className="mx-auto mt-10 w-full max-w-xl space-y-6 text-left sm:mt-12">
        <div className="space-y-2 px-1 text-center sm:text-left">
          <h2 className="font-serif text-lg font-extrabold tracking-tight md:text-xl">
            {settings.thankYouRankingsHeader || "Your Preference Rankings"}
          </h2>
          {(settings.thankYouRankingsSubtext !== undefined || hasAnyLinks) ? (
            <p className="font-serif text-xs leading-relaxed sm:text-sm" style={{ color: textMuted }}>
              {settings.thankYouRankingsSubtext || "Tap or click any item with a link icon to learn how to solve this problem in your business today!"}
            </p>
          ) : null}
        </div>

        <div className="space-y-3.5">
          {rankedOptions.map((item, index) => {
            const option = typeof item === "string" ? item : item.option
            const optionPresentation = getThankYouOptionPresentation(question, option, settings)
            const hasLink = Boolean(optionPresentation.redirectUrl)
            const badgeText = getRankingBadgeText(question, item, answer, index)
            const content = (
              <div
                className={["group flex items-center justify-between gap-4 rounded-2xl border p-4 transition-all duration-300 sm:p-5", hasLink ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.995]" : ""].join(" ")}
                style={{
                  borderColor: hasLink ? withAlpha(style.textColor, 0.24) : withAlpha(style.textColor, 0.12),
                  backgroundColor: withAlpha(style.textColor, 0.04)
                }}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3.5">
                  {badgeText ? (
                    <span className="shrink-0 rounded-xl px-3 py-1 font-mono text-[11px] font-black tracking-wide text-white shadow-sm" style={{ backgroundColor: style.accentColor }}>
                      {badgeText}
                    </span>
                  ) : null}
                  <span className="min-w-0 truncate font-serif text-sm font-bold leading-snug text-white sm:text-base">{optionPresentation.label}</span>
                </div>
                {hasLink ? (
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full border transition-all duration-300 group-hover:scale-110 group-hover:bg-white/10"
                    style={{ borderColor: style.accentColor, color: style.accentColor, backgroundColor: withAlpha(style.accentColor, 0.1) }}
                    title={optionPresentation.redirectLabel || "Open resource"}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </span>
                ) : null}
              </div>
            )

            return hasLink ? (
              <button key={option} type="button" className="block w-full text-left" onClick={() => window.open(optionPresentation.redirectUrl, "_blank", "noopener,noreferrer")}>
                {content}
              </button>
            ) : (
              <div key={option}>{content}</div>
            )
          })}
        </div>
      </div>
    )
  }

  useEffect(() => {
    if (!currentQuestion || currentQuestion.type !== "this-or-that") return

    const activeOptions = getActiveOptions(currentQuestion, answers)
    const existing = answers[currentQuestion.id]
    const existingMatchups = isMatchupArray(existing) ? existing : null

    if (existingMatchups && matchupOptionsMatch(existingMatchups, activeOptions)) {
      const firstUnanswered = existingMatchups.findIndex((matchup) => !matchup.selected)
      setThisOrThatIndex(firstUnanswered >= 0 ? firstUnanswered : 0)
      return
    }

    const nextMatchups = createMatchups(activeOptions)
    setAnswers((current) => ({ ...current, [currentQuestion.id]: nextMatchups }))
    setThisOrThatIndex(0)
  // Keep this scoped to question changes and dynamic source changes so pair-card animation timing controls advancement.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion?.id, currentQuestion?.type, answers[currentQuestion?.dynamicOptionsFromQuestionId || ""]])

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
        <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center px-5 py-14 text-center md:py-20">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="w-full"
          >
            <div
              className="relative mx-auto grid h-24 w-24 place-items-center rounded-full border-4"
              style={{ borderColor: style.accentColor, backgroundColor: withAlpha(style.accentColor, 0.08), boxShadow: `0 0 0 8px ${withAlpha(style.accentColor, 0.08)}` }}
            >
              <motion.div
                className="absolute inset-0 rounded-full border"
                style={{ borderColor: style.accentColor }}
                animate={{ scale: [1, 1.14, 1], opacity: [0.35, 0.12, 0.35] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
              <Check className="h-10 w-10" style={{ color: style.accentColor }} strokeWidth={3} />
            </div>

            <h1 className="mt-10 font-serif text-5xl font-extrabold tracking-normal md:text-7xl">
              {settings.thankYouTitle || "Thank You!"}
            </h1>
            <p className="mx-auto mt-5 max-w-3xl font-serif text-xl leading-8 md:text-2xl" style={{ color: textMuted }}>
              {settings.thankYouMessage || "Your response has been recorded. We appreciate your feedback."}
            </p>

            {renderThankYouResults()}

            {settings.thankYouShowSubmitAnother !== false && !settings.preventMultiple ? (
              <button
                className="mt-12 inline-flex items-center justify-center rounded-full px-7 py-3 font-serif text-base font-bold text-white transition hover:-translate-y-0.5"
                style={{ backgroundColor: style.accentColor, boxShadow: `0 18px 40px ${withAlpha(style.accentColor, 0.24)}` }}
                onClick={() => window.location.reload()}
              >
                {settings.thankYouSubmitAnotherButtonText || "Submit another response"}
              </button>
            ) : null}
          </motion.div>
        </main>
      </SurveyShell>
    )
  }

  return (
    <SurveyShell style={style}>
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-4 py-10">
        {isTest ? (
          <div
            className="mb-8 flex flex-col gap-4 rounded-3xl border px-6 py-5 text-sm font-semibold sm:flex-row sm:items-center sm:justify-between"
            style={{
              borderColor: withAlpha(style.accentColor, 0.48),
              backgroundColor: withAlpha(style.accentColor, 0.12),
              color: style.accentColor
            }}
          >
            <div>
              <p className="font-serif text-lg font-bold">Test Submission Mode</p>
              <p className="mt-1">This response will be marked as a test entry so you can easily clear it.</p>
            </div>
            <span className="rounded-full bg-white px-5 py-2 font-serif text-sm" style={{ color: style.accentColor }}>
              Preview Active
            </span>
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
          <section
            className={currentQuestion.type === "this-or-that" ? "p-0" : "rounded-2xl border p-5 shadow-sm md:p-7"}
            style={currentQuestion.type === "this-or-that" ? undefined : { borderColor, backgroundColor: panelBg }}
          >
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
                onThisOrThatSelection={handleThisOrThatSelection}
              />
            </div>

            {error ? <p className="mt-5 text-sm text-red-300">{error}</p> : null}

            {currentQuestion.type !== "this-or-that" ? (
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
            ) : null}
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
  setMatchupIndex,
  onThisOrThatSelection
}: {
  question: SurveyQuestion
  answers: Record<string, unknown>
  setAnswer: (questionId: string, value: unknown) => void
  style: SurveyStyle
  matchupIndex: number
  setMatchupIndex: (index: number) => void
  onThisOrThatSelection: (option: string) => void
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
                  const maxSelections = question.maxSelections || Number.POSITIVE_INFINITY
                  const next = selected
                    ? selectedValues.filter((item) => item !== option)
                    : selectedValues.length < maxSelections ? [...selectedValues, option] : selectedValues
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
      <div className="space-y-8">
        <p className="text-center text-sm font-medium tracking-wide opacity-70">
          Choose your preferred choice in each pair matchup. We will compute your ultimate preferences!
        </p>

        <div className="mx-auto flex max-w-md flex-wrap items-center justify-center gap-1.5">
          {currentMatchups.map((match, index) => {
            const active = index === matchupIndex
            return (
              <button
                key={`${match.left}-${match.right}-${index}`}
                type="button"
                className="h-2.5 rounded-full transition-all duration-300"
                style={{
                  width: active ? "1.5rem" : "0.625rem",
                  opacity: active ? 1 : match.selected ? (match.inferred ? 0.6 : 0.9) : 0.28,
                  backgroundColor: match.selected || active ? style.accentColor : withAlpha(style.textColor, 0.45),
                  border: match.selected && match.inferred ? `1px dashed ${style.textColor}` : undefined
                }}
                title={`Pair ${index + 1}`}
                onClick={() => setMatchupIndex(index)}
              />
            )
          })}
        </div>

        <div className="text-center font-serif text-lg font-bold opacity-75">
          Pair {Math.min(matchupIndex + 1, currentMatchups.length)} of {currentMatchups.length}
        </div>

        <div className="relative mx-auto flex w-full max-w-3xl flex-col items-center justify-center py-2 md:flex-row md:gap-0" style={{ perspective: "1200px" }}>
          <div className="relative w-full overflow-visible md:flex-1" style={{ perspective: "1200px" }}>
            <AnimatePresence mode="wait">
              <motion.button
                key={`left-${matchupIndex}-${matchup.left}`}
                type="button"
                initial={{ rotateY: 90, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                exit={{ rotateY: -90, opacity: 0 }}
                transition={{ duration: 0.28, ease: "easeInOut" }}
                whileHover={{ scale: 1.01, zIndex: 10 }}
                whileTap={{ scale: 0.98 }}
                className="relative z-0 flex min-h-[120px] w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 text-center shadow-sm transition-all md:min-h-[165px]"
                style={{
                  borderColor: matchup.selected === matchup.left ? style.accentColor : withAlpha(style.textColor, 0.16),
                  backgroundColor: matchup.selected === matchup.left ? withAlpha(style.accentColor, 0.16) : withAlpha(style.textColor, 0.04),
                  transformStyle: "preserve-3d",
                  backfaceVisibility: "hidden"
                }}
                onClick={() => onThisOrThatSelection(matchup.left)}
              >
                {matchup.selected === matchup.left ? <SelectedBadge style={style} /> : null}
                <span className="px-4 font-serif text-xl font-bold tracking-normal md:text-2xl">
                  {matchup.left}
                </span>
              </motion.button>
            </AnimatePresence>
          </div>

          <div className="relative z-40 -my-5 flex-shrink-0 select-none md:mx-[-1.25rem] md:my-0">
            <div
              className="grid h-12 w-12 place-items-center rounded-full border-2 font-serif text-sm font-bold shadow-md"
              style={{
                borderColor: withAlpha(style.textColor, 0.16),
                backgroundColor: style.backgroundColor,
                color: style.textColor
              }}
            >
              OR
            </div>
          </div>

          <div className="relative w-full overflow-visible md:flex-1" style={{ perspective: "1200px" }}>
            <AnimatePresence mode="wait">
              <motion.button
                key={`right-${matchupIndex}-${matchup.right}`}
                type="button"
                initial={{ rotateY: 90, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                exit={{ rotateY: -90, opacity: 0 }}
                transition={{ duration: 0.28, ease: "easeInOut" }}
                whileHover={{ scale: 1.01, zIndex: 10 }}
                whileTap={{ scale: 0.98 }}
                className="relative z-0 flex min-h-[120px] w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 text-center shadow-sm transition-all md:min-h-[165px]"
                style={{
                  borderColor: matchup.selected === matchup.right ? style.accentColor : withAlpha(style.textColor, 0.16),
                  backgroundColor: matchup.selected === matchup.right ? withAlpha(style.accentColor, 0.16) : withAlpha(style.textColor, 0.04),
                  transformStyle: "preserve-3d",
                  backfaceVisibility: "hidden"
                }}
                onClick={() => onThisOrThatSelection(matchup.right)}
              >
                {matchup.selected === matchup.right ? <SelectedBadge style={style} /> : null}
                <span className="px-4 font-serif text-xl font-bold tracking-normal md:text-2xl">
                  {matchup.right}
                </span>
              </motion.button>
            </AnimatePresence>
          </div>
        </div>
      </div>
    )
  }

  if (question.type === "contact-info") {
    if (question.contactHiddenCapture) return null

    const fields = question.contactFields || ["first_name", "email"]
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((field) => {
          const fieldAnswer = answers[`${question.id}_${field}`]
          const hideIfPrefilled = question.contactHideIfPrefilled?.[field] !== false
          const alwaysHidden = question.contactAlwaysHidden?.[field] || false
          if (alwaysHidden || (hideIfPrefilled && fieldAnswer)) return null

          return (
            <input
              key={field}
              value={String(fieldAnswer || "")}
              onChange={(event) => {
                setAnswer(`${question.id}_${field}`, event.target.value)
                setAnswer(question.id, "filled")
              }}
              className="h-12 rounded-xl border bg-transparent px-4 text-sm outline-none"
              style={{ borderColor: withAlpha(style.textColor, 0.16), color: style.textColor }}
              placeholder={field.split("_").map((part) => part[0].toUpperCase() + part.slice(1)).join(" ")}
            />
          )
        })}
      </div>
    )
  }

  return null
}

function SelectedBadge({ style }: { style: SurveyStyle }) {
  return (
    <span
      className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full text-xs font-black text-white shadow-lg md:h-8 md:w-8"
      style={{ backgroundColor: style.accentColor }}
    >
      ✓
    </span>
  )
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
    } else if (question.type === "multiple-choice") {
      let prefilledOptions: string[] = []
      if (question.optionParamMappings) {
        for (const [option, paramName] of Object.entries(question.optionParamMappings)) {
          const value = paramName ? params.get(paramName) : null
          if (value && (["true", "1", "yes"].includes(value.toLowerCase()) || value.toLowerCase() === option.toLowerCase())) {
            prefilledOptions.push(option)
          }
        }
      }

      if (prefilledOptions.length === 0 && question.paramMapping) {
        const value = params.get(question.paramMapping)
        if (value) {
          if (question.allowMultiple) {
            const parts = value.split(",").map((part) => part.trim().toLowerCase())
            prefilledOptions = (question.options || []).filter((option) => parts.includes(option.toLowerCase()))
          } else {
            const matched = (question.options || []).find((option) => option.toLowerCase() === value.toLowerCase())
            if (matched) prefilledOptions = [matched]
          }
        }
      }

      if (prefilledOptions.length > 0) {
        prefilled[question.id] = question.allowMultiple ? prefilledOptions : prefilledOptions[0]
      }
    } else if (question.paramMapping) {
      const value = params.get(question.paramMapping)
      if (value) prefilled[question.id] = value
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

    if (question.contactParamMappings) {
      for (const paramName of Object.values(question.contactParamMappings)) {
        const value = paramName ? readSearchParam(paramName) : null
        if (paramName && value) metadata[paramName] = value
      }
    }

    if (question.optionParamMappings) {
      for (const paramName of Object.values(question.optionParamMappings)) {
        const value = paramName ? readSearchParam(paramName) : null
        if (paramName && value) metadata[paramName] = value
      }
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
  if (isMatchupArray(existing)) {
    return existing
  }

  return createMatchups(getActiveOptions(question, answers))
}

function createMatchups(options: string[]): Matchup[] {
  const matchups: Matchup[] = []
  for (let i = 0; i < options.length; i++) {
    for (let j = i + 1; j < options.length; j++) {
      const swap = Math.random() > 0.5
      matchups.push({ left: swap ? options[j] : options[i], right: swap ? options[i] : options[j] })
    }
  }

  return shuffle(matchups).slice(0, 15)
}

function isMatchupArray(value: unknown): value is Matchup[] {
  return Array.isArray(value) && value.every((item) => (
    typeof item === "object" && item !== null && "left" in item && "right" in item
  ))
}

function matchupOptionsMatch(matchups: Matchup[], options: string[]) {
  const existingOptions = Array.from(new Set(matchups.flatMap((matchup) => [matchup.left, matchup.right])))
  return existingOptions.length === options.length && existingOptions.every((option) => options.includes(option))
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5)
}

function findNextUnansweredMatchup(matchups: Matchup[], currentIndex: number) {
  for (let index = currentIndex + 1; index < matchups.length; index += 1) {
    if (!matchups[index].selected) return index
  }

  for (let index = 0; index < currentIndex; index += 1) {
    if (!matchups[index].selected) return index
  }

  return -1
}

function runTransitiveInference(matchups: Matchup[], options: string[]) {
  const directWins = new Map<string, Set<string>>()
  options.forEach((option) => directWins.set(option, new Set()))

  matchups.forEach((matchup) => {
    if (!matchup.selected || matchup.inferred) return
    const loser = matchup.selected === matchup.left ? matchup.right : matchup.left
    directWins.get(matchup.selected)?.add(loser)
  })

  const reachable = new Map<string, Set<string>>()
  options.forEach((option) => reachable.set(option, new Set(directWins.get(option))))

  let changed = true
  while (changed) {
    changed = false
    for (const option of options) {
      const optionReachable = reachable.get(option)
      if (!optionReachable) continue
      for (const reached of Array.from(optionReachable)) {
        const reachedSet = reachable.get(reached)
        if (!reachedSet) continue
        for (const transitive of Array.from(reachedSet)) {
          if (!optionReachable.has(transitive) && option !== transitive) {
            optionReachable.add(transitive)
            changed = true
          }
        }
      }
    }
  }

  return matchups.map((matchup) => {
    if (matchup.selected && !matchup.inferred) return matchup

    const leftReachesRight = reachable.get(matchup.left)?.has(matchup.right) || false
    const rightReachesLeft = reachable.get(matchup.right)?.has(matchup.left) || false

    if (leftReachesRight && !rightReachesLeft) return { ...matchup, selected: matchup.left, inferred: true }
    if (rightReachesLeft && !leftReachesRight) return { ...matchup, selected: matchup.right, inferred: true }
    return { ...matchup, selected: null, inferred: null }
  })
}

function isAnswered(question: SurveyQuestion, value: unknown) {
  if (question.type === "contact-info" && question.contactHiddenCapture) return true
  if (!question.required) return true
  if (question.type === "this-or-that") {
    return isMatchupArray(value) && value.length > 0 && value.every((item) => Boolean(item.selected))
  }
  if (Array.isArray(value)) return value.length > 0
  return value !== undefined && value !== null && value !== ""
}

function getRankedOptionsForAnswer(question: SurveyQuestion, answers: Record<string, unknown>) {
  const answer = answers[question.id]

  if (question.type === "ranked-order") {
    return Array.isArray(answer) ? answer.map(String) : []
  }

  if (question.type === "this-or-that") {
    return computeThisOrThatRankings({
      question,
      answer,
      options: getActiveOptions(question, answers)
    })
  }

  if (question.type === "multiple-choice") {
    const selected = Array.isArray(answer) ? answer.map(String) : answer ? [String(answer)] : []
    const remaining = (question.options || []).filter((option) => !selected.includes(option))
    return [...selected, ...remaining]
  }

  return question.options || []
}

function getRankingBadgeText(question: SurveyQuestion, item: string | ReturnType<typeof computeThisOrThatRankings>[number], answer: unknown, index: number) {
  if (question.type === "ranked-order") return `#${index + 1}`

  if (question.type === "this-or-that") {
    if (typeof item !== "string" && shouldUseInferenceAlgorithm(question)) {
      return `#${item.rank} (${Math.round(item.winPercentage * 100)}% Win)`
    }

    const option = typeof item === "string" ? item : item.option
    const matches = Array.isArray(answer)
      ? answer.filter((matchup) => typeof matchup === "object" && matchup !== null && "selected" in matchup && matchup.selected === option).length
      : 0
    return `${matches} win${matches === 1 ? "" : "s"}`
  }

  if (question.type === "multiple-choice") {
    const option = typeof item === "string" ? item : item.option
    if (Array.isArray(answer)) return answer.map(String).includes(option) ? "Selected" : ""
    return String(answer || "") === option ? "Selected" : ""
  }

  return ""
}

function getThankYouOptionPresentation(question: SurveyQuestion, option: string, settings: SurveySettings) {
  const metadata = question.optionMetadata?.[option]
  const legacyLink = settings.thankYouOptionLinks?.[`${question.id}_${option}`]

  return {
    label: metadata?.resultLabel?.trim() || option,
    redirectUrl: metadata?.redirectUrl?.trim() || legacyLink?.url || "",
    redirectLabel: metadata?.redirectLabel?.trim() || legacyLink?.label || ""
  }
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
  while (
    index < questions.length &&
    (
      answers[questions[index].id] ||
      (questions[index].type === "contact-info" && questions[index].contactHiddenCapture)
    )
  ) {
    index += 1
  }
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
