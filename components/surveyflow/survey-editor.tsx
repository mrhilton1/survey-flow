"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  ExternalLink,
  GripVertical,
  Loader2,
  Palette,
  Plus,
  Save,
  Settings,
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
  }

  function updateQuestion(index: number, updates: Partial<SurveyQuestion>) {
    const nextQuestions = [...questions]
    const existing = nextQuestions[index]
    const nextType = updates.type || existing.type
    const needsOptions = ["multiple-choice", "ranked-order", "this-or-that"].includes(nextType)

    nextQuestions[index] = {
      ...existing,
      ...updates,
      options: needsOptions ? (updates.options || existing.options || ["Option 1", "Option 2"]) : updates.options
    }
    updateSurvey({ questions: nextQuestions })
  }

  function removeQuestion(index: number) {
    updateSurvey({ questions: questions.filter((_, questionIndex) => questionIndex !== index) })
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
    <div className="mx-auto max-w-7xl">
      <div className="mb-5 flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <Link href="/dashboard/surveys" className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:text-brand-900">
            <ArrowLeft className="h-4 w-4" />
            Back to surveys
          </Link>
          <div className="mt-3 flex min-w-0 flex-wrap items-center gap-3">
            <input
              value={survey.name}
              onChange={(event) => updateSurvey({ name: event.target.value })}
              className="min-w-0 rounded-md border border-transparent bg-transparent px-0 text-2xl font-semibold text-slate-950 outline-none focus:border-slate-200 focus:bg-white focus:px-3"
            />
            <StatusSelect value={survey.status} onChange={(status) => updateSurvey({ status })} />
          </div>
          <p className="mt-2 text-sm text-slate-500">
            {savedAt ? `Last saved at ${savedAt}` : `Last updated ${formatDate(survey.updated_at)}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/s/${survey.id}`}
            target="_blank"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 hover:bg-slate-50"
          >
            <ExternalLink className="h-4 w-4" />
            Preview
          </Link>
          <Button onClick={saveSurvey} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
        </div>
      </div>

      {error ? (
        <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mb-5 flex flex-wrap gap-2">
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

      {activeTab === "questions" ? (
        <QuestionsPanel
          questions={questions}
          onAdd={addQuestion}
          onMove={moveQuestion}
          onRemove={removeQuestion}
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
  )
}

function QuestionsPanel({
  questions,
  onAdd,
  onMove,
  onRemove,
  onUpdate
}: {
  questions: SurveyQuestion[]
  onAdd: () => void
  onMove: (index: number, direction: -1 | 1) => void
  onRemove: (index: number) => void
  onUpdate: (index: number, updates: Partial<SurveyQuestion>) => void
}) {
  return (
    <div className="space-y-4">
      {questions.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
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
          canMoveUp={index > 0}
          canMoveDown={index < questions.length - 1}
          onMove={onMove}
          onRemove={onRemove}
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
  )
}

function QuestionCard({
  index,
  question,
  canMoveUp,
  canMoveDown,
  onMove,
  onRemove,
  onUpdate
}: {
  index: number
  question: SurveyQuestion
  canMoveUp: boolean
  canMoveDown: boolean
  onMove: (index: number, direction: -1 | 1) => void
  onRemove: (index: number) => void
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
    <article className="rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Question {index + 1}</div>
          <select
            value={question.type}
            onChange={(event) => onUpdate(index, { type: event.target.value as QuestionType })}
            className="mt-2 h-9 rounded-md border border-slate-200 bg-white px-2 text-sm font-medium text-slate-700"
          >
            {QUESTION_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" disabled={!canMoveUp} onClick={() => onMove(index, -1)}>Up</Button>
          <Button variant="ghost" disabled={!canMoveDown} onClick={() => onMove(index, 1)}>Down</Button>
          <Button variant="danger" onClick={() => onRemove(index)}>
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-4">
          <Field label="Question text">
            <textarea
              value={question.question}
              onChange={(event) => onUpdate(index, { question: event.target.value })}
              className="min-h-20 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-700"
            />
          </Field>

          <Field label="Description">
            <input
              value={question.description || ""}
              onChange={(event) => onUpdate(index, { description: event.target.value })}
              className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-brand-700"
              placeholder="Optional helper text"
            />
          </Field>

          {hasOptions ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">Options</label>
                <Button variant="secondary" onClick={addOption}>
                  <Plus className="h-4 w-4" />
                  Add option
                </Button>
              </div>
              <div className="space-y-2">
                {(question.options || []).map((option, optionIndex) => (
                  <div key={optionIndex} className="flex gap-2">
                    <input
                      value={option}
                      onChange={(event) => updateOption(optionIndex, event.target.value)}
                      className="h-10 flex-1 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-brand-700"
                    />
                    <Button variant="ghost" onClick={() => removeOption(optionIndex)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
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

        <div className="space-y-4 rounded-md bg-slate-50 p-4">
          <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
            Required
            <input
              type="checkbox"
              checked={question.required}
              onChange={(event) => onUpdate(index, { required: event.target.checked })}
              className="h-4 w-4"
            />
          </label>

          <Field label="Category">
            <input
              value={question.category || ""}
              onChange={(event) => onUpdate(index, { category: event.target.value })}
              className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
              placeholder="AI Adoption"
            />
          </Field>

          <Field label="URL parameter mapping">
            <input
              value={question.paramMapping || ""}
              onChange={(event) => onUpdate(index, { paramMapping: event.target.value })}
              className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
              placeholder="utm_source"
            />
          </Field>

          {question.type === "text" ? (
            <Field label="Placeholder">
              <input
                value={question.placeholder || ""}
                onChange={(event) => onUpdate(index, { placeholder: event.target.value })}
                className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
              />
            </Field>
          ) : null}

          {question.type === "multiple-choice" ? (
            <>
              <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
                Allow multiple
                <input
                  type="checkbox"
                  checked={!!question.allowMultiple}
                  onChange={(event) => onUpdate(index, { allowMultiple: event.target.checked })}
                  className="h-4 w-4"
                />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
                Allow other
                <input
                  type="checkbox"
                  checked={!!question.allowOther}
                  onChange={(event) => onUpdate(index, { allowOther: event.target.checked })}
                  className="h-4 w-4"
                />
              </label>
            </>
          ) : null}
        </div>
      </div>
    </article>
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
        <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
          Skip welcome screen
          <input type="checkbox" checked={!!settings.skipIntro} onChange={(event) => onSettingsUpdate({ skipIntro: event.target.checked })} />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
          Prevent multiple submissions
          <input type="checkbox" checked={!!settings.preventMultiple} onChange={(event) => onSettingsUpdate({ preventMultiple: event.target.checked })} />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
          Use Ranksmash formula
          <input type="checkbox" checked={!!settings.useRanksmashFormula} onChange={(event) => onSettingsUpdate({ useRanksmashFormula: event.target.checked })} />
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
        <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
          Show submit another button
          <input
            type="checkbox"
            checked={settings.thankYouShowSubmitAnother !== false}
            onChange={(event) => onSettingsUpdate({ thankYouShowSubmitAnother: event.target.checked })}
          />
        </label>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
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

function TabButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-medium transition-colors",
        active ? "bg-brand-700 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
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
      className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold uppercase tracking-wide text-slate-700"
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
