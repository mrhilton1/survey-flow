import { NextResponse } from "next/server"
import { requireSurveyflowSession } from "@/lib/surveyflow/authz"
import { generateSurveyAiReport } from "@/lib/surveyflow/ai-report"
import { getSurveyForWorkspace, listResponses } from "@/lib/surveyflow/database"

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireSurveyflowSession("reports:generate")
  if (error) return error

  const surveyResult = await getSurveyForWorkspace({ workspaceId: session.workspace!.id, surveyId: params.id })
  if (surveyResult.error || !surveyResult.data) {
    return NextResponse.json({ error: "Survey not found" }, { status: 404 })
  }

  const responsesResult = await listResponses({ workspaceId: session.workspace!.id, surveyId: params.id })
  if (responsesResult.error) {
    return NextResponse.json({ error: responsesResult.error.message }, { status: 500 })
  }

  const report = await generateSurveyAiReport({
    surveyName: surveyResult.data.name,
    surveyDescription: surveyResult.data.description,
    responses: (responsesResult.data || []).map((response) => ({
      answers: response.answers,
      totalScore: response.total_score
    }))
  })

  return NextResponse.json({ report })
}
