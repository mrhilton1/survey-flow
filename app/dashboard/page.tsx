import { getCurrentSession } from "@/lib/platform/auth"

export default async function DashboardPage() {
  const session = await getCurrentSession()

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-semibold text-slate-950">Dashboard</h1>
      <p className="mt-2 text-slate-600">Welcome back{session.user?.name ? `, ${session.user.name}` : ""}.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {["App module", "Entitlements", "Usage"].map((label) => (
          <div key={label} className="rounded-md border border-slate-200 bg-white p-5">
            <div className="text-sm text-slate-500">{label}</div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">Ready</div>
          </div>
        ))}
      </div>
    </div>
  )
}
