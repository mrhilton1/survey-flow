import { NextResponse } from "next/server"
import { getPublicSurvey, incrementSurveyCounter } from "@/lib/surveyflow/database"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const url = new URL(request.url)
  const allowPreview = url.searchParams.get("preview") === "true" || url.searchParams.get("test") === "true"
  const result = await getPublicSurvey(id, { allowPreview })
  if (result.error || !result.data) {
    return NextResponse.json({ error: "Survey not found" }, { status: 404 })
  }

  if (!allowPreview) {
    await incrementSurveyCounter({ surveyId: id, counter: "views_count" })
  }
  return NextResponse.json({ survey: result.data })
}
