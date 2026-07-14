import Link from "next/link"
import { appConfig } from "@/config/app.config"

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams
  const error = params?.error

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
      <form action="/api/auth/login" method="post" className="w-full max-w-sm rounded-md border border-slate-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-slate-950">Log in to {appConfig.product.name}</h1>
        {error ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}
        <label className="mt-6 block text-sm font-medium text-slate-700">
          Email
          <input name="email" type="email" required className="mt-2 h-10 w-full rounded-md border border-slate-200 px-3" />
        </label>
        <label className="mt-4 block text-sm font-medium text-slate-700">
          Password
          <input name="password" type="password" required className="mt-2 h-10 w-full rounded-md border border-slate-200 px-3" />
        </label>
        <button className="mt-5 h-10 w-full rounded-md bg-brand-700 text-sm font-medium text-white hover:bg-brand-900">
          Log in
        </button>
        <p className="mt-4 text-sm text-slate-500">
          Need a workspace? <Link className="text-brand-700" href="/signup">Sign up</Link>
        </p>
      </form>
    </main>
  )
}
