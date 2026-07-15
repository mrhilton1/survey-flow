import Link from "next/link"
import { appConfig } from "@/config/app.config"

export function Logo() {
  return (
    <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
      <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-600 to-slate-950 text-sm font-bold text-white shadow-sm shadow-brand-900/20">
        {appConfig.product.logoLabel}
      </span>
      <span className="truncate text-base font-bold tracking-tight text-foreground">
        {appConfig.product.name}
      </span>
    </Link>
  )
}
