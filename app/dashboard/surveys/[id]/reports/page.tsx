import Link from "next/link"

export default function SurveyReportsPlaceholder({ params }: { params: { id: string } }) {
  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/dashboard/surveys" className="text-sm font-medium text-brand-700 hover:text-brand-900">
        Back to surveys
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-slate-950">Survey reports</h1>
      <p className="mt-2 text-slate-600">
        Report view port target for survey <span className="font-mono text-slate-950">{params.id}</span>.
      </p>
    </div>
  )
}
