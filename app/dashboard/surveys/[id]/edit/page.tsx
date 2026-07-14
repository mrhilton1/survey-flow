import { SurveyEditor } from "@/components/surveyflow/survey-editor"

export default function SurveyEditorPlaceholder({ params }: { params: { id: string } }) {
  return <SurveyEditor surveyId={params.id} />
}
