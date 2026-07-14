import { SurveyReports } from "@/components/surveyflow/survey-reports"

export default async function SurveyReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <SurveyReports surveyId={id} />
}
