import Link from "next/link"
import { appConfig } from "@/config/app.config"
import type { Workspace } from "@/lib/platform/types"

/* eslint-disable @next/next/no-img-element */

export function Logo({ workspace }: { workspace?: Workspace | null }) {
  const label = workspace?.logoLabel || appConfig.product.logoLabel
  const themeColor = workspace?.themeColor || appConfig.product.themeColor
  const logoSrc = workspace?.logoSrc || appConfig.product.logoSrc
  const logoMarkSrc = workspace?.logoMarkSrc || appConfig.product.logoMarkSrc

  return (
    <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
      {logoSrc ? (
        <img src={logoSrc} alt={workspace?.name || appConfig.product.name} className="h-10 w-auto max-w-[9rem] flex-shrink-0 object-contain" />
      ) : logoMarkSrc ? (
        <img src={logoMarkSrc} alt={workspace?.name || appConfig.product.name} className="h-10 w-10 flex-shrink-0 rounded-xl object-cover shadow-sm shadow-brand-900/20" />
      ) : (
        <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl text-sm font-bold text-white shadow-sm shadow-brand-900/20" style={{ backgroundColor: themeColor }}>
          {label}
        </span>
      )}
      {!logoSrc ? <span className="truncate text-base font-bold tracking-tight text-foreground">
        {workspace?.name || appConfig.product.name}
      </span> : null}
    </Link>
  )
}
