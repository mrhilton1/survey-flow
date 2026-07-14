export default function ApiDocsPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold text-slate-950">API Docs</h1>
      <p className="mt-2 text-sm text-slate-600">
        Server routes are organized around authenticated workspace APIs and public survey collection APIs.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <ApiGroup
          title="Workspace surveys"
          routes={[
            "GET /api/surveys",
            "POST /api/surveys",
            "GET /api/surveys/[id]",
            "PATCH /api/surveys/[id]",
            "DELETE /api/surveys/[id]"
          ]}
        />
        <ApiGroup
          title="Responses and reports"
          routes={[
            "GET /api/surveys/[id]/responses",
            "DELETE /api/surveys/[id]/responses/[responseId]",
            "POST /api/surveys/[id]/ai-report",
            "GET /api/surveys/[id]/telemetry",
            "GET /api/surveys/[id]/webhooks"
          ]}
        />
        <ApiGroup
          title="Public survey"
          routes={[
            "GET /api/public/surveys/[id]",
            "POST /api/public/surveys/[id]/responses",
            "POST /api/public/telemetry"
          ]}
        />
        <ApiGroup
          title="Platform"
          routes={[
            "GET /api/auth/session",
            "POST /api/auth/login",
            "POST /api/auth/logout",
            "POST /api/platform/billing/checkout",
            "POST /api/platform/billing/portal"
          ]}
        />
      </div>
    </div>
  )
}

function ApiGroup({ title, routes }: { title: string; routes: string[] }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5">
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      <div className="mt-4 space-y-2">
        {routes.map((route) => (
          <code key={route} className="block rounded-md bg-slate-950 px-3 py-2 text-xs text-slate-100">
            {route}
          </code>
        ))}
      </div>
    </section>
  )
}
