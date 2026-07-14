import { NextResponse } from "next/server"
import { requireSurveyflowSession } from "@/lib/surveyflow/authz"
import { deleteResponse } from "@/lib/surveyflow/database"

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string; responseId: string }> }) {
  const { id, responseId } = await params
  const { session, error } = await requireSurveyflowSession("responses:delete")
  if (error) return error

  const result = await deleteResponse({
    workspaceId: session.workspace!.id,
    surveyId: id,
    responseId
  })
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
