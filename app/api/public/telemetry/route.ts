import { NextResponse } from "next/server"
import { createTelemetryEvent, getPublicSurvey } from "@/lib/surveyflow/database"

export async function POST(request: Request) {
  const body = await request.json()
  if (!body.surveyId || !body.type) {
    return NextResponse.json({ error: "surveyId and type are required" }, { status: 400 })
  }

  const surveyResult = await getPublicSurvey(body.surveyId)
  if (surveyResult.error || !surveyResult.data) {
    return NextResponse.json({ error: "Survey not found" }, { status: 404 })
  }

  const result = await createTelemetryEvent({
    workspaceId: surveyResult.data.workspace_id,
    surveyId: body.surveyId,
    questionId: body.questionId,
    type: body.type,
    payload: body.payload || {}
  })

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
  return NextResponse.json({ event: result.data }, { status: 201 })
}
