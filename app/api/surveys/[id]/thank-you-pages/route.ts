import { NextResponse } from "next/server"
import { canUseFeature } from "@/lib/platform/feature-access"
import { requireSurveyflowSession } from "@/lib/surveyflow/authz"
import { createThankYouPage, getSurveyForWorkspace, listThankYouPages } from "@/lib/surveyflow/database"

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { session, error } = await requireSurveyflowSession("surveys:read")
  if (error) return error

  const survey = await getSurveyForWorkspace({ workspaceId: session.workspace!.id, surveyId: id })
  if (survey.error) return NextResponse.json({ error: "Survey not found" }, { status: 404 })

  const access = await canUseFeature(session, "thank_you_builder")
  const result = await listThankYouPages({ workspaceId: session.workspace!.id, surveyId: id })
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })

  return NextResponse.json({ pages: result.data || [], access })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { session, error } = await requireSurveyflowSession("survey_thank_you_pages:manage")
  if (error) return error

  const access = await canUseFeature(session, "thank_you_builder")
  if (!access.allowed) return NextResponse.json({ error: "Thank you page builder is not enabled for this workspace.", access }, { status: 403 })

  const survey = await getSurveyForWorkspace({ workspaceId: session.workspace!.id, surveyId: id })
  if (survey.error) return NextResponse.json({ error: "Survey not found" }, { status: 404 })

  const body = await request.json()
  const result = await createThankYouPage({
    workspaceId: session.workspace!.id,
    surveyId: id,
    name: body.name,
    content: body.content,
    isDefault: body.isDefault
  })
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })

  return NextResponse.json({ page: result.data }, { status: 201 })
}
