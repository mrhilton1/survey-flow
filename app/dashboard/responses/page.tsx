import Link from "next/link"
import { MessageSquareText } from "lucide-react"
import { getCurrentSession } from "@/lib/platform/auth"
import { listSurveys } from "@/lib/surveyflow/database"

export default async function ResponsesPage() {
  const session = await getCurrentSession()
  const surveys = session.workspace ? await listSurveys(session.workspace.id) : { data: [] }
  const rows = surveys.data || []

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-semibold text-slate-950">Responses</h1>
      <p className="mt-2 text-sm text-slate-600">
        Jump into survey-level reports to inspect response detail, scoring, telemetry, and webhook history.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((survey) => (
          <Link
            key={survey.id}
            href={`/dashboard/surveys/${survey.id}/reports`}
            className="rounded-md border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-200 hover:bg-brand-50"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-slate-950">{survey.name}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-slate-500">{survey.description || "No description yet."}</p>
              </div>
              <div className="grid h-9 w-9 place-items-center rounded-md bg-slate-100 text-slate-600">
                <MessageSquareText className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2 text-sm">
              <Metric label="Responses" value={Number(survey.responses_count || 0)} />
              <Metric label="Views" value={Number(survey.views_count || 0)} />
            </div>
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="mt-8 rounded-md border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <h2 className="text-sm font-semibold text-slate-950">No surveys yet</h2>
          <p className="mt-1 text-sm text-slate-500">Create a survey before response analytics are available.</p>
          <Link href="/dashboard/surveys" className="mt-4 inline-flex rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white">
            Open surveys
          </Link>
        </div>
      ) : null}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-white px-3 py-2">
      <div className="text-lg font-semibold text-slate-950">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  )
}
