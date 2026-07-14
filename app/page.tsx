import Link from "next/link"
import { appConfig } from "@/config/app.config"

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
        <div className="max-w-3xl">
          <div className="mb-6 inline-flex rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-600">
            Template-ready application shell
          </div>
          <h1 className="text-4xl font-semibold tracking-normal text-slate-950 sm:text-6xl">
            {appConfig.product.name}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            A reusable frame for new apps: auth, workspaces, roles, permissions, navigation, flags, entitlements, Stripe, and platform-admin workflows.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900">
              Create workspace
            </Link>
            <Link href="/login" className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Log in
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
