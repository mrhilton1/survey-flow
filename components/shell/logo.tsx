import Link from "next/link"
import { appConfig } from "@/config/app.config"

export function Logo() {
  return (
    <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
      <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-md bg-brand-700 text-sm font-semibold text-white">
        {appConfig.product.logoLabel}
      </span>
      <span className="truncate text-base font-semibold text-slate-950">
        {appConfig.product.name}
      </span>
    </Link>
  )
}
