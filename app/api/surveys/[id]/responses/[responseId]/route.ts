import { NextResponse } from "next/server"
import { requireSurveyflowSession } from "@/lib/surveyflow/authz"
import { deleteResponse } from "@/lib/surveyflow/database"

export async function DELETE(_: Request, { params }: { params: { id: string; responseId: string } }) {
  const { session, error } = await requireSurveyflowSession("responses:delete")
  if (error) return error

  const result = await deleteResponse({
    workspaceId: session.workspace!.id,
    surveyId: params.id,
    responseId: params.responseId
  })
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
