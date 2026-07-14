import { NextResponse } from "next/server"
import { requireSurveyflowSession } from "@/lib/surveyflow/authz"
import { listResponses } from "@/lib/surveyflow/database"

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireSurveyflowSession("responses:read")
  if (error) return error

  const result = await listResponses({ workspaceId: session.workspace!.id, surveyId: params.id })
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
  return NextResponse.json({ responses: result.data || [] })
}
