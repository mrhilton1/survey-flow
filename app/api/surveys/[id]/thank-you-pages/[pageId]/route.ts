import { NextResponse } from "next/server"
import { canUseFeature } from "@/lib/platform/feature-access"
import { requireSurveyflowSession } from "@/lib/surveyflow/authz"
import { deleteThankYouPage, getSurveyForWorkspace, updateThankYouPage } from "@/lib/surveyflow/database"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; pageId: string }> }) {
  const { id, pageId } = await params
  const { session, error } = await requireSurveyflowSession("survey_thank_you_pages:manage")
  if (error) return error

  const access = await canUseFeature(session, "thank_you_builder")
  if (!access.allowed) return NextResponse.json({ error: "Thank you page builder is not enabled for this workspace.", access }, { status: 403 })

  const survey = await getSurveyForWorkspace({ workspaceId: session.workspace!.id, surveyId: id })
  if (survey.error) return NextResponse.json({ error: "Survey not found" }, { status: 404 })

  const body = await request.json()
  const result = await updateThankYouPage({
    workspaceId: session.workspace!.id,
    surveyId: id,
    pageId,
    updates: {
      name: body.name,
      status: body.status,
      is_default: body.is_default,
      content: body.content
    }
  })
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })

  return NextResponse.json({ page: result.data })
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string; pageId: string }> }) {
  const { id, pageId } = await params
  const { session, error } = await requireSurveyflowSession("survey_thank_you_pages:manage")
  if (error) return error

  const access = await canUseFeature(session, "thank_you_builder")
  if (!access.allowed) return NextResponse.json({ error: "Thank you page builder is not enabled for this workspace.", access }, { status: 403 })

  const result = await deleteThankYouPage({ workspaceId: session.workspace!.id, surveyId: id, pageId })
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
