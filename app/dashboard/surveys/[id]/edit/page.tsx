import { SurveyEditor } from "@/components/surveyflow/survey-editor"

export default async function SurveyEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <SurveyEditor surveyId={id} />
}
