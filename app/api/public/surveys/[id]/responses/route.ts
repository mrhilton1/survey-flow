import { NextResponse } from "next/server"
import { getPublicSurvey, getResponseForSurvey, incrementSurveyCounter, writePublicResponse } from "@/lib/surveyflow/database"
import { deliverSurveyWebhook } from "@/lib/surveyflow/webhooks"
import type { SurveySettings, SurveyWebhookPayload } from "@/lib/surveyflow/types"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const surveyResult = await getPublicSurvey(id)
  if (surveyResult.error || !surveyResult.data) {
    return NextResponse.json({ error: "Survey not found" }, { status: 404 })
  }

  const body = await request.json()
  const requestedStatus = body.status || "partial"
  const existingResponse = body.responseId
    ? await getResponseForSurvey({ surveyId: id, responseId: body.responseId })
    : null

  if (existingResponse?.error && existingResponse.error.code !== "PGRST116") {
    return NextResponse.json({ error: existingResponse.error.message }, { status: 500 })
  }

  const result = await writePublicResponse({
    workspaceId: surveyResult.data.workspace_id,
    surveyId: id,
    responseId: body.responseId,
    answers: body.answers || {},
    scores: body.scores,
    totalScore: body.totalScore,
    status: requestedStatus,
    isTest: body.isTest,
    metadata: body.metadata || {}
  })

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
  const completedTransition = requestedStatus === "completed" && existingResponse?.data?.status !== "completed"
  if (completedTransition) {
    if (!body.isTest) {
      await incrementSurveyCounter({ surveyId: id, counter: "responses_count" })
    }
    const settings = (surveyResult.data.settings || {}) as SurveySettings
    const payload: SurveyWebhookPayload = {
      event: body.isTest ? "survey.test" : "survey.response.completed",
      test: Boolean(body.isTest),
      surveyId: id,
      surveyName: surveyResult.data.name,
      responseId: result.data?.id,
      answers: body.answers || {},
      scores: body.scores,
      totalScore: body.totalScore,
      metadata: body.metadata || {},
      submittedAt: result.data?.submitted_at || new Date().toISOString()
    }

    await deliverSurveyWebhook({
      workspaceId: surveyResult.data.workspace_id,
      surveyId: id,
      surveyName: surveyResult.data.name,
      responseId: result.data?.id,
      settings,
      payload
    })
  }

  return NextResponse.json({ response: result.data }, { status: body.responseId ? 200 : 201 })
}
