import { NextResponse } from "next/server"
import { requireSurveyflowSession } from "@/lib/surveyflow/authz"
import { listResponses } from "@/lib/surveyflow/database"

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { session, error } = await requireSurveyflowSession("responses:read")
  if (error) return error

  const result = await listResponses({ workspaceId: session.workspace!.id, surveyId: id })
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
  return NextResponse.json({ responses: result.data || [] })
}
