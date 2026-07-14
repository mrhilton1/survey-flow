import { SurveyReports } from "@/components/surveyflow/survey-reports"

export default function SurveyReportsPage({ params }: { params: { id: string } }) {
  return <SurveyReports surveyId={params.id} />
}
