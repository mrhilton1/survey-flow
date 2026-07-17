import { NextResponse } from "next/server"
import { getPublicSurvey, getSelectedThankYouPage, incrementSurveyCounter } from "@/lib/surveyflow/database"
import type { SurveySettings } from "@/lib/surveyflow/types"

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
  const settings = (result.data.settings || {}) as SurveySettings
  const thankYouPage = settings.thankYouPageId
    ? await getSelectedThankYouPage({ surveyId: id, pageId: settings.thankYouPageId })
    : await getSelectedThankYouPage({ surveyId: id })

  return NextResponse.json({
    survey: {
      ...result.data,
      thank_you_page: thankYouPage.data || null
    }
  })
}
