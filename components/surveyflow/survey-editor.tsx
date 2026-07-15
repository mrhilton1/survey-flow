"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  Eye,
  ExternalLink,
  GripVertical,
  HelpCircle,
  Loader2,
  Palette,
  Plus,
  Save,
  Settings,
  SlidersHorizontal,
  Trash2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { DEFAULT_SURVEY_SETTINGS, DEFAULT_SURVEY_STYLE } from "@/lib/surveyflow/defaults"
import type { QuestionType, SurveyQuestion, SurveySettings, SurveyStatus, SurveyStyle } from "@/lib/surveyflow/types"

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

type EditorTab = "questions" | "design" | "settings"

const QUESTION_TYPES: Array<{ value: QuestionType; label: string }> = [
  { value: "multiple-choice", label: "Multiple Choice" },
  { value: "this-or-that", label: "This or That" },
  { value: "ranked-order", label: "Ranked Order" },
  { value: "text", label: "Text Input" },
  { value: "rating", label: "Rating" },
  { value: "email", label: "Email" },
  { value: "contact-info", label: "Contact Form" }
]

const STATUS_OPTIONS: SurveyStatus[] = ["draft", "testing", "published"]

export function SurveyEditor({ surveyId }: { surveyId: string }) {
  const [survey, setSurvey] = useState<SurveyEditorRow | null>(null)
  const [activeTab, setActiveTab] = useState<EditorTab>("questions")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0)
  const [settingsOpen, setSettingsOpen] = useState(true)

  const questions = survey?.questions || []
  const style = survey?.style || DEFAULT_SURVEY_STYLE
  const settings = survey?.settings || DEFAULT_SURVEY_SETTINGS

  const publicUrl = useMemo(() => {
    if (typeof window === "undefined") return `/s/${surveyId}`
    return `${window.location.origin}/s/${surveyId}`
  }, [surveyId])

  const loadSurvey = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/surveys/${surveyId}`, { cache: "no-store" })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Failed to load survey")
      setSurvey(normalizeSurvey(payload.survey))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load survey")
    } finally {
      setLoading(false)
    }
  }, [surveyId])

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
    const needsOptions = ["multiple-choice", "ranked-order", "this-or-that"].includes(nextType)

    nextQuestions[index] = {
      ...existing,
      ...updates,
      options: needsOptions ? (updates.options || existing.options || ["Option 1", "Option 2"]) : updates.options,
      useInferenceAlgorithm: nextType === "this-or-that"
        ? updates.useInferenceAlgorithm ?? existing.useInferenceAlgorithm ?? true
        : updates.useInferenceAlgorithm
    }
    updateSurvey({ questions: nextQuestions })
  }

  function removeQuestion(index: number) {
    updateSurvey({ questions: questions.filter((_, questionIndex) => questionIndex !== index) })
    setSelectedQuestionIndex((current) => Math.max(0, Math.min(current, questions.length - 2)))
  }

  function moveQuestion(index: number, direction: -1 | 1) {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= questions.length) return

    const nextQuestions = [...questions]
    const [question] = nextQuestions.splice(index, 1)
    nextQuestions.splice(targetIndex, 0, question)
    updateSurvey({ questions: nextQuestions })
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
        <div className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 px-4 py-3 sm:px-6">
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
        <TabButton active={activeTab === "settings"} onClick={() => setActiveTab("settings")}>Settings</TabButton>
      </div>

      <div className="p-4 sm:p-6">
        {activeTab === "questions" ? (
          <QuestionsPanel
            questions={questions}
            selectedIndex={selectedQuestionIndex}
            settingsOpen={settingsOpen}
            onAdd={addQuestion}
            onMove={moveQuestion}
            onRemove={removeQuestion}
            onSelect={setSelectedQuestionIndex}
            onToggleSettings={() => setSettingsOpen((open) => !open)}
            onUpdate={updateQuestion}
          />
        ) : null}

        {activeTab === "design" ? (
          <DesignPanel style={style} onUpdate={updateStyle} />
        ) : null}

        {activeTab === "settings" ? (
          <SettingsPanel
            survey={survey}
            settings={settings}
            publicUrl={publicUrl}
            onSurveyUpdate={updateSurvey}
            onSettingsUpdate={updateSettings}
          />
        ) : null}
      </div>
    </div>
  )
}

function QuestionsPanel({
  questions,
  selectedIndex,
  settingsOpen,
  onAdd,
  onMove,
  onRemove,
  onSelect,
  onToggleSettings,
  onUpdate
}: {
  questions: SurveyQuestion[]
  selectedIndex: number
  settingsOpen: boolean
  onAdd: () => void
  onMove: (index: number, direction: -1 | 1) => void
  onRemove: (index: number) => void
  onSelect: (index: number) => void
  onToggleSettings: () => void
  onUpdate: (index: number, updates: Partial<SurveyQuestion>) => void
}) {
  const selectedQuestion = questions[selectedIndex]

  return (
    <div className={["grid gap-6 items-start", settingsOpen && selectedQuestion ? "lg:grid-cols-[minmax(0,1fr)_24rem]" : "lg:grid-cols-1"].join(" ")}>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Form Questions</h2>
            <p className="mt-1 text-sm text-muted-foreground">Select any question card below to customize its questions, scoring, logic or properties.</p>
          </div>
          <Button variant="secondary" onClick={onToggleSettings}>
            <SlidersHorizontal className="h-4 w-4" />
            {settingsOpen ? "Close Settings Panel" : "Open Settings Panel"}
          </Button>
        </div>

        {questions.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-border bg-white px-6 py-16 text-center">
            <h2 className="text-lg font-semibold text-slate-950">Add your first question</h2>
            <p className="mt-2 text-sm text-slate-500">Multiple choice, ranked order, this-or-that, text, rating, email, and contact forms are supported.</p>
            <Button className="mt-5" onClick={onAdd}>
              <Plus className="h-4 w-4" />
              Add Question
            </Button>
          </div>
        ) : null}

        {questions.map((question, index) => (
          <QuestionCard
            key={question.id}
            index={index}
            question={question}
            selected={index === selectedIndex}
            canMoveUp={index > 0}
            canMoveDown={index < questions.length - 1}
            onMove={onMove}
            onRemove={onRemove}
            onSelect={onSelect}
            onToggleSettings={onToggleSettings}
            onUpdate={onUpdate}
          />
        ))}

        {questions.length > 0 ? (
          <Button variant="secondary" className="w-full border-dashed" onClick={onAdd}>
            <Plus className="h-4 w-4" />
            Add Question
          </Button>
        ) : null}
      </div>

      {settingsOpen && selectedQuestion ? (
        <QuestionSettingsPanel question={selectedQuestion} index={selectedIndex} onUpdate={onUpdate} />
      ) : null}
    </div>
  )
}

function QuestionCard({
  index,
  question,
  selected,
  canMoveUp,
  canMoveDown,
  onMove,
  onRemove,
  onSelect,
  onToggleSettings,
  onUpdate
}: {
  index: number
  question: SurveyQuestion
  selected: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  onMove: (index: number, direction: -1 | 1) => void
  onRemove: (index: number) => void
  onSelect: (index: number) => void
  onToggleSettings: () => void
  onUpdate: (index: number, updates: Partial<SurveyQuestion>) => void
}) {
  const hasOptions = ["multiple-choice", "ranked-order", "this-or-that"].includes(question.type)

  function updateOption(optionIndex: number, value: string) {
    const nextOptions = [...(question.options || [])]
    nextOptions[optionIndex] = value
    onUpdate(index, { options: nextOptions })
  }

  function addOption() {
    onUpdate(index, { options: [...(question.options || []), `Option ${(question.options || []).length + 1}`] })
  }

  function removeOption(optionIndex: number) {
    onUpdate(index, { options: (question.options || []).filter((_, indexToCheck) => indexToCheck !== optionIndex) })
  }

  return (
    <article
      className={[
        "rounded-2xl border bg-white shadow-sm transition cursor-pointer",
        selected ? "border-slate-950 ring-2 ring-slate-950/10" : "border-border hover:border-slate-400"
      ].join(" ")}
      onClick={() => onSelect(index)}
    >
      <div className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="text-sm font-bold text-muted-foreground">Question {index + 1}</div>
          {selected ? <span className="h-2.5 w-2.5 rounded-full bg-slate-950" /> : null}
        </div>
        <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
          <select
            value={question.type}
            onChange={(event) => onUpdate(index, { type: event.target.value as QuestionType })}
            className="h-10 rounded-xl border border-border bg-white px-3 text-sm font-semibold text-slate-950 shadow-sm"
          >
            {QUESTION_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          <Button variant={selected ? "primary" : "ghost"} className="h-10 w-10 px-0" onClick={onToggleSettings} aria-label="Advanced settings">
            <SlidersHorizontal className="h-5 w-5" />
          </Button>
          <Button variant="ghost" className="h-10 w-10 px-0 text-muted-foreground hover:text-red-600" onClick={() => onRemove(index)} aria-label="Delete question">
            <Trash2 className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="space-y-5 p-5 pt-0" onClick={(event) => event.stopPropagation()}>
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

        {hasOptions ? (
          <div className="space-y-3">
            <div>
              <h3 className="text-base font-bold text-foreground">
                {question.type === "this-or-that" ? "Items to Compare (Pairwise)" : "Options"}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {question.type === "this-or-that"
                  ? "Specify the list of items. Unique pairs will be generated automatically for the respondent to choose between."
                  : "Add answer choices for this question."}
              </p>
            </div>
              <div className="space-y-2">
                {(question.options || []).map((option, optionIndex) => (
                  <div key={optionIndex} className="flex items-center gap-3">
                    <input
                      value={option}
                      onChange={(event) => updateOption(optionIndex, event.target.value)}
                      className="h-11 flex-1 rounded-xl border border-border px-4 text-base outline-none focus:border-slate-950"
                    />
                    <Button variant="ghost" className="h-10 w-10 px-0" onClick={() => removeOption(optionIndex)} aria-label="Remove option">
                      ✕
                    </Button>
                  </div>
                ))}
              </div>
            <Button variant="secondary" onClick={addOption}>
              <Plus className="h-4 w-4" />
              {question.type === "this-or-that" ? "Add Item to Compare" : "Add option"}
            </Button>
          </div>
        ) : null}

        {question.type === "rating" ? (
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
          ) : null}
      </div>
    </article>
  )
}

function QuestionSettingsPanel({
  question,
  index,
  onUpdate
}: {
  question: SurveyQuestion
  index: number
  onUpdate: (index: number, updates: Partial<SurveyQuestion>) => void
}) {
  return (
    <aside className="sticky top-36 rounded-2xl border border-border bg-white shadow-sm">
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
        <Field label={<span className="inline-flex items-center gap-2">URL Parameter <HelpCircle className="h-4 w-4 text-muted-foreground" /></span>}>
          <input
            value={question.paramMapping || ""}
            onChange={(event) => onUpdate(index, { paramMapping: event.target.value })}
            className="h-11 w-full rounded-xl border border-border bg-white px-4 text-sm outline-none focus:border-slate-950"
            placeholder="e.g. email, company, utm_source"
          />
        </Field>
        <div className="rounded-xl border border-border bg-white p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-foreground">
            <SlidersHorizontal className="h-4 w-4" />
            Option Sourcing Engine
          </div>
          <select className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm">
            <option>Static List (Defined on Left)</option>
            <option>Previous Question Answers</option>
            <option>URL Parameter</option>
          </select>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">Dynamically seed choices/ranking pool from options picked or text entered in preceding questions.</p>
        </div>
        {question.type === "this-or-that" ? (
          <label className="flex items-center justify-between gap-4 rounded-xl border border-border bg-white p-4 text-sm font-semibold text-foreground">
            <span className="min-w-0 flex-1">
              Use Inference Algorithm
              <span className="mt-1 block text-xs font-normal leading-5 text-muted-foreground">
                Infer skipped pair outcomes from prior choices to reduce repeated comparisons.
              </span>
            </span>
            <ToggleSwitch checked={question.useInferenceAlgorithm !== false} onChange={(checked) => onUpdate(index, { useInferenceAlgorithm: checked })} />
          </label>
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

function SettingsPanel({
  survey,
  settings,
  publicUrl,
  onSurveyUpdate,
  onSettingsUpdate
}: {
  survey: SurveyEditorRow
  settings: SurveySettings
  publicUrl: string
  onSurveyUpdate: (updates: Partial<SurveyEditorRow>) => void
  onSettingsUpdate: (updates: Partial<SurveySettings>) => void
}) {
  const tracking = settings.tracking || {}
  const highlightedQuestion = survey.questions?.find((question) => question.id === settings.thankYouHighlightedQuestionId)
  const highlightedOptions = highlightedQuestion?.options || []

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
        <h2 className="font-semibold text-slate-950">Thank you page</h2>
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
            <span className="mt-1 block text-xs font-normal text-slate-500">Display ranked results and optional answer links on the thank-you page.</span>
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
              <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Answer resource links</div>
                {highlightedOptions.length ? highlightedOptions.map((option) => {
                  const optionKey = `${highlightedQuestion.id}_${option}`
                  const optionLink = settings.thankYouOptionLinks?.[optionKey] || { label: "", url: "" }
                  return (
                    <div key={option} className="space-y-2 rounded-md border border-slate-200 bg-white p-3">
                      <div className="truncate text-xs font-semibold text-slate-700" title={option}>{option}</div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <input
                          value={optionLink.label || ""}
                          onChange={(event) => onSettingsUpdate({
                            thankYouOptionLinks: {
                              ...(settings.thankYouOptionLinks || {}),
                              [optionKey]: { label: event.target.value, url: optionLink.url || "" }
                            }
                          })}
                          className="h-9 rounded-md border border-slate-200 px-3 text-xs"
                          placeholder="Link label"
                        />
                        <input
                          value={optionLink.url || ""}
                          onChange={(event) => onSettingsUpdate({
                            thankYouOptionLinks: {
                              ...(settings.thankYouOptionLinks || {}),
                              [optionKey]: { label: optionLink.label || "", url: event.target.value }
                            }
                          })}
                          className="h-9 rounded-md border border-slate-200 px-3 text-xs"
                          placeholder="https://example.com/resource"
                        />
                      </div>
                    </div>
                  )
                }) : (
                  <p className="text-xs text-amber-700">This question has no options yet.</p>
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
          <input
            value={(settings.urlParams || []).join(", ")}
            onChange={(event) => onSettingsUpdate({ urlParams: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })}
            className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
            placeholder="utm_source, utm_medium, ref"
          />
        </Field>
      </section>
    </div>
  )
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
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
        "relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-slate-950" : "bg-slate-300"
      ].join(" ")}
    >
      <span
        className={[
          "inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-5" : "translate-x-1"
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

function formatDate(value: string) {
  if (!value) return "never"
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value))
}
