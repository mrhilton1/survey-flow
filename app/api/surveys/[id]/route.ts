import { NextResponse } from "next/server"
import { requireSurveyflowSession } from "@/lib/surveyflow/authz"
import { deleteSurvey, getSurveyForWorkspace, updateSurvey } from "@/lib/surveyflow/database"

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireSurveyflowSession("surveys:read")
  if (error) return error

  const result = await getSurveyForWorkspace({ workspaceId: session.workspace!.id, surveyId: params.id })
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 404 })
  return NextResponse.json({ survey: result.data })
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireSurveyflowSession("surveys:update")
  if (error) return error

  const updates = await request.json()
  const result = await updateSurvey({ workspaceId: session.workspace!.id, surveyId: params.id, updates })
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
  return NextResponse.json({ survey: result.data })
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireSurveyflowSession("surveys:delete")
  if (error) return error

  const result = await deleteSurvey({ workspaceId: session.workspace!.id, surveyId: params.id })
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
