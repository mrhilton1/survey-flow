import { NextResponse } from "next/server"
import { requirePlatformQaSession } from "@/lib/surveyflow/authz"
import { getSurveyForWorkspace, listThankYouPages } from "@/lib/surveyflow/database"
import { evaluateThankYouRouter } from "@/lib/surveyflow/thank-you-router"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { session, error } = await requirePlatformQaSession()
  if (error) return error

  const body = await request.json().catch(() => ({}))
  const workspaceId = typeof body.workspaceId === "string" && session.isPlatformAdmin
    ? body.workspaceId
    : session.workspace!.id

  const survey = await getSurveyForWorkspace({ workspaceId, surveyId: id })
  if (survey.error || !survey.data) {
    return NextResponse.json({ error: "Survey not found" }, { status: 404 })
  }

  const pages = await listThankYouPages({ workspaceId, surveyId: id })
  if (pages.error) {
    return NextResponse.json({ error: pages.error.message }, { status: 500 })
  }

  const thankYouPages = pages.data || []
  const result = evaluateThankYouRouter({
    survey: {
      ...survey.data,
      thank_you_pages: thankYouPages,
      thank_you_page: thankYouPages.find((page) => page.is_default) || null
    },
    answers: isRecord(body.answers) ? body.answers : {},
    urlParams: normalizeStringRecord(body.urlParams)
  })

  return NextResponse.json({
    survey: {
      id: survey.data.id,
      name: survey.data.name,
      workspaceId
    },
    evaluation: result
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function normalizeStringRecord(value: unknown) {
  if (!isRecord(value)) return {}
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, String(entry ?? "")]))
}
