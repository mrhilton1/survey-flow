export default function PublicSurveyPage({ params }: { params: { id: string } }) {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm uppercase tracking-wide text-orange-300">Public Survey</p>
        <h1 className="mt-3 text-3xl font-semibold">SurveyFlow survey route</h1>
        <p className="mt-4 text-slate-300">
          Survey ID: <span className="font-mono text-white">{params.id}</span>
        </p>
        <p className="mt-4 text-slate-400">
          The SurveyFlow public survey UI will be ported here. Public data access should go through
          `/api/public/surveys/[id]` and `/api/public/surveys/[id]/responses`.
        </p>
      </div>
    </main>
  )
}
