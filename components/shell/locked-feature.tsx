import Link from "next/link"
import { Lock } from "lucide-react"

export function LockedFeature({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-6">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-md bg-slate-100 text-slate-500">
          <Lock className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-semibold text-slate-950">{label} is locked</h2>
          <p className="mt-1 text-sm text-slate-500">Upgrade the workspace plan or add an entitlement override.</p>
        </div>
      </div>
      <Link href="/dashboard/billing" className="mt-5 inline-flex rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900">
        View billing
      </Link>
    </div>
  )
}
