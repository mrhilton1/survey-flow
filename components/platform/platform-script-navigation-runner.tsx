"use client"

import { useEffect, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"

interface NavigationScript {
  id: string
  content: string
}

export function PlatformScriptNavigationRunner({ scripts }: { scripts: NavigationScript[] }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const mounted = useRef(false)

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }

    for (const script of scripts) {
      try {
        new Function(script.content)()
      } catch (error) {
        console.error(`Platform script ${script.id} failed on navigation`, error)
      }
    }
  }, [pathname, searchParams, scripts])

  return null
}
