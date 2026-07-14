import { PublicSurvey } from "@/components/surveyflow/public-survey"

export default function PublicSurveyPage({ params }: { params: { id: string } }) {
  return <PublicSurvey surveyId={params.id} />
}
