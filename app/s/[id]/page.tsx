import { PublicSurvey } from "@/components/surveyflow/public-survey"

export default async function PublicSurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <PublicSurvey surveyId={id} />
}
