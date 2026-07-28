import Link from "next/link"
import { appConfig } from "@/config/app.config"
import type { Workspace } from "@/lib/platform/types"

export function Logo({ workspace }: { workspace?: Workspace | null }) {
  const label = workspace?.logoLabel || appConfig.product.logoLabel
  const themeColor = workspace?.themeColor || appConfig.product.themeColor

  return (
    <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
      <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl text-sm font-bold text-white shadow-sm shadow-brand-900/20" style={{ backgroundColor: themeColor }}>
        {label}
      </span>
      <span className="truncate text-base font-bold tracking-tight text-foreground">
        {appConfig.product.name}
      </span>
    </Link>
  )
}
