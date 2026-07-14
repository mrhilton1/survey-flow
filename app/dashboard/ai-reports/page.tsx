import Link from "next/link"
import { Sparkles } from "lucide-react"
import { getCurrentSession } from "@/lib/platform/auth"
import { listSurveys } from "@/lib/surveyflow/database"

export default async function AiReportsPage() {
  const session = await getCurrentSession()
  const surveys = session.workspace ? await listSurveys(session.workspace.id) : { data: [] }
  const rows = surveys.data || []

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-semibold text-slate-950">AI Reports</h1>
      <p className="mt-2 text-sm text-slate-600">
        Choose a survey with responses, then generate a Gemini-backed summary from its report workspace.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((survey) => {
          const responseCount = Number(survey.responses_count || 0)
          return (
            <Link
              key={survey.id}
              href={`/dashboard/surveys/${survey.id}/reports`}
              className="rounded-md border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-200 hover:bg-brand-50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-slate-950">{survey.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {responseCount > 0 ? `${responseCount} live responses ready` : "Waiting for live responses"}
                  </p>
                </div>
                <div className="grid h-9 w-9 place-items-center rounded-md bg-brand-50 text-brand-700">
                  <Sparkles className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-5 rounded-md bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
                {responseCount > 0 ? "Open reports to generate" : "Collect responses first"}
              </div>
            </Link>
          )
        })}
      </div>

      {rows.length === 0 ? (
        <div className="mt-8 rounded-md border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <h2 className="text-sm font-semibold text-slate-950">No surveys yet</h2>
          <p className="mt-1 text-sm text-slate-500">AI reports are generated from completed survey responses.</p>
          <Link href="/dashboard/surveys" className="mt-4 inline-flex rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white">
            Open surveys
          </Link>
        </div>
      ) : null}
    </div>
  )
}
