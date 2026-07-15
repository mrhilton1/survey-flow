import Link from "next/link"
import type { ReactNode } from "react"
import {
  BarChart3,
  ClipboardList,
  ExternalLink,
  MessageSquareText,
  Plus,
  Sparkles,
  Zap
} from "lucide-react"
import { getCurrentSession } from "@/lib/platform/auth"

export default async function DashboardPage() {
  const session = await getCurrentSession()

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
            <Sparkles className="h-3.5 w-3.5" />
            SurveyFlow workspace
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Welcome back{session.user?.name ? `, ${session.user.name}` : ""}.
          </h1>
          <p className="mt-3 max-w-2xl text-base text-muted-foreground">
            Build AI-assisted surveys, publish polished public forms, and turn response data into client-ready reports.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard/surveys"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted"
          >
            <ClipboardList className="h-4 w-4" />
            View Surveys
          </Link>
          <Link
            href="/dashboard/surveys"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm shadow-brand-900/20 transition hover:bg-brand-900"
          >
            <Plus className="h-4 w-4" />
            New Survey
          </Link>
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <DashboardCard
          icon={<ClipboardList className="h-5 w-5" />}
          label="Survey builder"
          value="Ready"
          description="Create, edit, test, and publish branded survey experiences."
          href="/dashboard/surveys"
        />
        <DashboardCard
          icon={<MessageSquareText className="h-5 w-5" />}
          label="Responses"
          value="Tracking"
          description="Capture submissions, telemetry, and response metadata."
          href="/dashboard/responses"
        />
        <DashboardCard
          icon={<BarChart3 className="h-5 w-5" />}
          label="AI reports"
          value="Enabled"
          description="Generate analysis and report views from survey outcomes."
          href="/dashboard/ai-reports"
        />
      </div>

      <section className="mt-8 overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="p-6 sm:p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm">
              <Zap className="h-6 w-6" />
            </div>
            <h2 className="mt-5 text-2xl font-bold tracking-tight text-foreground">Your workspace is live.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              The app shell is connected to Supabase auth, platform owner roles, entitlements, feature flags, and Cloudflare deployment. The next high-impact step is expanding the SurveyFlow product views with the richer AI Studio interactions.
            </p>
          </div>
          <div className="border-t border-border bg-muted/40 p-6 sm:p-8 lg:border-l lg:border-t-0">
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Quick paths</div>
            <div className="mt-4 space-y-2">
              {[
                ["Manage surveys", "/dashboard/surveys"],
                ["Review reports", "/dashboard/reports"],
                ["Open platform admin", "/admin"]
              ].map(([label, href]) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center justify-between rounded-xl border border-transparent px-3 py-3 text-sm font-semibold text-foreground transition hover:border-border hover:bg-white"
                >
                  {label}
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function DashboardCard({
  icon,
  label,
  value,
  description,
  href
}: {
  icon: ReactNode
  label: string
  value: string
  description: string
  href: string
}) {
  return (
    <Link href={href} className="group rounded-2xl border border-border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-foreground transition group-hover:bg-brand-50 group-hover:text-brand-700">
          {icon}
        </div>
        <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
      </div>
      <div className="mt-5 text-sm font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold tracking-tight text-foreground">{value}</div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
    </Link>
  )
}
