import Link from "next/link"
import { appConfig } from "@/config/app.config"

export default function SignupPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
      <form action="/api/auth/signup" method="post" className="w-full max-w-sm rounded-md border border-slate-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-slate-950">Create {appConfig.product.name} workspace</h1>
        <label className="mt-6 block text-sm font-medium text-slate-700">
          Workspace name
          <input name="workspaceName" required className="mt-2 h-10 w-full rounded-md border border-slate-200 px-3" />
        </label>
        <label className="mt-4 block text-sm font-medium text-slate-700">
          Email
          <input name="email" type="email" required className="mt-2 h-10 w-full rounded-md border border-slate-200 px-3" />
        </label>
        <button className="mt-5 h-10 w-full rounded-md bg-brand-700 text-sm font-medium text-white hover:bg-brand-900">
          Create workspace
        </button>
        <p className="mt-4 text-sm text-slate-500">
          Already have one? <Link className="text-brand-700" href="/login">Log in</Link>
        </p>
      </form>
    </main>
  )
}
