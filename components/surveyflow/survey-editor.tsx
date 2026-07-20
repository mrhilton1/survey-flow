"use client"

import Link from "next/link"
import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronDown,
  Eye,
  ExternalLink,
  GitBranch,
  GripVertical,
  HelpCircle,
  ImageIcon,
  Loader2,
  Palette,
  Plus,
  Save,
  Settings,
  SlidersHorizontal,
  Star,
  Trophy,
  Trash2,
  Video
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { DEFAULT_SURVEY_SETTINGS, DEFAULT_SURVEY_STYLE } from "@/lib/surveyflow/defaults"
import type { QuestionType, SurveyQuestion, SurveySettings, SurveyStatus, SurveyStyle, ThankYouOpenPageConfig, ThankYouPage, ThankYouPageContent, ThankYouRouterCondition, ThankYouRouterRule, ThankYouVisualBlock, ThankYouVisualBlockType } from "@/lib/surveyflow/types"

interface SurveyEditorRow {
  id: string
  name: string
  description: string | null
  seo_description: string | null
  questions: SurveyQuestion[] | null
  style: SurveyStyle | null
  settings: SurveySettings | null
  status: SurveyStatus
  updated_at: string
}

type EditorTab = "questions" | "design" | "outcomes" | "settings"

const COMMON_URL_PARAMS = [
  "em",
  "email",
  "first_name",
  "last_name",
  "name",
  "company",
  "phone",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "ref"
]

const QUESTION_TYPES: Array<{ value: QuestionType; label: string }> = [
  { value: "multiple-choice", label: "Multiple Choice" },
  { value: "this-or-that", label: "This or That" },
  { value: "ranked-order", label: "Ranked Order" },
  { value: "text", label: "Text Input" },
  { value: "rating", label: "Rating" },
  { value: "contact-info", label: "Contact Form" }
]

function getQuestionTypeLabel(type: QuestionType) {
  return QUESTION_TYPES.find((item) => item.value === type)?.label || type
}

const STATUS_OPTIONS: SurveyStatus[] = ["draft", "testing", "published"]
const OPTION_QUESTION_TYPES: QuestionType[] = ["multiple-choice", "ranked-order", "this-or-that"]
const CONTACT_FIELDS = [
  { value: "first_name", label: "First name" },
  { value: "last_name", label: "Last name" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "company", label: "Company" }
]

const VISUAL_THANK_YOU_BLOCK_TYPES: Array<{ value: ThankYouVisualBlockType; label: string; description: string; needsQuestion?: boolean }> = [
  { value: "icon", label: "Checkmark Icon", description: "Show the completion checkmark." },
  { value: "heading", label: "Heading", description: "Large page title text." },
  { value: "text", label: "Text", description: "Supporting body copy." },
  { value: "button", label: "Button", description: "A call-to-action link or submit-another action." },
  { value: "divider", label: "Divider", description: "A simple visual separator." },
  { value: "image", label: "Image", description: "Add a responsive image by URL." },
  { value: "video", label: "Video", description: "Add a hosted video or embed URL." },
  { value: "schedule", label: "Schedule / Booking", description: "Embed Calendly, Cal.com, SavvyCal, or another booking page." },
  { value: "form", label: "Form", description: "Capture contact details after submission." },
  { value: "preference-results", label: "Preference Results", description: "Render the respondent's ranked preference list.", needsQuestion: true },
  { value: "top-preference", label: "Top Preference", description: "Render only the highest ranked item.", needsQuestion: true },
  { value: "answer-summary", label: "Answer Summary", description: "Render submitted answers.", needsQuestion: true },
  { value: "contact-fields", label: "Contact Fields", description: "Render normalized lead fields." },
  { value: "raw-metadata", label: "URL Parameters", description: "Render captured URL parameters." }
]

function createVisualBlock(type: ThankYouVisualBlockType, props: ThankYouVisualBlock["props"] = {}): ThankYouVisualBlock {
  return {
    id: crypto.randomUUID(),
    type,
    variant: "default",
    props: {
      visible: true,
      ...props
    }
  }
}

function createDefaultOpenPageConfig(name: string, settings: SurveySettings, questions: SurveyQuestion[]): ThankYouOpenPageConfig {
  const firstRankingQuestion = questions.find((question) => ["this-or-that", "ranked-order", "multiple-choice"].includes(question.type))

  return {
    name,
    path: "/thank-you",
    blocks: [
      createVisualBlock("icon", { icon: "check", align: "center" }),
      createVisualBlock("heading", { text: settings.thankYouTitle || "Thank You!", align: "center" }),
      createVisualBlock("text", { text: settings.thankYouMessage || "Your response has been recorded. We appreciate your feedback.", align: "center" }),
      createVisualBlock("preference-results", {
        label: settings.thankYouRankingsHeader || "Your Preference Rankings",
        questionId: settings.thankYouHighlightedQuestionId || firstRankingQuestion?.id
      }),
      createVisualBlock("button", { label: settings.thankYouSubmitAnotherButtonText || "Submit another response" })
    ],
    theme: {}
  }
}

function createOpenPageConfigFromContent(name: string, content: ThankYouPageContent, questions: SurveyQuestion[]): ThankYouOpenPageConfig {
  const firstRankingQuestion = questions.find((question) => ["this-or-that", "ranked-order", "multiple-choice"].includes(question.type))

  return {
    name,
    path: "/thank-you",
    blocks: [
      createVisualBlock("icon", { icon: "check", align: "center" }),
      createVisualBlock("heading", { text: content.title || "Thank You!", align: "center" }),
      createVisualBlock("text", { text: content.message || "Your response has been recorded.", align: "center" }),
      createVisualBlock("preference-results", {
        label: content.rankingsHeader || "Your Preference Rankings",
        questionId: content.highlightedQuestionId || firstRankingQuestion?.id
      }),
      createVisualBlock("button", { label: content.ctaLabel || "Submit another response", href: content.ctaUrl })
    ],
    theme: content.openPageConfig?.theme || {}
  }
}

export function SurveyEditor({ surveyId }: { surveyId: string }) {
  const [survey, setSurvey] = useState<SurveyEditorRow | null>(null)
  const [activeTab, setActiveTab] = useState<EditorTab>("questions")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0)
  const [settingsOpen, setSettingsOpen] = useState(true)
  const [thankYouPages, setThankYouPages] = useState<ThankYouPage[]>([])
  const [thankYouBuilderAllowed, setThankYouBuilderAllowed] = useState(false)

  const questions = survey?.questions || []
  const style = survey?.style || DEFAULT_SURVEY_STYLE
  const settings = survey?.settings || DEFAULT_SURVEY_SETTINGS

  const publicUrl = useMemo(() => {
    if (typeof window === "undefined") return `/s/${surveyId}`
    return `${window.location.origin}/s/${surveyId}`
  }, [surveyId])

  const loadThankYouPages = useCallback(async () => {
    const response = await fetch(`/api/surveys/${surveyId}/thank-you-pages`, { cache: "no-store" })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error || "Failed to load outcomes")
    setThankYouPages(Array.isArray(payload.pages) ? payload.pages : [])
    setThankYouBuilderAllowed(Boolean(payload.access?.allowed))
  }, [surveyId])

  const loadSurvey = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/surveys/${surveyId}`, { cache: "no-store" })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Failed to load survey")
      const normalizedSurvey = normalizeSurvey(payload.survey)
      setSurvey(normalizedSurvey)
      await loadThankYouPages()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load survey")
    } finally {
      setLoading(false)
    }
  }, [loadThankYouPages, surveyId])

  async function saveSurvey() {
    if (!survey) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/surveys/${surveyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: survey.name,
          description: survey.description || "",
          seo_description: survey.seo_description || "",
          status: survey.status,
          questions: survey.questions || [],
          style: survey.style || DEFAULT_SURVEY_STYLE,
          settings: survey.settings || DEFAULT_SURVEY_SETTINGS
        })
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Failed to save survey")
      setSurvey(normalizeSurvey(payload.survey))
      setSavedAt(new Date().toLocaleTimeString())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save survey")
    } finally {
      setSaving(false)
    }
  }

  function updateSurvey(updates: Partial<SurveyEditorRow>) {
    setSurvey((current) => current ? { ...current, ...updates } : current)
  }

  function updateStyle(updates: Partial<SurveyStyle>) {
    updateSurvey({ style: { ...style, ...updates } })
  }

  function updateSettings(updates: Partial<SurveySettings>) {
    updateSurvey({ settings: { ...settings, ...updates } })
  }

  async function createThankYouPage() {
    setSaving(true)
    setError(null)
    const pageName = `Outcome ${thankYouPages.length + 1}`
    try {
      const response = await fetch(`/api/surveys/${surveyId}/thank-you-pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: pageName,
          isDefault: thankYouPages.length === 0,
          content: {
            title: settings.thankYouTitle,
            message: settings.thankYouMessage,
            ctaLabel: settings.thankYouSubmitAnotherButtonText,
            showSubmitAnother: settings.thankYouShowSubmitAnother,
            showResults: settings.thankYouShowResults,
            rankingsHeader: settings.thankYouRankingsHeader,
            rankingsSubtext: settings.thankYouRankingsSubtext,
            highlightedQuestionId: settings.thankYouHighlightedQuestionId,
            openPageConfig: createDefaultOpenPageConfig(pageName, settings, questions)
          } satisfies ThankYouPageContent
        })
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Failed to create outcome")
      const page = payload.page as ThankYouPage
      setThankYouPages((current) => [page, ...current])
      updateSettings({ thankYouPageId: page.id })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create outcome")
    } finally {
      setSaving(false)
    }
  }

  async function saveThankYouPage(pageId: string, updates: { name?: string; content?: ThankYouPageContent; is_default?: boolean; status?: "draft" | "active" | "archived" }) {
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/surveys/${surveyId}/thank-you-pages/${pageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates)
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Failed to save outcome")
      const page = payload.page as ThankYouPage
      setThankYouPages((current) => current.map((candidate) => candidate.id === page.id ? page : candidate))
      setSavedAt(new Date().toLocaleTimeString())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save outcome")
    } finally {
      setSaving(false)
    }
  }

  async function deleteThankYouPage(pageId: string) {
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/surveys/${surveyId}/thank-you-pages/${pageId}`, { method: "DELETE" })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Failed to delete outcome")
      setThankYouPages((current) => current.filter((page) => page.id !== pageId))
      if (settings.thankYouPageId === pageId) updateSettings({ thankYouPageId: undefined })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete outcome")
    } finally {
      setSaving(false)
    }
  }

  function addQuestion() {
    const newQuestion: SurveyQuestion = {
      id: crypto.randomUUID(),
      type: "multiple-choice",
      question: "New Question",
      required: true,
      options: ["Option 1", "Option 2"]
    }
    updateSurvey({ questions: [...questions, newQuestion] })
    setSelectedQuestionIndex(questions.length)
  }

  function updateQuestion(index: number, updates: Partial<SurveyQuestion>) {
    const nextQuestions = [...questions]
    const existing = nextQuestions[index]
    const nextType = updates.type || existing.type
    nextQuestions[index] = normalizeQuestionForType(existing, updates, nextType)
    updateSurvey({ questions: nextQuestions })
  }

  function removeQuestion(index: number) {
    updateSurvey({ questions: questions.filter((_, questionIndex) => questionIndex !== index) })
    setSelectedQuestionIndex((current) => Math.max(0, Math.min(current, questions.length - 2)))
  }

  function moveQuestion(index: number, direction: -1 | 1) {
    const targetIndex = index + direction
    reorderQuestion(index, targetIndex)
  }

  function reorderQuestion(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= questions.length || toIndex >= questions.length) return

    const nextQuestions = [...questions]
    const [question] = nextQuestions.splice(fromIndex, 1)
    nextQuestions.splice(toIndex, 0, question)
    updateSurvey({ questions: nextQuestions })
    setSelectedQuestionIndex((current) => {
      if (current === fromIndex) return toIndex
      if (fromIndex < current && current <= toIndex) return current - 1
      if (toIndex <= current && current < fromIndex) return current + 1
      return current
    })
  }

  useEffect(() => {
    loadSurvey()
  }, [loadSurvey])

  if (loading) {
    return (
      <div className="grid min-h-96 place-items-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand-700" />
          <p className="mt-3 text-sm text-slate-500">Loading survey editor...</p>
        </div>
      </div>
    )
  }

  if (!survey) {
    return (
      <div className="mx-auto max-w-4xl rounded-md border border-red-200 bg-red-50 p-6 text-red-700">
        {error || "Survey not found"}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="sticky top-0 z-20 border-b border-border bg-white shadow-sm">
        <div className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-6 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/dashboard/surveys" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-950 transition hover:bg-muted" aria-label="Back to surveys">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <input
              value={survey.name}
              onChange={(event) => updateSurvey({ name: event.target.value })}
              className="min-w-0 truncate rounded-md border border-transparent bg-transparent px-0 text-xl font-bold tracking-tight text-foreground outline-none focus:border-border focus:bg-white focus:px-3"
            />
          </div>

          <div className="hidden items-center gap-1 rounded-2xl border border-border bg-muted/60 p-1 md:flex">
            <TabButton active={activeTab === "questions"} onClick={() => setActiveTab("questions")}>
              <GripVertical className="h-4 w-4" />
              Questions
            </TabButton>
            <TabButton active={activeTab === "design"} onClick={() => setActiveTab("design")}>
              <Palette className="h-4 w-4" />
              Design
            </TabButton>
            <TabButton active={activeTab === "outcomes"} onClick={() => setActiveTab("outcomes")}>
              <GitBranch className="h-4 w-4" />
              Outcomes
            </TabButton>
            <TabButton active={activeTab === "settings"} onClick={() => setActiveTab("settings")}>
              <Settings className="h-4 w-4" />
              Settings
            </TabButton>
          </div>

          <div className="flex min-w-0 items-center justify-end gap-2">
            <Link
              href={`/s/${survey.id}?preview=true`}
              target="_blank"
              className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-white text-slate-700 shadow-sm transition hover:bg-muted"
              aria-label="Preview"
            >
              <Eye className="h-4 w-4" />
            </Link>
            <Button onClick={saveSurvey} disabled={saving} className="h-10 w-10 px-0" aria-label="Save">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            </Button>
            <StatusSelect value={survey.status} onChange={(status) => updateSurvey({ status })} />
          </div>
        </div>
      </div>

      {error ? (
        <div className="mx-4 mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:mx-6">
          {error}
        </div>
      ) : null}

      <div className="flex items-center gap-2 overflow-x-auto border-b border-border bg-white px-4 py-2 md:hidden">
        <TabButton active={activeTab === "questions"} onClick={() => setActiveTab("questions")}>Questions</TabButton>
        <TabButton active={activeTab === "design"} onClick={() => setActiveTab("design")}>Design</TabButton>
        <TabButton active={activeTab === "outcomes"} onClick={() => setActiveTab("outcomes")}>Outcomes</TabButton>
        <TabButton active={activeTab === "settings"} onClick={() => setActiveTab("settings")}>Settings</TabButton>
      </div>

      <div className="min-w-0 p-4 sm:p-6">
        {activeTab === "questions" ? (
          <QuestionsPanel
            questions={questions}
            selectedIndex={selectedQuestionIndex}
            settings={settings}
            settingsOpen={settingsOpen}
            thankYouPages={thankYouPages}
            onAdd={addQuestion}
            onMove={moveQuestion}
            onReorder={reorderQuestion}
            onRemove={removeQuestion}
            onSelect={setSelectedQuestionIndex}
            onSettingsUpdate={updateSettings}
            onCreateThankYouPage={createThankYouPage}
            onOpenOutcomes={() => setActiveTab("outcomes")}
            onToggleSettings={() => setSettingsOpen((open) => !open)}
            onUpdate={updateQuestion}
          />
        ) : null}

        {activeTab === "design" ? (
          <DesignPanel style={style} onUpdate={updateStyle} />
        ) : null}

        {activeTab === "outcomes" ? (
          <LogicPanel
            survey={survey}
            settings={settings}
            thankYouPages={thankYouPages}
            thankYouBuilderAllowed={thankYouBuilderAllowed}
            onSettingsUpdate={updateSettings}
            onCreateThankYouPage={createThankYouPage}
            onSaveThankYouPage={saveThankYouPage}
            onDeleteThankYouPage={deleteThankYouPage}
          />
        ) : null}

        {activeTab === "settings" ? (
          <SettingsPanel
            survey={survey}
            settings={settings}
            publicUrl={publicUrl}
            onSurveyUpdate={updateSurvey}
            onSettingsUpdate={updateSettings}
            onQuestionUpdate={updateQuestion}
          />
        ) : null}
      </div>
    </div>
  )
}

function QuestionsPanel({
  questions,
  selectedIndex,
  settings,
  settingsOpen,
  thankYouPages,
  onAdd,
  onMove,
  onReorder,
  onRemove,
  onSelect,
  onSettingsUpdate,
  onCreateThankYouPage,
  onOpenOutcomes,
  onToggleSettings,
  onUpdate
}: {
  questions: SurveyQuestion[]
  selectedIndex: number
  settings: SurveySettings
  settingsOpen: boolean
  thankYouPages: ThankYouPage[]
  onAdd: () => void
  onMove: (index: number, direction: -1 | 1) => void
  onReorder: (fromIndex: number, toIndex: number) => void
  onRemove: (index: number) => void
  onSelect: (index: number) => void
  onSettingsUpdate: (updates: Partial<SurveySettings>) => void
  onCreateThankYouPage: () => Promise<void>
  onOpenOutcomes: () => void
  onToggleSettings: () => void
  onUpdate: (index: number, updates: Partial<SurveyQuestion>) => void
}) {
  const selectedQuestion = questions[selectedIndex]
  const [draggingQuestionId, setDraggingQuestionId] = useState<string | null>(null)
  const [dragOverQuestionId, setDragOverQuestionId] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const [settingsOffset, setSettingsOffset] = useState(0)

  useEffect(() => {
    if (!settingsOpen || !selectedQuestion || !listRef.current) return

    const updateOffset = () => {
      const selectedCard = listRef.current?.querySelector<HTMLElement>(`[data-question-card-index="${selectedIndex}"]`)
      setSettingsOffset(selectedCard?.offsetTop || 0)
    }

    updateOffset()
    window.addEventListener("resize", updateOffset)
    return () => window.removeEventListener("resize", updateOffset)
  }, [questions.length, selectedIndex, selectedQuestion, settingsOpen])

  function handleQuestionDrop(event: React.DragEvent<HTMLElement>, targetIndex: number, targetQuestionId: string) {
    event.preventDefault()
    const draggedId = draggingQuestionId || event.dataTransfer.getData("text/plain")
    const fromIndex = questions.findIndex((item) => item.id === draggedId)
    if (fromIndex >= 0 && draggedId !== targetQuestionId) onReorder(fromIndex, targetIndex)
    setDraggingQuestionId(null)
    setDragOverQuestionId(null)
  }

  return (
    <div className={["grid min-w-0 gap-6 items-start", settingsOpen && selectedQuestion ? "lg:grid-cols-[17rem_minmax(0,1fr)_24rem]" : "lg:grid-cols-[17rem_minmax(0,1fr)]"].join(" ")}>
      <aside className="min-w-0 space-y-4 lg:sticky lg:top-24">
        <div className="rounded-2xl border border-border bg-white p-3 shadow-sm">
          <div className="mb-3 flex items-center justify-between px-1">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-950">Questions</h2>
              <p className="text-xs text-muted-foreground">{questions.length} total</p>
            </div>
            <Button variant="ghost" className="h-9 w-9 px-0" onClick={onAdd} aria-label="Add question">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {questions.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-border bg-muted/30 px-4 py-8 text-center">
              <p className="text-sm font-semibold text-slate-950">No questions yet</p>
              <Button className="mt-4" onClick={onAdd}>
                <Plus className="h-4 w-4" />
                Add Question
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {questions.map((question, index) => (
                <button
                  key={question.id}
                  type="button"
                  draggable
                  className={[
                    "flex w-full min-w-0 items-center gap-2 rounded-xl border px-3 py-2 text-left transition",
                    index === selectedIndex ? "border-slate-950 bg-slate-50 shadow-sm" : "border-transparent bg-white hover:border-border hover:bg-muted/40",
                    draggingQuestionId === question.id ? "opacity-60" : "",
                    dragOverQuestionId === question.id && draggingQuestionId !== question.id ? "border-brand-500 ring-2 ring-brand-500/20" : ""
                  ].join(" ")}
                  onClick={() => {
                    onSelect(index)
                    if (!settingsOpen) onToggleSettings()
                  }}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move"
                    event.dataTransfer.setData("text/plain", question.id)
                    setDraggingQuestionId(question.id)
                    setDragOverQuestionId(null)
                  }}
                  onDragOver={(event) => {
                    if (!draggingQuestionId || draggingQuestionId === question.id) return
                    event.preventDefault()
                    event.dataTransfer.dropEffect = "move"
                    setDragOverQuestionId(question.id)
                  }}
                  onDrop={(event) => handleQuestionDrop(event, index, question.id)}
                  onDragEnd={() => {
                    setDraggingQuestionId(null)
                    setDragOverQuestionId(null)
                  }}
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-100 text-xs font-bold text-brand-800">{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-950">{question.question || "Untitled question"}</span>
                    <span className="block truncate text-xs text-muted-foreground">{getQuestionTypeLabel(question.type)}</span>
                  </span>
                  <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-white p-3 shadow-sm">
          <div className="mb-3 flex items-center justify-between px-1">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-950">Outcomes</h2>
              <p className="text-xs text-muted-foreground">{thankYouPages.length} thank-you pages</p>
            </div>
            <Button
              variant="ghost"
              className="h-9 w-9 px-0"
              onClick={() => {
                void onCreateThankYouPage().then(onOpenOutcomes)
              }}
              aria-label="Create outcome"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-2">
            {thankYouPages.map((page, index) => (
              <button
                key={page.id}
                type="button"
                className="flex w-full min-w-0 items-center gap-2 rounded-xl border border-transparent bg-white px-3 py-2 text-left transition hover:border-border hover:bg-muted/40"
                onClick={() => {
                  onSettingsUpdate({ thankYouPageId: page.id })
                  onOpenOutcomes()
                }}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-bold text-slate-700">{String.fromCharCode(65 + index)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-950">{page.name}</span>
                  <span className="block text-xs text-muted-foreground">{page.content.openPageConfig?.blocks?.length || 0} blocks</span>
                </span>
                {page.is_default ? <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold uppercase text-muted-foreground">Default</span> : null}
              </button>
            ))}
          </div>
          <Button variant="secondary" className="mt-3 w-full justify-center" onClick={onOpenOutcomes}>
            Open Outcome Builder
          </Button>
        </div>
      </aside>

      <div ref={listRef} className="min-w-0 space-y-4">
        {selectedQuestion ? (
          <QuestionCard
            key={selectedQuestion.id}
            index={selectedIndex}
            question={selectedQuestion}
            questions={questions}
            selected
            settingsActive={settingsOpen}
            dragging={draggingQuestionId === selectedQuestion.id}
            dragOver={false}
            canMoveUp={selectedIndex > 0}
            canMoveDown={selectedIndex < questions.length - 1}
            onMove={onMove}
            onDragStart={() => {
              setDraggingQuestionId(selectedQuestion.id)
              setDragOverQuestionId(null)
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => event.preventDefault()}
            onDragEnd={() => {
              setDraggingQuestionId(null)
              setDragOverQuestionId(null)
            }}
            onRemove={onRemove}
            onSelect={() => {
              if (!settingsOpen) onToggleSettings()
            }}
            onToggleSettings={onToggleSettings}
            onUpdate={onUpdate}
          />
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-border bg-white px-6 py-16 text-center">
            <h2 className="text-lg font-semibold text-slate-950">Add your first question</h2>
            <p className="mt-2 text-sm text-slate-500">Multiple choice, ranked order, this-or-that, text, rating, and contact forms are supported.</p>
            <Button className="mt-5" onClick={onAdd}>
              <Plus className="h-4 w-4" />
              Add Question
            </Button>
          </div>
        )}
      </div>

      {settingsOpen && selectedQuestion ? (
        <div
          className="min-w-0 transition-[margin] duration-200 lg:sticky lg:top-24 lg:mt-[var(--settings-offset)]"
          style={{ "--settings-offset": `${settingsOffset}px` } as React.CSSProperties}
        >
          <QuestionSettingsPanel question={selectedQuestion} questions={questions} index={selectedIndex} onUpdate={onUpdate} />
        </div>
      ) : null}
    </div>
  )
}

function QuestionCard({
  index,
  question,
  questions,
  selected,
  settingsActive,
  dragging,
  dragOver,
  canMoveUp,
  canMoveDown,
  onMove,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onRemove,
  onSelect,
  onToggleSettings,
  onUpdate
}: {
  index: number
  question: SurveyQuestion
  questions: SurveyQuestion[]
  selected: boolean
  settingsActive: boolean
  dragging: boolean
  dragOver: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  onMove: (index: number, direction: -1 | 1) => void
  onDragStart: () => void
  onDragOver: (event: React.DragEvent<HTMLElement>) => void
  onDrop: (event: React.DragEvent<HTMLElement>) => void
  onDragEnd: () => void
  onRemove: (index: number) => void
  onSelect: () => void
  onToggleSettings: () => void
  onUpdate: (index: number, updates: Partial<SurveyQuestion>) => void
}) {
  const hasOptions = OPTION_QUESTION_TYPES.includes(question.type)

  function updateOption(optionIndex: number, value: string) {
    const nextOptions = [...(question.options || [])]
    const previousValue = nextOptions[optionIndex]
    nextOptions[optionIndex] = value
    const nextMetadata = { ...(question.optionMetadata || {}) }
    const nextScores = { ...(question.scores || {}) }
    const nextLogic = { ...(question.logic || {}) }
    const nextOptionParamMappings = { ...(question.optionParamMappings || {}) }

    if (previousValue && previousValue !== value && nextMetadata[previousValue]) {
      nextMetadata[value] = nextMetadata[value] || nextMetadata[previousValue]
      delete nextMetadata[previousValue]
    }
    if (previousValue && previousValue !== value && previousValue in nextScores) {
      nextScores[value] = nextScores[previousValue]
      delete nextScores[previousValue]
    }
    if (previousValue && previousValue !== value && previousValue in nextLogic) {
      nextLogic[value] = nextLogic[previousValue]
      delete nextLogic[previousValue]
    }
    if (previousValue && previousValue !== value && previousValue in nextOptionParamMappings) {
      nextOptionParamMappings[value] = nextOptionParamMappings[previousValue]
      delete nextOptionParamMappings[previousValue]
    }

    onUpdate(index, {
      options: nextOptions,
      optionMetadata: nextMetadata,
      scores: Object.keys(nextScores).length ? nextScores : undefined,
      logic: Object.keys(nextLogic).length ? nextLogic : undefined,
      optionParamMappings: Object.keys(nextOptionParamMappings).length ? nextOptionParamMappings : undefined
    })
  }

  function addOption() {
    const nextLabel = question.type === "ranked-order" || question.type === "this-or-that"
      ? `Item ${(question.options || []).length + 1}`
      : `Option ${(question.options || []).length + 1}`
    onUpdate(index, { options: [...(question.options || []), nextLabel] })
  }

  function removeOption(optionIndex: number) {
    const removedOption = (question.options || [])[optionIndex]
    const nextMetadata = { ...(question.optionMetadata || {}) }
    const nextScores = { ...(question.scores || {}) }
    const nextLogic = { ...(question.logic || {}) }
    const nextOptionParamMappings = { ...(question.optionParamMappings || {}) }
    if (removedOption) delete nextMetadata[removedOption]
    if (removedOption) delete nextScores[removedOption]
    if (removedOption) delete nextLogic[removedOption]
    if (removedOption) delete nextOptionParamMappings[removedOption]
    onUpdate(index, {
      options: (question.options || []).filter((_, indexToCheck) => indexToCheck !== optionIndex),
      optionMetadata: Object.keys(nextMetadata).length ? nextMetadata : undefined,
      scores: Object.keys(nextScores).length ? nextScores : undefined,
      logic: Object.keys(nextLogic).length ? nextLogic : undefined,
      optionParamMappings: Object.keys(nextOptionParamMappings).length ? nextOptionParamMappings : undefined
    })
  }

  function updateScore(option: string, score: number) {
    onUpdate(index, { scores: { ...(question.scores || {}), [option]: score } })
  }

  function updateLogic(option: string, target: string) {
    onUpdate(index, { logic: { ...(question.logic || {}), [option]: target } })
  }

  function updateContactField(field: string, checked: boolean) {
    const currentFields = question.contactFields || ["first_name", "email"]
    const nextFields = checked
      ? Array.from(new Set([...currentFields, field]))
      : currentFields.filter((item) => item !== field)
    onUpdate(index, { contactFields: nextFields })
  }

  return (
    <article
      data-question-card-index={index}
      draggable
      className={[
        "min-w-0 rounded-2xl border bg-white shadow-sm transition cursor-pointer",
        selected ? "border-slate-950 ring-2 ring-slate-950/10" : "border-border hover:border-slate-400",
        dragging ? "opacity-60" : "",
        dragOver ? "border-brand-500 ring-2 ring-brand-500/20" : ""
      ].join(" ")}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move"
        event.dataTransfer.setData("text/plain", question.id)
        onDragStart()
      }}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={onSelect}
    >
      <div className="flex flex-col gap-3 p-4 sm:p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="grid h-10 w-10 cursor-grab place-items-center rounded-xl border border-border bg-white text-muted-foreground shadow-sm transition hover:border-slate-400 hover:text-slate-950 active:cursor-grabbing"
            aria-label={`Drag Question ${index + 1} to reorder`}
            onClick={(event) => event.stopPropagation()}
          >
            <GripVertical className="h-5 w-5" />
          </button>
          <div className="text-sm font-bold text-muted-foreground">Question {index + 1}</div>
          {selected ? <span className="h-2.5 w-2.5 rounded-full bg-slate-950" /> : null}
        </div>
        <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
          <select
            value={question.type}
            onChange={(event) => onUpdate(index, { type: event.target.value as QuestionType })}
            className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-white px-3 text-sm font-semibold text-slate-950 shadow-sm sm:flex-none"
          >
            {QUESTION_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          <Button variant={settingsActive ? "primary" : "ghost"} className="h-10 w-10 px-0" onClick={onToggleSettings} aria-label={settingsActive ? "Close question settings" : "Open question settings"}>
            <SlidersHorizontal className="h-5 w-5" />
          </Button>
          <Button variant="ghost" className="h-10 w-10 px-0 text-muted-foreground hover:text-red-600" onClick={() => onRemove(index)} aria-label="Delete question">
            <Trash2 className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="min-w-0 space-y-5 p-4 pt-0 sm:p-5 sm:pt-0" onClick={(event) => event.stopPropagation()}>
        <input
          value={question.question}
          onChange={(event) => onUpdate(index, { question: event.target.value })}
          className="h-12 w-full rounded-xl border border-border px-4 text-base font-semibold outline-none focus:border-slate-950"
          placeholder="Type your question here..."
        />

        <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="text-muted-foreground">🏷</span>
            <input
              value={question.category || ""}
              onChange={(event) => onUpdate(index, { category: event.target.value })}
              className="h-10 w-full max-w-sm rounded-xl border border-border px-3 text-sm outline-none focus:border-slate-950"
              placeholder="Add category tag..."
            />
          </div>
          <label className="flex items-center gap-3 text-sm font-bold text-muted-foreground">
            <ToggleSwitch checked={question.required} onChange={(checked) => onUpdate(index, { required: checked })} />
            Required
          </label>
        </div>

        {question.type === "multiple-choice" ? (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-bold text-foreground">Options, Scoring & Logic</h3>
              <p className="mt-1 text-sm text-muted-foreground">Set answer choices, score values, and branching targets.</p>
            </div>
            <div className="space-y-3">
              {(question.options || []).map((option, optionIndex) => (
                <div key={optionIndex} className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
                  <div className="flex items-center gap-3">
                    <input
                      value={option}
                      onChange={(event) => updateOption(optionIndex, event.target.value)}
                      className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-white px-4 text-base outline-none focus:border-slate-950"
                      placeholder="Option text"
                    />
                    <Button variant="ghost" className="h-10 w-10 px-0" onClick={() => removeOption(optionIndex)} aria-label="Remove option">
                      ✕
                    </Button>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <input
                        type="number"
                        value={question.scores?.[option] || 0}
                        onChange={(event) => updateScore(option, Number.parseInt(event.target.value, 10) || 0)}
                        className="h-9 min-w-0 flex-1 rounded-xl border border-border bg-white px-3 text-xs outline-none focus:border-slate-950"
                        placeholder="Score"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <select
                        value={question.logic?.[option] || ""}
                        onChange={(event) => updateLogic(option, event.target.value)}
                        className="h-9 min-w-0 flex-1 rounded-xl border border-border bg-white px-3 text-xs outline-none focus:border-slate-950"
                      >
                        <option value="">Next Question (Default)</option>
                        <option value="end">End Survey</option>
                        {questions.map((otherQuestion, otherIndex) => (
                          otherIndex > index ? (
                            <option key={otherQuestion.id} value={otherQuestion.id}>
                              Go to Q{otherIndex + 1}: {otherQuestion.question.slice(0, 28)}
                            </option>
                          ) : null
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Button variant="secondary" onClick={addOption}>
                <Plus className="h-4 w-4" />
                Add Option
              </Button>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"
                onClick={() => {
                  const hasOther = (question.options || []).some((option) => option.toLowerCase() === "other")
                  onUpdate(index, {
                    options: hasOther ? question.options : [...(question.options || []), "Other"],
                    allowOther: true
                  })
                }}
              >
                <Plus className="h-4 w-4" />
                Add Other/Write-in
              </button>
            </div>
          </div>
        ) : hasOptions ? (
          <div className="space-y-3">
            <div>
              <h3 className="text-base font-bold text-foreground">
                {question.type === "this-or-that" ? "Items to Compare (Pairwise)" : "Options to Rank"}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {question.type === "this-or-that"
                  ? "Specify the list of items. Unique pairs will be generated automatically for the respondent to choose between."
                  : "Specify the list of items that respondents will rank in order of preference."}
              </p>
            </div>
              <div className="space-y-2">
                {(question.options || []).map((option, optionIndex) => (
                  <div key={optionIndex} className="flex min-w-0 items-center gap-3">
                    <input
                      value={option}
                      onChange={(event) => updateOption(optionIndex, event.target.value)}
                      className="h-11 min-w-0 flex-1 rounded-xl border border-border px-4 text-base outline-none focus:border-slate-950"
                    />
                    <Button variant="ghost" className="h-10 w-10 px-0" onClick={() => removeOption(optionIndex)} aria-label="Remove option">
                      ✕
                    </Button>
                  </div>
                ))}
              </div>
            <Button variant="secondary" onClick={addOption}>
              <Plus className="h-4 w-4" />
              {question.type === "this-or-that" ? "Add Item to Compare" : "Add Item to Rank"}
            </Button>
          </div>
        ) : null}

        {question.type === "rating" ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-muted/20 p-4">
              {Array.from({ length: Math.max(1, (question.maxRating || 5) - (question.minRating || 1) + 1) }, (_, ratingIndex) => (question.minRating || 1) + ratingIndex).map((rating) => (
                <div key={rating} className="grid h-12 w-12 place-items-center rounded-xl border border-amber-200 bg-amber-50 text-amber-500">
                  <Star className="h-6 w-6 fill-current" />
                </div>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Min rating">
                <input
                  type="number"
                  value={question.minRating || 1}
                  onChange={(event) => onUpdate(index, { minRating: Number(event.target.value) })}
                  className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
                />
              </Field>
              <Field label="Max rating">
                <input
                  type="number"
                  value={question.maxRating || 5}
                  onChange={(event) => onUpdate(index, { maxRating: Number(event.target.value) })}
                  className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
                />
              </Field>
            </div>
          </div>
        ) : null}

        {question.type === "contact-info" ? (
          <div className="space-y-3">
            <h3 className="text-base font-bold text-foreground">Fields to Include</h3>
            <div className="flex flex-wrap gap-4">
              {CONTACT_FIELDS.map((field) => {
                const enabled = (question.contactFields || ["first_name", "email"]).includes(field.value)
                return (
                  <label key={field.value} className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <ToggleSwitch checked={enabled} onChange={(checked) => updateContactField(field.value, checked)} />
                    {field.label}
                  </label>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>
    </article>
  )
}

function QuestionSettingsPanel({
  question,
  questions,
  index,
  onUpdate
}: {
  question: SurveyQuestion
  questions: SurveyQuestion[]
  index: number
  onUpdate: (index: number, updates: Partial<SurveyQuestion>) => void
}) {
  const isOptionQuestion = OPTION_QUESTION_TYPES.includes(question.type)
  const [optionParamsOpen, setOptionParamsOpen] = useState(false)
  const [resultFieldsOpen, setResultFieldsOpen] = useState(false)

  function updateOptionMetadata(option: string, updates: NonNullable<SurveyQuestion["optionMetadata"]>[string]) {
    onUpdate(index, {
      optionMetadata: {
        ...(question.optionMetadata || {}),
        [option]: {
          ...(question.optionMetadata?.[option] || {}),
          ...updates
        }
      }
    })
  }

  function updateOptionParam(option: string, value: string) {
    onUpdate(index, {
      optionParamMappings: {
        ...(question.optionParamMappings || {}),
        [option]: value
      }
    })
  }

  function updateContactParam(field: string, value: string) {
    onUpdate(index, {
      contactParamMappings: {
        ...(question.contactParamMappings || {}),
        [field]: value
      }
    })
  }

  function updateContactHideIfPrefilled(field: string, checked: boolean) {
    const nextHideIfPrefilled = {
      ...(question.contactHideIfPrefilled || {}),
      [field]: checked
    }
    const nextAlwaysHidden = { ...(question.contactAlwaysHidden || {}) }
    if (checked) nextAlwaysHidden[field] = false
    onUpdate(index, {
      contactHideIfPrefilled: nextHideIfPrefilled,
      contactAlwaysHidden: nextAlwaysHidden
    })
  }

  function updateContactAlwaysHidden(field: string, checked: boolean) {
    onUpdate(index, {
      contactAlwaysHidden: {
        ...(question.contactAlwaysHidden || {}),
        [field]: checked
      }
    })
  }

  return (
    <aside className="rounded-2xl border border-border bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-border p-5">
        <div>
          <div className="flex items-center gap-2 text-lg font-bold text-foreground">
            <SlidersHorizontal className="h-5 w-5" />
            [Question {index + 1}] Settings
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Advanced configurations for this question.</p>
        </div>
        <span className="text-2xl text-muted-foreground">›</span>
      </div>
      <div className="space-y-5 bg-muted/20 p-5">
        {question.type !== "contact-info" ? (
          <Field label={<span className="inline-flex items-center gap-2">URL Parameter <HelpCircle className="h-4 w-4 text-muted-foreground" /></span>}>
            <input
              value={question.paramMapping || ""}
              onChange={(event) => onUpdate(index, { paramMapping: event.target.value })}
              className="h-11 w-full rounded-xl border border-border bg-white px-4 text-sm outline-none focus:border-slate-950"
              placeholder="e.g. email, company, utm_source"
            />
          </Field>
        ) : null}

        {question.type === "text" ? (
          <div className="space-y-4 rounded-xl border border-border bg-white p-4">
            <div>
              <div className="text-sm font-bold uppercase tracking-wide text-foreground">Text Answer Style</div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Choose a compact one-line field or a larger long-answer box.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
              {(["short", "long"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onUpdate(index, { textInputMode: mode })}
                  className={[
                    "rounded-lg px-3 py-2 text-sm font-semibold transition",
                    (question.textInputMode || "long") === mode ? "bg-white text-slate-950 shadow-sm" : "text-muted-foreground hover:text-slate-950"
                  ].join(" ")}
                >
                  {mode === "short" ? "Short Text" : "Long Text"}
                </button>
              ))}
            </div>
            <Field label="Placeholder text">
              <input
                value={question.placeholder || ""}
                onChange={(event) => onUpdate(index, { placeholder: event.target.value })}
                className="h-11 w-full rounded-xl border border-border bg-white px-4 text-sm outline-none focus:border-slate-950"
                placeholder="Type your answer..."
              />
            </Field>
          </div>
        ) : null}

        {isOptionQuestion ? (
          <>
            {(question.type === "this-or-that" || question.type === "ranked-order") ? (
              <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-brand-700">
                  <SlidersHorizontal className="h-4 w-4" />
                  Option Sourcing Engine
                </div>
                <select
                  value={question.dynamicOptionsFromQuestionId || ""}
                  onChange={(event) => onUpdate(index, { dynamicOptionsFromQuestionId: event.target.value || undefined })}
                  className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm"
                >
                  <option value="">Static List (Defined on Left)</option>
                  {questions.slice(0, index).map((otherQuestion, otherIndex) => (
                    <option key={otherQuestion.id} value={otherQuestion.id}>
                      Feed Q{otherIndex + 1}: {otherQuestion.question.slice(0, 36)}
                    </option>
                  ))}
                </select>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">Dynamically seed choices/ranking pool from options picked or text entered in preceding questions.</p>
              </div>
            ) : null}

            {question.type === "multiple-choice" ? (
              <div className="rounded-xl border border-border bg-white p-4">
                <button
                  type="button"
                  onClick={() => setOptionParamsOpen((open) => !open)}
                  className="flex w-full items-center justify-between gap-3 text-left"
                  aria-expanded={optionParamsOpen}
                >
                  <span>
                    <span className="block text-sm font-bold uppercase tracking-wide text-foreground">Option URL Parameters</span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">Optional URL values that pre-select specific answers.</span>
                  </span>
                  <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${optionParamsOpen ? "rotate-180" : ""}`} />
                </button>
                {optionParamsOpen ? (
                  <div className="mt-4 space-y-3">
                    {(question.options || []).map((option) => (
                      <Field key={option} label={option}>
                        <input
                          value={question.optionParamMappings?.[option] || ""}
                          onChange={(event) => updateOptionParam(option, event.target.value)}
                          className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-slate-950"
                          placeholder="e.g. utm_choice"
                        />
                      </Field>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

          </>
        ) : null}

        {question.type === "multiple-choice" ? (
          <div className="space-y-3 rounded-xl border border-border bg-white p-4">
            <label className="flex items-center justify-between gap-4 text-sm font-semibold text-foreground">
              Allow multiple selections
              <ToggleSwitch checked={!!question.allowMultiple} onChange={(checked) => onUpdate(index, { allowMultiple: checked })} />
            </label>
            {question.allowMultiple ? (
              <Field label="Maximum selections">
                <input
                  type="number"
                  min={1}
                  value={question.maxSelections || ""}
                  onChange={(event) => onUpdate(index, { maxSelections: event.target.value ? Number(event.target.value) : undefined })}
                  className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-slate-950"
                  placeholder="No limit"
                />
              </Field>
            ) : null}
            <label className="flex items-center justify-between gap-4 text-sm font-semibold text-foreground">
              Allow other answer
              <ToggleSwitch checked={!!question.allowOther} onChange={(checked) => onUpdate(index, { allowOther: checked })} />
            </label>
          </div>
        ) : null}

        {question.type === "this-or-that" ? (
          <>
            <div className="rounded-xl border border-border bg-white p-4">
              <button
                type="button"
                onClick={() => setResultFieldsOpen((open) => !open)}
                className="flex w-full items-center justify-between gap-3 text-left"
                aria-expanded={resultFieldsOpen}
              >
                <span>
                  <span className="block text-sm font-bold uppercase tracking-wide text-foreground">Option Result Fields</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">Optional alternate labels and resource links for comparison results.</span>
                </span>
                <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${resultFieldsOpen ? "rotate-180" : ""}`} />
              </button>
              {resultFieldsOpen ? (
                <div className="mt-4 space-y-4">
                  {(question.options || []).map((option) => (
                    <div key={option} className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
                      <div className="truncate text-xs font-bold text-muted-foreground" title={option}>{option}</div>
                      <input
                        value={question.optionMetadata?.[option]?.resultLabel || ""}
                        onChange={(event) => updateOptionMetadata(option, { resultLabel: event.target.value })}
                        className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-slate-950"
                        placeholder="Alternate result text, e.g. More leads"
                      />
                      <input
                        value={question.optionMetadata?.[option]?.redirectUrl || ""}
                        onChange={(event) => updateOptionMetadata(option, { redirectUrl: event.target.value })}
                        className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-slate-950"
                        placeholder="Thank-you redirect URL"
                      />
                      <input
                        value={question.optionMetadata?.[option]?.redirectLabel || ""}
                        onChange={(event) => updateOptionMetadata(option, { redirectLabel: event.target.value })}
                        className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-slate-950"
                        placeholder="Optional redirect tooltip/label"
                      />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <label className="flex items-center justify-between gap-4 rounded-xl border border-border bg-white p-4 text-sm font-semibold text-foreground">
              <span className="min-w-0 flex-1">
                Use Inference Algorithm
                <span className="mt-1 block text-xs font-normal leading-5 text-muted-foreground">
                  Infer skipped pair outcomes from prior choices to reduce repeated comparisons.
                </span>
              </span>
              <ToggleSwitch checked={question.useInferenceAlgorithm !== false} onChange={(checked) => onUpdate(index, { useInferenceAlgorithm: checked })} />
            </label>
          </>
        ) : null}

        {question.type === "contact-info" ? (
          <div className="space-y-4">
            <label
              className={[
                "flex items-center justify-between gap-4 rounded-xl border p-4 text-sm font-semibold transition-colors",
                question.contactHiddenCapture
                  ? "border-brand-300 bg-brand-50 text-brand-950 shadow-sm"
                  : "border-border bg-white text-foreground"
              ].join(" ")}
            >
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  Hidden Lead Capture
                  <span className={[
                    "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                    question.contactHiddenCapture ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-500"
                  ].join(" ")}>
                    {question.contactHiddenCapture ? "On" : "Off"}
                  </span>
                </span>
                <span className="mt-1 block text-xs font-normal leading-5 text-brand-800/80">
                  Do not show this contact form to respondents. Prefilled URL values are still submitted with the response.
                </span>
              </span>
              <ToggleSwitch checked={!!question.contactHiddenCapture} onChange={(checked) => onUpdate(index, { contactHiddenCapture: checked })} />
            </label>

            <div className="rounded-xl border border-border bg-white p-4">
              <div className="mb-3 text-sm font-bold uppercase tracking-wide text-foreground">Field URL Parameters</div>
              <p className="mb-3 text-xs leading-5 text-muted-foreground">
                Map incoming URL parameters to normalized contact fields, e.g. map Email to <span className="font-mono">em</span>.
              </p>
            <div className="space-y-3">
              {CONTACT_FIELDS.filter((field) => (question.contactFields || ["first_name", "email"]).includes(field.value)).map((field) => {
                const hideIfPrefilled = question.contactHideIfPrefilled?.[field.value] !== false
                const alwaysHidden = question.contactAlwaysHidden?.[field.value] || false
                return (
                  <div key={field.value} className="space-y-3 rounded-xl border border-border bg-muted/30 p-3">
                    <div className="text-xs font-bold text-foreground">{field.label}</div>
                    <input
                      value={question.contactParamMappings?.[field.value] || ""}
                      onChange={(event) => updateContactParam(field.value, event.target.value)}
                      className="h-10 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-slate-950"
                      placeholder={`URL parameter for ${field.label.toLowerCase()}`}
                    />
                    <label className="flex items-center justify-between gap-4 rounded-lg bg-white/70 px-2 py-2 text-xs font-semibold text-muted-foreground">
                      <span>
                        Hide if Populated
                        <span className="block text-[10px] font-normal">Hide when pre-filled from URL</span>
                      </span>
                      <ToggleSwitch checked={hideIfPrefilled} onChange={(checked) => updateContactHideIfPrefilled(field.value, checked)} />
                    </label>
                    {!hideIfPrefilled ? (
                      <label className="flex items-center justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 px-2 py-2 text-xs font-semibold text-amber-700">
                        <span>
                          Is Hidden (Always)
                          <span className="block text-[10px] font-normal text-muted-foreground">Always hide from respondent</span>
                        </span>
                        <ToggleSwitch checked={alwaysHidden} onChange={(checked) => updateContactAlwaysHidden(field.value, checked)} />
                      </label>
                    ) : null}
                  </div>
                )
              })}
              {(question.contactFields || ["first_name", "email"]).length === 0 ? (
                <p className="text-xs text-muted-foreground">No fields are enabled on the left card.</p>
              ) : null}
            </div>
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  )
}

function DesignPanel({ style, onUpdate }: { style: SurveyStyle; onUpdate: (updates: Partial<SurveyStyle>) => void }) {
  return (
    <div className="grid gap-4 rounded-md border border-slate-200 bg-white p-5 md:grid-cols-2">
      <ColorField label="Background" value={style.backgroundColor} onChange={(value) => onUpdate({ backgroundColor: value })} />
      <ColorField label="Text" value={style.textColor} onChange={(value) => onUpdate({ textColor: value })} />
      <ColorField label="Accent" value={style.accentColor} onChange={(value) => onUpdate({ accentColor: value })} />
      <Field label="Button text">
        <input
          value={style.buttonText}
          onChange={(event) => onUpdate({ buttonText: event.target.value })}
          className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
        />
      </Field>
      <Field label="Logo URL">
        <input
          value={style.logoUrl || ""}
          onChange={(event) => onUpdate({ logoUrl: event.target.value })}
          className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
          placeholder="https://..."
        />
      </Field>
    </div>
  )
}

function LogicPanel({
  survey,
  settings,
  thankYouPages,
  thankYouBuilderAllowed,
  onSettingsUpdate,
  onCreateThankYouPage,
  onSaveThankYouPage,
  onDeleteThankYouPage
}: {
  survey: SurveyEditorRow
  settings: SurveySettings
  onSettingsUpdate: (updates: Partial<SurveySettings>) => void
  thankYouPages: ThankYouPage[]
  thankYouBuilderAllowed: boolean
  onCreateThankYouPage: () => Promise<void>
  onSaveThankYouPage: (pageId: string, updates: { name?: string; content?: ThankYouPageContent; is_default?: boolean; status?: "draft" | "active" | "archived" }) => Promise<void>
  onDeleteThankYouPage: (pageId: string) => Promise<void>
}) {
  const questions = survey.questions || []

  return (
    <div className="mx-auto grid max-w-6xl gap-5">
      <section className="space-y-4 rounded-md border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-950">Outcomes</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Create outcome pages and route respondents based on answers, scores, URL parameters, or preferences.
            </p>
          </div>
          <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-800">Outcome flow</span>
        </div>
        <CustomThankYouPageManager
          pages={thankYouPages}
          selectedPageId={settings.thankYouPageId}
          questions={questions}
          enabled={thankYouBuilderAllowed}
          onSelect={(thankYouPageId) => onSettingsUpdate({ thankYouPageId })}
          onCreate={onCreateThankYouPage}
          onSave={onSaveThankYouPage}
          onDelete={onDeleteThankYouPage}
        />
      </section>
    </div>
  )
}

type RouterSourceOption = {
  value: string
  label: string
  sourceType: ThankYouRouterCondition["sourceType"]
  questionId?: string
  field?: string
  valueMode: "select" | "text" | "number" | "none"
  values?: Array<{ value: string; label: string }>
}

const ROUTER_OPERATORS: Array<{ value: ThankYouRouterCondition["operator"]; label: string }> = [
  { value: "equals", label: "is" },
  { value: "not_equals", label: "is not" },
  { value: "contains", label: "contains" },
  { value: "does_not_contain", label: "does not contain" },
  { value: "greater_than", label: "is greater than" },
  { value: "less_than", label: "is less than" },
  { value: "exists", label: "exists" },
  { value: "does_not_exist", label: "does not exist" }
]

function ThankYouRouterEditor({
  questions,
  pages,
  settings,
  onSettingsUpdate,
  onCreatePage,
  compact = false
}: {
  questions: SurveyQuestion[]
  pages: ThankYouPage[]
  settings: SurveySettings
  onSettingsUpdate: (updates: Partial<SurveySettings>) => void
  onCreatePage: () => Promise<void>
  compact?: boolean
}) {
  const router = settings.thankYouRouter || { enabled: false, defaultPageId: settings.thankYouPageId, rules: [] }
  const sourceOptions = getRouterSourceOptions(questions, settings)
  const defaultPageId = router.defaultPageId || settings.thankYouPageId || pages.find((page) => page.is_default)?.id || pages[0]?.id || ""

  function saveRouter(updates: Partial<NonNullable<SurveySettings["thankYouRouter"]>>) {
    onSettingsUpdate({
      thankYouRouter: {
        enabled: router.enabled ?? false,
        defaultPageId,
        rules: router.rules || [],
        ...updates
      }
    })
  }

  function addRule() {
    const firstSource = sourceOptions[0]
    const condition = createRouterCondition(firstSource)
    saveRouter({
      enabled: true,
      rules: [
        ...(router.rules || []),
        {
          id: crypto.randomUUID(),
          label: `Rule ${(router.rules || []).length + 1}`,
          enabled: true,
          match: "all",
          targetPageId: pages.find((page) => page.id !== defaultPageId)?.id || defaultPageId,
          conditions: [condition]
        }
      ]
    })
  }

  function updateRule(ruleId: string, updates: Partial<ThankYouRouterRule>) {
    saveRouter({ rules: (router.rules || []).map((rule) => rule.id === ruleId ? { ...rule, ...updates } : rule) })
  }

  function updateCondition(rule: ThankYouRouterRule, conditionId: string, updates: Partial<ThankYouRouterCondition>) {
    updateRule(rule.id, {
      conditions: rule.conditions.map((condition) => condition.id === conditionId ? { ...condition, ...updates } : condition)
    })
  }

  function changeConditionSource(rule: ThankYouRouterRule, conditionId: string, sourceValue: string) {
    const option = sourceOptions.find((item) => item.value === sourceValue)
    if (!option) return
    const next = createRouterCondition(option, conditionId)
    updateCondition(rule, conditionId, next)
  }

  return (
    <section className={["rounded-md border border-slate-200 bg-white", compact ? "p-4 sm:p-5" : "p-5"].join(" ")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <GitBranch className="mt-1 h-5 w-5 text-slate-500" />
          <div>
            <h3 className="font-semibold text-slate-950">Outcome Router</h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              Build the post-survey routing step here. First matching enabled rule wins; everyone else sees the default outcome.
            </p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <ToggleSwitch checked={router.enabled !== false} onChange={(enabled) => saveRouter({ enabled })} />
          Router enabled
        </label>
      </div>

      <div className="mt-4 grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
        <Field label="Default outcome">
          <select
            value={defaultPageId}
            onChange={(event) => saveRouter({ defaultPageId: event.target.value })}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            {pages.map((page) => (
              <option key={page.id} value={page.id}>{page.name}</option>
            ))}
          </select>
        </Field>
        <Button type="button" variant="secondary" className="h-10 px-3 text-sm" onClick={onCreatePage}>
          <Plus className="mr-2 h-4 w-4" /> New outcome
        </Button>
        <Button type="button" className="h-10 px-3 text-sm" onClick={addRule} disabled={!pages.length || !sourceOptions.length}>
          <Plus className="mr-2 h-4 w-4" /> Add route
        </Button>
      </div>

      {(router.rules || []).length ? (
        <div className="mt-4 space-y-3">
          {(router.rules || []).map((rule, index) => (
            <div key={rule.id} className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-[220px] flex-1">
                  <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Rule {index + 1}</div>
                  <input
                    value={rule.label || ""}
                    onChange={(event) => updateRule(rule.id, { label: event.target.value })}
                    className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
                    placeholder="Rule label"
                  />
                </div>
                <label className="flex items-center gap-2 pt-6 text-sm font-bold text-slate-700">
                  <ToggleSwitch checked={rule.enabled !== false} onChange={(enabled) => updateRule(rule.id, { enabled })} />
                  Enabled
                </label>
              </div>

              <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-700">
                  <span>If</span>
                  <div className="inline-flex rounded-full border border-slate-200 bg-white p-1">
                    {(["all", "any"] as const).map((matchType) => (
                      <button
                        key={matchType}
                        type="button"
                        className={[
                          "rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide transition",
                          (rule.match || "all") === matchType ? "bg-slate-950 text-white" : "text-slate-500 hover:text-slate-950"
                        ].join(" ")}
                        onClick={() => updateRule(rule.id, { match: matchType })}
                      >
                        {matchType === "all" ? "All (AND)" : "Any (OR)"}
                      </button>
                    ))}
                  </div>
                  <span>of these conditions are true, show outcome</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={rule.targetPageId || defaultPageId}
                      onChange={(event) => updateRule(rule.id, { targetPageId: event.target.value })}
                      className="h-9 min-w-[180px] rounded-md border border-slate-200 bg-white px-3 text-sm"
                    >
                      {pages.map((page) => (
                        <option key={page.id} value={page.id}>{page.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="inline-flex h-9 items-center gap-1 rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 shadow-sm hover:border-slate-400"
                      onClick={onCreatePage}
                    >
                      <Plus className="h-3.5 w-3.5" /> Create page
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {(rule.conditions || []).map((condition, conditionIndex) => {
                  const selectedSourceValue = getRouterSourceValue(condition)
                  const selectedSource = sourceOptions.find((option) => option.value === selectedSourceValue)
                  const needsValue = selectedSource?.valueMode !== "none" && condition.operator !== "exists" && condition.operator !== "does_not_exist"
                  return (
                    <div key={condition.id} className="space-y-2">
                      {conditionIndex > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="h-px flex-1 bg-slate-200" />
                          <span className="rounded-full bg-slate-950 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white">
                            {(rule.match || "all") === "all" ? "AND" : "OR"}
                          </span>
                          <div className="h-px flex-1 bg-slate-200" />
                        </div>
                      ) : null}
                      <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Condition {conditionIndex + 1}</div>
                        <div className="grid gap-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(160px,0.6fr)_minmax(0,1fr)_auto]">
                          <select
                            value={selectedSourceValue}
                            onChange={(event) => changeConditionSource(rule, condition.id, event.target.value)}
                            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
                          >
                            {sourceOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                          <select
                            value={condition.operator}
                            onChange={(event) => updateCondition(rule, condition.id, { operator: event.target.value as ThankYouRouterCondition["operator"] })}
                            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
                          >
                            {ROUTER_OPERATORS.map((operator) => (
                              <option key={operator.value} value={operator.value}>{operator.label}</option>
                            ))}
                          </select>
                          {needsValue && selectedSource?.valueMode === "select" ? (
                            <select
                              value={condition.value || ""}
                              onChange={(event) => updateCondition(rule, condition.id, { value: event.target.value })}
                              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
                            >
                              <option value="">Choose an answer</option>
                              {(selectedSource.values || []).map((value) => (
                                <option key={value.value} value={value.value}>{value.label}</option>
                              ))}
                            </select>
                          ) : needsValue ? (
                            <input
                              value={condition.value || ""}
                              onChange={(event) => updateCondition(rule, condition.id, { value: event.target.value })}
                              type={selectedSource?.valueMode === "number" ? "number" : "text"}
                              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
                              placeholder={selectedSource?.valueMode === "number" ? "Number" : "Value"}
                            />
                          ) : (
                            <div className="h-10 rounded-md border border-dashed border-slate-200 bg-white px-3 py-2 text-sm text-slate-400">No value needed</div>
                          )}
                          <button
                            type="button"
                            className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 px-3 text-sm font-bold text-red-600 hover:bg-red-50"
                            onClick={() => updateRule(rule.id, { conditions: rule.conditions.filter((item) => item.id !== condition.id) })}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                  onClick={() => updateRule(rule.id, { conditions: [...(rule.conditions || []), createRouterCondition(sourceOptions[0])] })}
                  disabled={!sourceOptions.length}
                >
                  <Plus className="h-4 w-4" /> Add condition
                </button>
                <button type="button" className="text-sm font-bold text-red-600" onClick={() => saveRouter({ rules: (router.rules || []).filter((item) => item.id !== rule.id) })}>
                  Delete rule
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-md border border-dashed border-slate-300 p-4 text-sm leading-6 text-slate-500">
          No routing rules yet. Everyone sees the default outcome until you add a rule.
        </div>
      )}
    </section>
  )
}

function getRouterSourceOptions(questions: SurveyQuestion[], settings: SurveySettings): RouterSourceOption[] {
  const options: RouterSourceOption[] = [
    { value: "total_score", label: "Total score", sourceType: "total_score", valueMode: "number" }
  ]

  questions.forEach((question, index) => {
    const label = `Q${index + 1}: ${question.question || "Untitled question"}`
    if (question.type === "this-or-that") {
      options.push({
        value: `preference_top:${question.id}`,
        label: `${label} - Top preference`,
        sourceType: "preference_top",
        questionId: question.id,
        valueMode: "select",
        values: (question.options || []).map((option) => ({ value: option, label: option }))
      })
    }

    if (OPTION_QUESTION_TYPES.includes(question.type)) {
      options.push({
        value: `question_answer:${question.id}`,
        label: `${label} - Answer includes`,
        sourceType: "question_answer",
        questionId: question.id,
        valueMode: "select",
        values: (question.options || []).map((option) => ({ value: option, label: option }))
      })
    } else if (question.type === "rating") {
      options.push({ value: `question_answer:${question.id}`, label: `${label} - Rating`, sourceType: "question_answer", questionId: question.id, valueMode: "number" })
    } else if (question.type === "text" || question.type === "contact-info") {
      options.push({ value: `question_answer:${question.id}`, label: `${label} - Answer text`, sourceType: "question_answer", questionId: question.id, valueMode: "text" })
    }

    options.push({ value: `question_score:${question.id}`, label: `${label} - Score`, sourceType: "question_score", questionId: question.id, valueMode: "number" })
  })

  CONTACT_FIELDS.forEach((field) => {
    options.push({ value: `contact_field:${field.value}`, label: `Contact - ${field.label}`, sourceType: "contact_field", field: field.value, valueMode: "text" })
  })

  Array.from(new Set([...(settings.urlParams || []), ...COMMON_URL_PARAMS])).forEach((param) => {
    options.push({ value: `url_param:${param}`, label: `URL parameter - ${param}`, sourceType: "url_param", field: param, valueMode: "text" })
  })

  return options
}

function createRouterCondition(source?: RouterSourceOption, id?: string): ThankYouRouterCondition {
  return {
    id: id || crypto.randomUUID(),
    sourceType: source?.sourceType || "total_score",
    questionId: source?.questionId,
    field: source?.field,
    operator: source?.valueMode === "number" ? "greater_than" : "equals",
    value: source?.values?.[0]?.value || ""
  }
}

function getRouterSourceValue(condition: ThankYouRouterCondition) {
  if (condition.sourceType === "total_score") return "total_score"
  if (condition.sourceType === "question_answer" && condition.questionId) return `question_answer:${condition.questionId}`
  if (condition.sourceType === "preference_top" && condition.questionId) return `preference_top:${condition.questionId}`
  if (condition.sourceType === "question_score" && condition.questionId) return `question_score:${condition.questionId}`
  if (condition.sourceType === "contact_field" && condition.field) return `contact_field:${condition.field}`
  if (condition.sourceType === "url_param" && condition.field) return `url_param:${condition.field}`
  return "total_score"
}

function SettingsPanel({
  survey,
  settings,
  publicUrl,
  onSurveyUpdate,
  onSettingsUpdate,
  onQuestionUpdate
}: {
  survey: SurveyEditorRow
  settings: SurveySettings
  publicUrl: string
  onSurveyUpdate: (updates: Partial<SurveyEditorRow>) => void
  onSettingsUpdate: (updates: Partial<SurveySettings>) => void
  onQuestionUpdate: (index: number, updates: Partial<SurveyQuestion>) => void
}) {
  const tracking = settings.tracking || {}
  const settingsQuestions = survey.questions || []
  const highlightedQuestionIndex = settingsQuestions.findIndex((question) => question.id === settings.thankYouHighlightedQuestionId)
  const highlightedQuestion = highlightedQuestionIndex >= 0 ? settingsQuestions[highlightedQuestionIndex] : undefined
  const highlightedOptions = highlightedQuestion?.options || []

  function updateHighlightedOptionMetadata(option: string, updates: NonNullable<SurveyQuestion["optionMetadata"]>[string]) {
    if (!highlightedQuestion || highlightedQuestionIndex < 0) return
    onQuestionUpdate(highlightedQuestionIndex, {
      optionMetadata: {
        ...(highlightedQuestion.optionMetadata || {}),
        [option]: {
          ...(highlightedQuestion.optionMetadata?.[option] || {}),
          ...updates
        }
      }
    })
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="space-y-4 rounded-md border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-950">General</h2>
        <Field label="Description">
          <textarea
            value={survey.description || ""}
            onChange={(event) => onSurveyUpdate({ description: event.target.value })}
            className="min-h-24 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="SEO description">
          <textarea
            value={survey.seo_description || ""}
            onChange={(event) => onSurveyUpdate({ seo_description: event.target.value })}
            className="min-h-20 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
          />
        </Field>
        <label className="flex items-center justify-between gap-3 text-sm font-medium text-slate-700">
          <span>Skip welcome screen</span>
          <ToggleSwitch checked={!!settings.skipIntro} onChange={(checked) => onSettingsUpdate({ skipIntro: checked })} />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm font-medium text-slate-700">
          <span>Prevent multiple submissions</span>
          <ToggleSwitch checked={!!settings.preventMultiple} onChange={(checked) => onSettingsUpdate({ preventMultiple: checked })} />
        </label>
      </section>

      <section className="space-y-4 rounded-md border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-950">Generic outcome page</h2>
        <p className="text-sm leading-6 text-slate-500">
          Built-in fallback used when no custom outcome is selected or the builder is unavailable.
        </p>
        <Field label="Title">
          <input
            value={settings.thankYouTitle || ""}
            onChange={(event) => onSettingsUpdate({ thankYouTitle: event.target.value })}
            className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
          />
        </Field>
        <Field label="Message">
          <textarea
            value={settings.thankYouMessage || ""}
            onChange={(event) => onSettingsUpdate({ thankYouMessage: event.target.value })}
            className="min-h-20 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
          />
        </Field>
        <label className="flex items-center justify-between gap-3 text-sm font-medium text-slate-700">
          <span>Show submit another button</span>
          <ToggleSwitch
            checked={settings.thankYouShowSubmitAnother !== false}
            onChange={(checked) => onSettingsUpdate({ thankYouShowSubmitAnother: checked })}
          />
        </label>
        {settings.thankYouShowSubmitAnother !== false ? (
          <Field label="Submit another button text">
            <input
              value={settings.thankYouSubmitAnotherButtonText || ""}
              onChange={(event) => onSettingsUpdate({ thankYouSubmitAnotherButtonText: event.target.value })}
              className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
              placeholder="Submit another response"
            />
          </Field>
        ) : null}
        <label className="flex items-center justify-between gap-3 text-sm font-medium text-slate-700">
          <span>
            Showcase preference rankings
            <span className="mt-1 block text-xs font-normal text-slate-500">Display ranked results and optional answer links on the outcome page.</span>
          </span>
          <ToggleSwitch
            checked={!!settings.thankYouShowResults}
            onChange={(checked) => onSettingsUpdate({ thankYouShowResults: checked })}
          />
        </label>
        {settings.thankYouShowResults ? (
          <div className="space-y-4 border-l-2 border-brand-200 pl-4">
            <Field label="Rankings header">
              <input
                value={settings.thankYouRankingsHeader || ""}
                onChange={(event) => onSettingsUpdate({ thankYouRankingsHeader: event.target.value })}
                className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
                placeholder="Your Preference Rankings"
              />
            </Field>
            <Field label="Rankings subtext">
              <textarea
                value={settings.thankYouRankingsSubtext || ""}
                onChange={(event) => onSettingsUpdate({ thankYouRankingsSubtext: event.target.value })}
                className="min-h-20 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                placeholder="Tap any linked item below to open its support resource."
              />
            </Field>
            <Field label="Question to showcase">
              <select
                value={settings.thankYouHighlightedQuestionId || ""}
                onChange={(event) => onSettingsUpdate({ thankYouHighlightedQuestionId: event.target.value })}
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="">Choose a question</option>
                {(survey.questions || []).filter((question) => ["ranked-order", "this-or-that", "multiple-choice"].includes(question.type)).map((question, questionIndex) => (
                  <option key={question.id} value={question.id}>
                    Q{questionIndex + 1} ({question.type}) {question.question.slice(0, 60)}
                  </option>
                ))}
              </select>
            </Field>
            {highlightedQuestion ? (
              <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-700">Option Link & Resource Settings</div>
                {highlightedOptions.length > 0 ? (
                  highlightedOptions.map((option) => {
                    const metadata = highlightedQuestion.optionMetadata?.[option] || {}
                    const legacyLink = settings.thankYouOptionLinks?.[`${highlightedQuestion.id}_${option}`]
                    return (
                      <div key={option} className="space-y-2 rounded-md border border-slate-200 bg-white p-3">
                        <div className="truncate text-xs font-semibold text-slate-600" title={option}>{option}</div>
                        <input
                          value={metadata.resultLabel || ""}
                          onChange={(event) => updateHighlightedOptionMetadata(option, { resultLabel: event.target.value })}
                          className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm"
                          placeholder="Result label, e.g. More leads"
                        />
                        <input
                          value={metadata.redirectUrl || legacyLink?.url || ""}
                          onChange={(event) => updateHighlightedOptionMetadata(option, { redirectUrl: event.target.value })}
                          className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm"
                          placeholder="Thank-you redirect URL"
                        />
                        <input
                          value={metadata.redirectLabel || legacyLink?.label || ""}
                          onChange={(event) => updateHighlightedOptionMetadata(option, { redirectLabel: event.target.value })}
                          className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm"
                          placeholder="Optional redirect tooltip/label"
                        />
                      </div>
                    )
                  })
                ) : (
                  <p className="text-xs leading-5 text-slate-500">The selected question does not have options to show on the outcome page.</p>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="space-y-4 rounded-md border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-950">Tracking</h2>
        <Field label="Google Analytics ID">
          <input value={tracking.googleAnalyticsId || ""} onChange={(event) => onSettingsUpdate({ tracking: { ...tracking, googleAnalyticsId: event.target.value } })} className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm" />
        </Field>
        <Field label="Facebook Pixel ID">
          <input value={tracking.facebookPixelId || ""} onChange={(event) => onSettingsUpdate({ tracking: { ...tracking, facebookPixelId: event.target.value } })} className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm" />
        </Field>
        <Field label="Custom tracking script">
          <textarea value={tracking.customScript || ""} onChange={(event) => onSettingsUpdate({ tracking: { ...tracking, customScript: event.target.value } })} className="min-h-24 w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-xs" />
        </Field>
      </section>

      <section className="space-y-4 rounded-md border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-950">Publishing</h2>
        <Field label="Public URL">
          <input value={publicUrl} readOnly className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm" />
        </Field>
        <Field label="Webhook URL">
          <input
            value={settings.webhookUrl || ""}
            onChange={(event) => onSettingsUpdate({ webhookUrl: event.target.value })}
            className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
            placeholder="https://..."
          />
        </Field>
        <Field label="Captured URL parameters">
          <UrlParamChips
            value={settings.urlParams || []}
            onChange={(urlParams) => onSettingsUpdate({ urlParams })}
          />
        </Field>
      </section>
    </div>
  )
}

function UrlParamChips({
  value,
  onChange
}: {
  value: string[]
  onChange: (value: string[]) => void
}) {
  const [draft, setDraft] = useState("")
  const params = useMemo(() => normalizeParams(value), [value])
  const suggestions = COMMON_URL_PARAMS.filter((param) => !params.includes(param))

  function commit(rawValue = draft) {
    const additions = normalizeParams(rawValue.split(","))
    if (!additions.length) {
      setDraft("")
      return
    }

    onChange(normalizeParams([...params, ...additions]))
    setDraft("")
  }

  function remove(param: string) {
    onChange(params.filter((item) => item !== param))
  }

  return (
    <div className="space-y-3">
      <div className="flex min-h-12 flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-2 focus-within:border-slate-950">
        {params.map((param) => (
          <span key={param} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-800">
            {param}
            <button
              type="button"
              className="rounded-full px-1 text-brand-700 hover:bg-brand-100 hover:text-brand-950"
              onClick={() => remove(param)}
              aria-label={`Remove ${param}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(event) => {
            const nextValue = event.target.value
            if (nextValue.includes(",")) {
              commit(nextValue)
            } else {
              setDraft(nextValue)
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === "Tab") {
              if (draft.trim()) {
                event.preventDefault()
                commit()
              }
            }
            if (event.key === "Backspace" && !draft && params.length) {
              remove(params[params.length - 1])
            }
          }}
          onBlur={() => {
            if (draft.trim()) commit()
          }}
          className="h-8 min-w-32 flex-1 border-0 bg-transparent px-2 text-sm outline-none"
          placeholder={params.length ? "Add another..." : "Type a param, then comma or Enter"}
        />
      </div>
      {suggestions.length ? (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((param) => (
            <button
              key={param}
              type="button"
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800"
              onClick={() => onChange(normalizeParams([...params, param]))}
            >
              + {param}
            </button>
          ))}
        </div>
      ) : null}
      <p className="text-xs leading-5 text-slate-500">
        Captured params are saved with each response when present in the survey URL.
      </p>
    </div>
  )
}

function CustomThankYouPageManager({
  pages,
  selectedPageId,
  questions,
  enabled,
  onSelect,
  onCreate,
  onSave,
  onDelete
}: {
  pages: ThankYouPage[]
  selectedPageId?: string
  questions: SurveyQuestion[]
  enabled: boolean
  onSelect: (pageId: string | undefined) => void
  onCreate: () => Promise<void>
  onSave: (pageId: string, updates: { name?: string; content?: ThankYouPageContent; is_default?: boolean; status?: "draft" | "active" | "archived" }) => Promise<void>
  onDelete: (pageId: string) => Promise<void>
}) {
  const selectedPage = pages.find((page) => page.id === selectedPageId) || pages.find((page) => page.is_default) || pages[0]
  const [draftName, setDraftName] = useState("")
  const [draftContent, setDraftContent] = useState<ThankYouPageContent>({})
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [previewMode, setPreviewMode] = useState(false)

  useEffect(() => {
    setDraftName(selectedPage?.name || "")
    const nextContent = selectedPage?.content || {}
    const nextConfig = nextContent.openPageConfig || (selectedPage ? createOpenPageConfigFromContent(selectedPage.name, nextContent, questions) : undefined)
    const contentWithConfig = nextConfig ? { ...nextContent, openPageConfig: nextConfig } : nextContent
    setDraftContent(contentWithConfig)
    setSelectedBlockId(nextConfig?.blocks[0]?.id || null)
  }, [questions, selectedPage])

  function updateContent(updates: Partial<ThankYouPageContent>) {
    setDraftContent((current) => ({ ...current, ...updates }))
  }

  const visualConfig = draftContent.openPageConfig || createOpenPageConfigFromContent(draftName || selectedPage?.name || "Outcome", draftContent, questions)
  const visualBlocks = visualConfig.blocks || []
  const selectedBlock = visualBlocks.find((block) => block.id === selectedBlockId) || visualBlocks[0]
  const rankingQuestions = questions.filter((question) => ["ranked-order", "this-or-that", "multiple-choice"].includes(question.type))

  function updateVisualConfig(updates: Partial<ThankYouOpenPageConfig>) {
    updateContent({
      openPageConfig: {
        ...visualConfig,
        ...updates,
        name: updates.name || visualConfig.name || draftName || "Outcome",
        blocks: updates.blocks || visualBlocks
      }
    })
  }

  function updateVisualBlock(blockId: string, updates: Partial<ThankYouVisualBlock>) {
    updateVisualConfig({
      blocks: visualBlocks.map((block) => block.id === blockId ? { ...block, ...updates, props: { ...block.props, ...(updates.props || {}) } } : block)
    })
  }

  function createNewVisualBlock(type: ThankYouVisualBlockType) {
    const definition = VISUAL_THANK_YOU_BLOCK_TYPES.find((item) => item.value === type)
    return createVisualBlock(type, {
      text: type === "heading" ? "New heading" : type === "text" ? "Add supporting copy here." : undefined,
      label: definition?.label,
      submitLabel: type === "form" ? "Submit" : undefined,
      fields: type === "form" ? ["email", "phone"] : undefined,
      layout: type === "form" ? "auto" : undefined,
      hidePrefilled: type === "form" ? true : undefined,
      height: type === "schedule" ? 640 : undefined,
      icon: type === "icon" ? "check" : undefined,
      questionId: definition?.needsQuestion ? (draftContent.highlightedQuestionId || rankingQuestions[0]?.id) : undefined,
      align: ["icon", "heading", "text", "button", "image", "video", "schedule"].includes(type) ? "center" : undefined,
      marginTop: 0,
      marginBottom: 16,
      padding: type === "divider" ? 0 : 16
    })
  }

  function addVisualBlock(type: ThankYouVisualBlockType, insertIndex = visualBlocks.length) {
    const block = createNewVisualBlock(type)
    const nextBlocks = [...visualBlocks]
    nextBlocks.splice(Math.max(0, Math.min(insertIndex, nextBlocks.length)), 0, block)
    updateVisualConfig({ blocks: nextBlocks })
    setSelectedBlockId(block.id)
  }

  function moveVisualBlock(blockId: string, direction: -1 | 1) {
    const index = visualBlocks.findIndex((block) => block.id === blockId)
    const target = index + direction
    if (index < 0 || target < 0 || target >= visualBlocks.length) return
    const nextBlocks = [...visualBlocks]
    const [block] = nextBlocks.splice(index, 1)
    nextBlocks.splice(target, 0, block)
    updateVisualConfig({ blocks: nextBlocks })
  }

  function removeVisualBlock(blockId: string) {
    const nextBlocks = visualBlocks.filter((block) => block.id !== blockId)
    updateVisualConfig({ blocks: nextBlocks })
    setSelectedBlockId(nextBlocks[0]?.id || null)
  }

  function reorderVisualBlockToIndex(draggedBlockId: string, insertIndex: number) {
    const draggedBlock = visualBlocks.find((block) => block.id === draggedBlockId)
    if (!draggedBlock) return
    const sourceIndex = visualBlocks.findIndex((block) => block.id === draggedBlockId)
    const nextBlocks = visualBlocks.filter((block) => block.id !== draggedBlockId)
    const adjustedIndex = sourceIndex >= 0 && sourceIndex < insertIndex ? insertIndex - 1 : insertIndex
    nextBlocks.splice(Math.max(0, Math.min(adjustedIndex, nextBlocks.length)), 0, draggedBlock)
    updateVisualConfig({ blocks: nextBlocks })
    setSelectedBlockId(draggedBlockId)
  }

  function getDropIndexForBlock(event: React.DragEvent, targetBlockId: string) {
    const targetIndex = visualBlocks.findIndex((block) => block.id === targetBlockId)
    if (targetIndex < 0) return visualBlocks.length
    const rect = event.currentTarget.getBoundingClientRect()
    const isAfter = event.clientY > rect.top + rect.height / 2
    return targetIndex + (isAfter ? 1 : 0)
  }

  function handleTrayDragStart(event: React.DragEvent, type: ThankYouVisualBlockType) {
    event.dataTransfer.effectAllowed = "copy"
    event.dataTransfer.setData("application/surveyflow-thank-you-block-type", type)
  }

  function handleCanvasDrop(event: React.DragEvent) {
    event.preventDefault()
    const blockType = event.dataTransfer.getData("application/surveyflow-thank-you-block-type") as ThankYouVisualBlockType
    const draggedBlockId = event.dataTransfer.getData("application/surveyflow-thank-you-block-id")
    const targetIndex = dropIndex ?? visualBlocks.length
    if (blockType) addVisualBlock(blockType, targetIndex)
    if (draggedBlockId) reorderVisualBlockToIndex(draggedBlockId, targetIndex)
    setDropIndex(null)
  }

  function handleBlockDrop(event: React.DragEvent, targetBlockId: string) {
    event.preventDefault()
    event.stopPropagation()
    const targetIndex = dropIndex ?? getDropIndexForBlock(event, targetBlockId)
    const blockType = event.dataTransfer.getData("application/surveyflow-thank-you-block-type") as ThankYouVisualBlockType
    if (blockType) {
      addVisualBlock(blockType, targetIndex)
      setDropIndex(null)
      return
    }

    const draggedBlockId = event.dataTransfer.getData("application/surveyflow-thank-you-block-id")
    if (draggedBlockId) reorderVisualBlockToIndex(draggedBlockId, targetIndex)
    setDropIndex(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-slate-950">Outcomes</div>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Create OpenPage-style completion pages and save their block JSON to Supabase.
          </p>
        </div>
        <Button type="button" className="h-10 px-4 text-sm" onClick={onCreate} disabled={!enabled}>
          <Plus className="mr-2 h-4 w-4" />
          New Outcome
        </Button>
      </div>

      {!enabled ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium leading-5 text-amber-800">
          Enable the Outcome Builder entitlement and flags to create custom outcomes. The generic outcome below is still included.
        </div>
      ) : null}

      {pages.length ? (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {pages.map((page) => (
            <button
              key={page.id}
              type="button"
              onClick={() => onSelect(page.id)}
              className={[
                "rounded-md border bg-white p-3 text-left transition hover:border-slate-400",
                selectedPage?.id === page.id ? "border-slate-950 shadow-sm" : "border-slate-200"
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-slate-950">{page.name}</div>
                  <div className="mt-1 text-xs text-slate-500">{page.content?.openPageConfig?.blocks?.length || page.content?.blocks?.length || 0} blocks</div>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                  {page.is_default ? "Default" : page.status}
                </span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-slate-300 bg-white px-3 py-3 text-xs leading-5 text-slate-500">
          No custom outcomes yet. Click New Outcome to open the visual editor and create the first one.
        </p>
      )}

      {selectedPage ? (
        <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)_320px]">
          <aside className="space-y-3 rounded-md border border-slate-200 bg-white p-3">
            <Field label="Outcome name">
              <input
                value={draftName}
                onChange={(event) => {
                  setDraftName(event.target.value)
                  updateVisualConfig({ name: event.target.value })
                }}
                className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
              />
            </Field>
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Add blocks</div>
              {VISUAL_THANK_YOU_BLOCK_TYPES.map((blockType) => (
                <button
                  key={blockType.value}
                  type="button"
                  draggable
                  className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-xs transition hover:border-brand-200 hover:bg-brand-50"
                  onDragStart={(event) => handleTrayDragStart(event, blockType.value)}
                  onClick={() => addVisualBlock(blockType.value)}
                >
                  <span className="block font-bold text-slate-950">+ {blockType.label}</span>
                  <span className="mt-1 block leading-5 text-slate-500">{blockType.description}</span>
                </button>
              ))}
            </div>
          </aside>

          <section className="min-h-[560px] rounded-md border border-slate-200 bg-slate-950 p-4">
            <div className="mb-3 flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-wide text-slate-400">
              <span>OpenPage Canvas</span>
              <div className="flex items-center gap-2">
                <span>{visualBlocks.length} blocks</span>
                <button
                  type="button"
                  onClick={() => setPreviewMode((current) => !current)}
                  className="inline-flex items-center gap-1 rounded-full border border-white/15 px-2 py-1 text-[10px] text-white transition hover:bg-white/10"
                >
                  <Eye className="h-3 w-3" />
                  {previewMode ? "Edit" : "Preview"}
                </button>
              </div>
            </div>
            <div
              className="mx-auto min-h-[500px] max-w-3xl rounded-2xl border border-white/10 bg-black px-6 py-8 text-white shadow-2xl"
              onDragOver={(event) => {
                event.preventDefault()
                if (!visualBlocks.length) setDropIndex(0)
              }}
              onDrop={handleCanvasDrop}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropIndex(null)
              }}
            >
              {visualBlocks.length ? (
                <div className="space-y-0">
                  {dropIndex === 0 && !previewMode ? <ThankYouDropIndicator /> : null}
                  {visualBlocks.map((block, index) => {
                    const active = selectedBlock?.id === block.id
                    return (
                      <div key={block.id}>
                        <div
                          role="button"
                          tabIndex={0}
                          draggable={!previewMode}
                          onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = "move"
                            event.dataTransfer.setData("application/surveyflow-thank-you-block-id", block.id)
                          }}
                          onDragOver={(event) => {
                            event.preventDefault()
                            setDropIndex(getDropIndexForBlock(event, block.id))
                          }}
                          onDrop={(event) => handleBlockDrop(event, block.id)}
                          onClick={() => setSelectedBlockId(block.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") setSelectedBlockId(block.id)
                          }}
                          className={[
                            "group block w-full rounded-xl border text-left transition",
                            previewMode ? "border-transparent bg-transparent" : active ? "border-orange-400 bg-orange-400/10" : "border-white/10 bg-white/[0.03] hover:border-white/30"
                          ].join(" ")}
                          style={getThankYouBlockSpacingStyle(block)}
                        >
                          {!previewMode ? (
                            <div className="mb-2 flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                              <span className="inline-flex items-center gap-2"><GripVertical className="h-3.5 w-3.5" /> Block {index + 1} · {block.type}</span>
                              <span className="opacity-0 transition group-hover:opacity-100">Click to edit</span>
                            </div>
                          ) : null}
                          <ThankYouCanvasBlock block={block} />
                        </div>
                        {dropIndex === index + 1 && !previewMode ? <ThankYouDropIndicator /> : null}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="grid min-h-[420px] place-items-center rounded-xl border border-dashed border-white/20 text-center text-sm text-slate-400">
                  Add a block to start building this outcome.
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-3 rounded-md border border-slate-200 bg-white p-3">
            {selectedBlock ? (
              <ThankYouBlockProperties
                block={selectedBlock}
                questions={questions}
                rankingQuestions={rankingQuestions}
                onChange={(updates) => updateVisualBlock(selectedBlock.id, updates)}
                onMoveUp={() => moveVisualBlock(selectedBlock.id, -1)}
                onMoveDown={() => moveVisualBlock(selectedBlock.id, 1)}
                onRemove={() => removeVisualBlock(selectedBlock.id)}
              />
            ) : (
              <div className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500">Select a block to edit its settings.</div>
            )}
          </aside>

          <div className="flex flex-wrap items-center justify-between gap-2 xl:col-span-3">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <ToggleSwitch checked={selectedPage.is_default} onChange={(checked) => void onSave(selectedPage.id, { is_default: checked })} />
              Default page
            </label>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" className="h-9 px-3 text-sm" onClick={() => void onDelete(selectedPage.id)}>
                Delete
              </Button>
              <Button type="button" className="h-9 px-3 text-sm" onClick={() => void onSave(selectedPage.id, { name: draftName, content: draftContent, status: "active" })}>
                Save page
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ThankYouDropIndicator() {
  return (
    <div className="rounded-full border border-dashed border-orange-400 bg-orange-400/10 px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-orange-200">
      Drop block here
    </div>
  )
}

function getThankYouBlockSpacingStyle(block: ThankYouVisualBlock): React.CSSProperties {
  return {
    marginTop: `${block.props.marginTop ?? 0}px`,
    marginBottom: `${block.props.marginBottom ?? 16}px`,
    padding: `${block.props.padding ?? 16}px`
  }
}

function ThankYouCanvasBlock({ block }: { block: ThankYouVisualBlock }) {
  const textAlign = block.props.align === "left" ? "text-left" : "text-center"

  if (block.type === "icon") {
    return (
      <div className={block.props.align === "left" ? "text-left" : "text-center"}>
        <span className="inline-grid h-16 w-16 place-items-center rounded-full border-4 border-orange-500 bg-orange-500/10 shadow-[0_0_0_8px_rgba(249,115,22,0.12)]">
          <Check className="h-8 w-8 text-orange-400" strokeWidth={3} />
        </span>
      </div>
    )
  }

  if (block.type === "heading") {
    return <h3 className={`font-serif text-4xl font-extrabold leading-tight ${textAlign}`}>{block.props.text || "Thank You!"}</h3>
  }

  if (block.type === "text") {
    return <p className={`font-serif text-lg leading-8 text-slate-300 ${textAlign}`}>{block.props.text || "Add supporting copy here."}</p>
  }

  if (block.type === "button") {
    return (
      <div className={block.props.align === "left" ? "text-left" : "text-center"}>
        <span className="inline-flex rounded-full bg-orange-500 px-6 py-3 font-serif text-sm font-bold text-white shadow-lg">
          {block.props.label || "Continue"}
        </span>
      </div>
    )
  }

  if (block.type === "divider") {
    return <div className="h-px w-full bg-white/15" />
  }

  if (block.type === "image") {
    return (
      <div className={block.props.align === "left" ? "text-left" : "text-center"}>
        {block.props.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={block.props.src} alt={block.props.alt || ""} className="mx-auto max-h-72 w-full rounded-2xl object-cover" />
        ) : (
          <div className="grid min-h-40 place-items-center rounded-2xl border border-dashed border-white/20 text-slate-400">
            <div className="text-center">
              <ImageIcon className="mx-auto h-8 w-8" />
              <div className="mt-2 text-sm font-bold">Image block</div>
            </div>
          </div>
        )}
        {block.props.caption ? <p className="mt-2 text-xs text-slate-400">{block.props.caption}</p> : null}
      </div>
    )
  }

  if (block.type === "video") {
    const videoUrl = block.props.src || ""
    const embedUrl = toThankYouEmbedUrl(videoUrl)
    return (
      <div className={block.props.align === "left" ? "text-left" : "text-center"}>
        {videoUrl ? (
          <div className="aspect-video overflow-hidden rounded-2xl border border-white/15 bg-white/[0.03]">
            {isDirectVideoUrl(videoUrl) ? (
              <video src={videoUrl} controls className="h-full w-full" />
            ) : embedUrl ? (
              <iframe
                src={embedUrl}
                title={block.props.caption || "Video preview"}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : (
              <div className="grid h-full place-items-center text-slate-300">
                <div className="text-center">
                  <Video className="mx-auto h-9 w-9 text-orange-400" />
                  <div className="mt-2 text-sm font-bold">Paste a YouTube, Vimeo, Wistia, or direct video URL</div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid aspect-video place-items-center rounded-2xl border border-white/15 bg-white/[0.03] text-slate-300">
            <div className="text-center">
              <Video className="mx-auto h-9 w-9 text-orange-400" />
              <div className="mt-2 text-sm font-bold">Video block</div>
            </div>
          </div>
        )}
        {block.props.caption ? <p className="mt-2 text-xs text-slate-400">{block.props.caption}</p> : null}
      </div>
    )
  }

  if (block.type === "schedule") {
    const scheduleUrl = toBookingEmbedUrl(block.props.embedHtml || block.props.embedUrl || block.props.src || block.props.href || "")
    return (
      <div className={block.props.align === "left" ? "text-left" : "text-center"}>
        {block.props.label ? <div className="mb-3 font-serif text-xl font-bold">{block.props.label}</div> : null}
        {scheduleUrl ? (
          <div className="overflow-hidden rounded-2xl border border-white/15 bg-white/[0.03]" style={{ height: Math.min(Math.max(block.props.height || 420, 220), 720) }}>
            <iframe src={scheduleUrl} title={block.props.label || "Schedule time"} className="h-full w-full bg-white" />
          </div>
        ) : (
          <div className="grid min-h-52 place-items-center rounded-2xl border border-dashed border-white/20 text-slate-400">
            <div className="text-center">
              <CalendarDays className="mx-auto h-8 w-8 text-orange-400" />
              <div className="mt-2 text-sm font-bold">Schedule / booking block</div>
              <div className="mt-1 text-xs">Paste a booking URL or full embed snippet with data-url/cal-link.</div>
            </div>
          </div>
        )}
        {block.props.caption ? <p className="mt-2 text-xs text-slate-400">{block.props.caption}</p> : null}
      </div>
    )
  }

  if (block.type === "form") {
    const fields = block.props.fields?.length ? block.props.fields : ["email", "phone"]
    const layoutClass = block.props.layout === "stacked" ? "grid-cols-1" : block.props.layout === "two-column" ? "sm:grid-cols-2" : "sm:grid-cols-2"
    return (
      <div className="space-y-3">
        <div className="font-serif text-xl font-bold">{block.props.label || "Stay connected"}</div>
        <div className={`grid gap-3 ${layoutClass}`}>
          {fields.map((field) => (
            <div key={field} className="h-11 rounded-xl border border-white/15 bg-white/[0.03] px-4 py-3 text-sm text-slate-400">
              {CONTACT_FIELDS.find((item) => item.value === field)?.label || field}
            </div>
          ))}
        </div>
        <div className="text-xs text-slate-500">
          {block.props.layout === "stacked" ? "Always 100% width." : block.props.layout === "two-column" ? "Side-by-side on desktop, stacked on mobile." : "Auto: side-by-side on desktop, stacked on mobile."}
          {block.props.hidePrefilled !== false ? " Prefilled fields will be hidden." : " Prefilled fields remain visible."}
        </div>
        <span className="inline-flex rounded-full bg-orange-500 px-5 py-2 font-serif text-sm font-bold text-white">
          {block.props.submitLabel || "Submit"}
        </span>
      </div>
    )
  }

  if (block.type === "preference-results") {
    return (
      <div className="space-y-3">
        <div className="font-serif text-xl font-bold">{block.props.label || "Your Preference Rankings"}</div>
        {[1, 2, 3].map((rank) => (
          <div key={rank} className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/[0.03] px-4 py-3">
            <span className="rounded-xl bg-orange-500 px-3 py-1 font-mono text-xs font-black">#{rank}</span>
            <span className="font-serif font-bold text-white">Survey preference item</span>
          </div>
        ))}
      </div>
    )
  }

  if (block.type === "top-preference") {
    return (
      <div className="rounded-xl border border-white/15 bg-white/[0.03] p-4">
        <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{block.props.label || "Top Preference"}</div>
        <div className="mt-2 font-serif text-2xl font-bold">#1 Survey preference item</div>
      </div>
    )
  }

  if (block.type === "answer-summary") {
    return (
      <div className="rounded-xl border border-white/15 bg-white/[0.03] p-4">
        <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{block.props.label || "Answer Summary"}</div>
        <div className="mt-2 text-sm text-slate-300">Submitted survey answers will render here.</div>
      </div>
    )
  }

  if (block.type === "contact-fields") {
    return (
      <div className="rounded-xl border border-white/15 bg-white/[0.03] p-4">
        <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{block.props.label || "Contact Fields"}</div>
        <div className="mt-2 text-sm text-slate-300">Email, phone, name, and company fields will render here when captured.</div>
      </div>
    )
  }

  if (block.type === "raw-metadata") {
    return (
      <div className="rounded-xl border border-white/15 bg-white/[0.03] p-4">
        <div className="text-xs font-bold uppercase tracking-wide text-slate-400">{block.props.label || "URL Parameters"}</div>
        <div className="mt-2 font-mono text-xs text-slate-300">utm_source, email, and other URL params will render here.</div>
      </div>
    )
  }

  return null
}

function ThankYouBlockProperties({
  block,
  questions,
  rankingQuestions,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove
}: {
  block: ThankYouVisualBlock
  questions: SurveyQuestion[]
  rankingQuestions: SurveyQuestion[]
  onChange: (updates: Partial<ThankYouVisualBlock>) => void
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
}) {
  const definition = VISUAL_THANK_YOU_BLOCK_TYPES.find((item) => item.value === block.type)
  const questionOptions = definition?.needsQuestion ? rankingQuestions : questions

  function updateProps(props: Partial<ThankYouVisualBlock["props"]>) {
    onChange({ props })
  }

  function toggleFormField(field: string, checked: boolean) {
    const currentFields = block.props.fields || ["email", "phone"]
    const nextFields = checked
      ? Array.from(new Set([...currentFields, field]))
      : currentFields.filter((item) => item !== field)
    updateProps({ fields: nextFields })
  }

  const mergeFieldHint = (
    <p className="text-xs leading-5 text-slate-500">
      Merge fields work here, e.g. {"{{contactinfo.first_name}}"}, {"{{contactinfo.email}}"}, {"{{contactinfo.phone}}"}, or {"{{urlparams.utm_source}}"}.
    </p>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-slate-950">Block settings</div>
          <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{definition?.label || block.type}</div>
        </div>
        <ToggleSwitch checked={block.props.visible !== false} onChange={(visible) => updateProps({ visible })} />
      </div>

      <Field label="Block type">
        <select
          value={block.type}
          onChange={(event) => onChange({ type: event.target.value as ThankYouVisualBlockType })}
          className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          {VISUAL_THANK_YOU_BLOCK_TYPES.map((blockType) => (
            <option key={blockType.value} value={blockType.value}>{blockType.label}</option>
          ))}
        </select>
      </Field>

      <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
        <div className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Spacing</div>
        <div className="space-y-3">
          <SpacingSlider label="Top margin" value={block.props.marginTop ?? 0} min={0} max={96} onChange={(marginTop) => updateProps({ marginTop })} />
          <SpacingSlider label="Bottom margin" value={block.props.marginBottom ?? 16} min={0} max={96} onChange={(marginBottom) => updateProps({ marginBottom })} />
          <SpacingSlider label="Padding" value={block.props.padding ?? 16} min={0} max={64} onChange={(padding) => updateProps({ padding })} />
        </div>
      </div>

      {block.type === "heading" || block.type === "text" ? (
        <>
          <Field label={block.type === "heading" ? "Heading text" : "Body text"}>
            <textarea
              value={block.props.text || ""}
              onChange={(event) => updateProps({ text: event.target.value })}
              className="min-h-24 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            />
          </Field>
          {mergeFieldHint}
          <Field label="Alignment">
            <select
              value={block.props.align || "center"}
              onChange={(event) => updateProps({ align: event.target.value as "left" | "center" })}
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="center">Center</option>
              <option value="left">Left</option>
            </select>
          </Field>
        </>
      ) : null}

      {block.type === "button" ? (
        <>
          <Field label="Button label">
            <input
              value={block.props.label || ""}
              onChange={(event) => updateProps({ label: event.target.value })}
              className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
              placeholder="Continue"
            />
          </Field>
          {mergeFieldHint}
          <Field label="Button URL">
            <input
              value={block.props.href || ""}
              onChange={(event) => updateProps({ href: event.target.value })}
              className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
              placeholder="Leave empty to submit another response"
            />
          </Field>
          {mergeFieldHint}
        </>
      ) : null}

      {block.type === "icon" ? (
        <Field label="Alignment">
          <select
            value={block.props.align || "center"}
            onChange={(event) => updateProps({ align: event.target.value as "left" | "center" })}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="center">Center</option>
            <option value="left">Left</option>
          </select>
        </Field>
      ) : null}

      {block.type === "image" ? (
        <>
          <Field label="Image URL">
            <input
              value={block.props.src || ""}
              onChange={(event) => updateProps({ src: event.target.value })}
              className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
              placeholder="https://..."
            />
          </Field>
          {mergeFieldHint}
          <Field label="Alt text">
            <input
              value={block.props.alt || ""}
              onChange={(event) => updateProps({ alt: event.target.value })}
              className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
              placeholder="Describe the image"
            />
          </Field>
          <Field label="Caption">
            <input
              value={block.props.caption || ""}
              onChange={(event) => updateProps({ caption: event.target.value })}
              className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
              placeholder="Optional caption"
            />
          </Field>
          {mergeFieldHint}
          <Field label="Alignment">
            <select
              value={block.props.align || "center"}
              onChange={(event) => updateProps({ align: event.target.value as "left" | "center" })}
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="center">Center</option>
              <option value="left">Left</option>
            </select>
          </Field>
        </>
      ) : null}

      {block.type === "video" ? (
        <>
          <Field label="Video URL or embed URL">
            <input
              value={block.props.src || ""}
              onChange={(event) => updateProps({ src: event.target.value })}
              className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
              placeholder="https://..."
            />
          </Field>
          {mergeFieldHint}
          <p className="text-xs leading-5 text-slate-500">
            Supports YouTube watch/share/embed URLs, Vimeo URLs, Wistia media/embed URLs, and direct .mp4, .webm, or .ogg files.
          </p>
          <Field label="Caption">
            <input
              value={block.props.caption || ""}
              onChange={(event) => updateProps({ caption: event.target.value })}
              className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
              placeholder="Optional caption"
            />
          </Field>
          <Field label="Alignment">
            <select
              value={block.props.align || "center"}
              onChange={(event) => updateProps({ align: event.target.value as "left" | "center" })}
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="center">Center</option>
              <option value="left">Left</option>
            </select>
          </Field>
        </>
      ) : null}

      {block.type === "schedule" ? (
        <>
          <Field label="Booking URL or embed snippet">
            <textarea
              value={block.props.embedHtml || block.props.embedUrl || block.props.src || ""}
              onChange={(event) => {
                const rawValue = event.target.value
                const embedUrl = toBookingEmbedUrl(rawValue)
                updateProps({ embedHtml: rawValue, embedUrl, src: embedUrl || rawValue })
              }}
              className="min-h-24 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              placeholder="https://calendly.com/... or full embed snippet"
            />
          </Field>
          {mergeFieldHint}
          <p className="text-xs leading-5 text-slate-500">
            Use a hosted booking URL or a full embed snippet that includes an iframe src, data-url, or Cal.com cal-link. Script-only snippets need the actual booking link too.
          </p>
          <Field label="Block headline">
            <input
              value={block.props.label || ""}
              onChange={(event) => updateProps({ label: event.target.value })}
              className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
              placeholder="Schedule time with us"
            />
          </Field>
          <Field label="Embed height">
            <input
              type="number"
              value={block.props.height || 640}
              onChange={(event) => updateProps({ height: Number(event.target.value) || 640 })}
              className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
              min={220}
              max={900}
            />
          </Field>
          <Field label="Caption">
            <input
              value={block.props.caption || ""}
              onChange={(event) => updateProps({ caption: event.target.value })}
              className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
              placeholder="Optional caption"
            />
          </Field>
          <Field label="Alignment">
            <select
              value={block.props.align || "center"}
              onChange={(event) => updateProps({ align: event.target.value as "left" | "center" })}
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="center">Center</option>
              <option value="left">Left</option>
            </select>
          </Field>
        </>
      ) : null}

      {block.type === "form" ? (
        <>
          <Field label="Form headline">
            <input
              value={block.props.label || ""}
              onChange={(event) => updateProps({ label: event.target.value })}
              className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
              placeholder="Enter your mobile number to get XYZ"
            />
          </Field>
          {mergeFieldHint}
          <Field label="Fields to capture">
            <div className="grid gap-2">
              {CONTACT_FIELDS.map((field) => (
                <label key={field.value} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
                  {field.label}
                  <ToggleSwitch
                    checked={(block.props.fields || ["email", "phone"]).includes(field.value)}
                    onChange={(checked) => toggleFormField(field.value, checked)}
                  />
                </label>
              ))}
            </div>
          </Field>
          <Field label="Field layout">
            <select
              value={block.props.layout || "auto"}
              onChange={(event) => updateProps({ layout: event.target.value as ThankYouVisualBlock["props"]["layout"] })}
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="auto">Auto: desktop side-by-side, mobile stacked</option>
              <option value="two-column">Force side-by-side on desktop</option>
              <option value="stacked">Always 100% width</option>
            </select>
          </Field>
          <label className="flex items-start justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
            <span>
              Hide fields already captured
              <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">
                If email, phone, or name came from URL/form metadata, that field will not be shown again.
              </span>
            </span>
            <ToggleSwitch
              checked={block.props.hidePrefilled !== false}
              onChange={(hidePrefilled) => updateProps({ hidePrefilled })}
            />
          </label>
          <Field label="Submit button label">
            <input
              value={block.props.submitLabel || ""}
              onChange={(event) => updateProps({ submitLabel: event.target.value })}
              className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
              placeholder="Submit"
            />
          </Field>
        </>
      ) : null}

      {["preference-results", "top-preference", "answer-summary", "contact-fields", "raw-metadata"].includes(block.type) ? (
        <Field label="Label">
          <input
            value={block.props.label || ""}
            onChange={(event) => updateProps({ label: event.target.value })}
            className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
            placeholder={definition?.label}
          />
        </Field>
      ) : null}

      {questionOptions.length && (definition?.needsQuestion || block.type === "answer-summary") ? (
        <Field label="Survey answer source">
          <select
            value={block.props.questionId || ""}
            onChange={(event) => updateProps({ questionId: event.target.value || undefined })}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">{block.type === "answer-summary" ? "All questions" : "Automatic first eligible question"}</option>
            {questionOptions.map((question, index) => (
              <option key={question.id} value={question.id}>
                Q{index + 1} ({question.type}) {question.question.slice(0, 44)}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      <div className="grid grid-cols-3 gap-2 border-t border-slate-200 pt-3">
        <button type="button" className="rounded-md border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50" onClick={onMoveUp}>Up</button>
        <button type="button" className="rounded-md border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50" onClick={onMoveDown}>Down</button>
        <button type="button" className="rounded-md border border-red-200 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50" onClick={onRemove}>Delete</button>
      </div>
    </div>
  )
}

function normalizeParams(values: string[] | string) {
  const rawValues = Array.isArray(values) ? values : values.split(",")
  return Array.from(new Set(rawValues.map((value) => value.trim()).filter(Boolean)))
}

function SpacingSlider({
  label,
  value,
  min,
  max,
  onChange
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between gap-2 text-xs font-semibold text-slate-600">
        <span>{label}</span>
        <span className="font-mono text-slate-500">{value}px</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={4}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-slate-950"
      />
    </label>
  )
}

function isDirectVideoUrl(url: string) {
  return /\.(mp4|webm|ogg)(\?|#|$)/i.test(url)
}

function extractEmbedAttribute(rawValue: string, attribute: string) {
  const match = rawValue.match(new RegExp(`${attribute}=["']([^"']+)["']`, "i"))
  return match?.[1] || ""
}

function toBookingEmbedUrl(rawValue: string) {
  const trimmed = rawValue.trim()
  if (!trimmed) return ""

  const iframeSrc = extractEmbedAttribute(trimmed, "src")
  const dataUrl = extractEmbedAttribute(trimmed, "data-url") || extractEmbedAttribute(trimmed, "data-src")
  const calLink = extractEmbedAttribute(trimmed, "cal-link")
  const candidate = dataUrl || (iframeSrc && !/\.js(\?|#|$)/i.test(iframeSrc) ? iframeSrc : "") || trimmed

  if (calLink) {
    return /^https?:\/\//i.test(calLink) ? calLink : `https://cal.com/${calLink.replace(/^\/+/, "")}`
  }

  try {
    const parsed = new URL(candidate)
    if (/\.js(\?|#|$)/i.test(parsed.pathname)) return ""
    return parsed.toString()
  } catch {
    return ""
  }
}

function toThankYouEmbedUrl(url: string) {
  if (!url || isDirectVideoUrl(url)) return ""
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase()
    if (hostname.includes("youtu.be")) {
      const videoId = parsed.pathname.split("/").filter(Boolean)[0]
      return videoId ? `https://www.youtube.com/embed/${videoId}` : ""
    }
    if (hostname.includes("youtube.com")) {
      if (parsed.pathname.includes("/embed/")) return url
      const videoId = parsed.searchParams.get("v") || parsed.pathname.split("/").filter(Boolean).at(-1)
      return videoId ? `https://www.youtube.com/embed/${videoId}` : ""
    }
    if (hostname.includes("vimeo.com")) {
      if (parsed.pathname.includes("/video/")) return url
      const videoId = parsed.pathname.split("/").filter(Boolean)[0]
      return videoId ? `https://player.vimeo.com/video/${videoId}` : ""
    }
    if (hostname.includes("wistia.") || hostname.includes("wi.st")) {
      if (parsed.pathname.includes("/embed/iframe/")) return url
      const parts = parsed.pathname.split("/").filter(Boolean)
      const mediaIndex = parts.indexOf("medias")
      const videoId = mediaIndex >= 0 ? parts[mediaIndex + 1] : parts.at(-1)
      return videoId ? `https://fast.wistia.net/embed/iframe/${videoId}` : ""
    }
    if (parsed.pathname.includes("/embed/")) return url
  } catch {
    return ""
  }
  return ""
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="block space-y-1.5">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
    </div>
  )
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-12 rounded-md border border-slate-200 bg-white p-1" />
        <input value={value} onChange={(event) => onChange(event.target.value)} className="h-10 flex-1 rounded-md border border-slate-200 px-3 text-sm" />
      </div>
    </Field>
  )
}

function ToggleSwitch({
  checked,
  onChange,
  disabled
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        "relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "border-slate-950 bg-slate-950" : "border-slate-300 bg-slate-200"
      ].join(" ")}
    >
      <span
        className={[
          "inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform",
          checked ? "translate-x-6" : "translate-x-1"
        ].join(" ")}
      />
    </button>
  )
}

function TabButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors",
        active ? "bg-slate-950 text-white shadow-sm" : "text-muted-foreground hover:bg-white hover:text-foreground"
      ].join(" ")}
    >
      {children}
    </button>
  )
}

function StatusSelect({ value, onChange }: { value: SurveyStatus; onChange: (status: SurveyStatus) => void }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as SurveyStatus)}
      className="h-10 rounded-xl border border-border bg-white px-4 text-xs font-bold uppercase tracking-wider text-muted-foreground shadow-sm"
    >
      {STATUS_OPTIONS.map((status) => (
        <option key={status} value={status}>
          {status}
        </option>
      ))}
    </select>
  )
}

function normalizeSurvey(row: any): SurveyEditorRow {
  return {
    id: row.id,
    name: row.name || "Untitled Survey",
    description: row.description || "",
    seo_description: row.seo_description || "",
    questions: Array.isArray(row.questions) ? row.questions : [],
    style: { ...DEFAULT_SURVEY_STYLE, ...(row.style || {}) },
    settings: { ...DEFAULT_SURVEY_SETTINGS, ...(row.settings || {}) },
    status: row.status || "draft",
    updated_at: row.updated_at
  }
}

function normalizeQuestionForType(existing: SurveyQuestion, updates: Partial<SurveyQuestion>, nextType: QuestionType): SurveyQuestion {
  const merged = { ...existing, ...updates, type: nextType }
  const base: SurveyQuestion = {
    id: merged.id,
    type: nextType,
    question: merged.question || "New Question",
    description: merged.description,
    required: merged.required ?? true,
    category: merged.category
  }

  if (nextType === "multiple-choice" || nextType === "ranked-order" || nextType === "this-or-that") {
    base.options = merged.options?.length ? merged.options : ["Option 1", "Option 2"]
    base.optionMetadata = pruneOptionMetadata(merged.optionMetadata, base.options)
    base.dynamicOptionsFromQuestionId = merged.dynamicOptionsFromQuestionId
    base.optionParamMappings = merged.optionParamMappings
    base.paramMapping = merged.paramMapping
  }

  if (nextType === "multiple-choice") {
    base.allowMultiple = merged.allowMultiple
    base.maxSelections = merged.maxSelections
    base.allowOther = merged.allowOther
    base.scores = merged.scores
    base.logic = merged.logic
  }

  if (nextType === "this-or-that") {
    base.useInferenceAlgorithm = merged.useInferenceAlgorithm ?? true
  }

  if (nextType === "text") {
    base.placeholder = merged.placeholder
    base.textInputMode = merged.textInputMode || "long"
    base.paramMapping = merged.paramMapping
  }

  if (nextType === "email") {
    base.paramMapping = merged.paramMapping
  }

  if (nextType === "rating") {
    base.minRating = merged.minRating || 1
    base.maxRating = merged.maxRating || 5
    base.paramMapping = merged.paramMapping
  }

  if (nextType === "contact-info") {
    base.contactFields = merged.contactFields?.length ? merged.contactFields : ["first_name", "email"]
    base.contactParamMappings = merged.contactParamMappings
    base.contactHideIfPrefilled = merged.contactHideIfPrefilled
    base.contactAlwaysHidden = merged.contactAlwaysHidden
    base.contactHiddenCapture = merged.contactHiddenCapture
  }

  return base
}

function pruneOptionMetadata(metadata: SurveyQuestion["optionMetadata"], options: string[]) {
  if (!metadata) return undefined
  const nextMetadata: NonNullable<SurveyQuestion["optionMetadata"]> = {}
  options.forEach((option) => {
    if (metadata[option]) nextMetadata[option] = metadata[option]
  })
  return Object.keys(nextMetadata).length ? nextMetadata : undefined
}

function formatDate(value: string) {
  if (!value) return "never"
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value))
}
