import { NextResponse } from "next/server"
import { getPublicSurvey, incrementSurveyCounter } from "@/lib/surveyflow/database"

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await getPublicSurvey(id)
  if (result.error || !result.data) {
    return NextResponse.json({ error: "Survey not found" }, { status: 404 })
  }

  await incrementSurveyCounter({ surveyId: id, counter: "views_count" })
  return NextResponse.json({ survey: result.data })
}
