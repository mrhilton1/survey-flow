"use client"

import { useEffect, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"

interface NavigationScript {
  id: string
  content: string
}

export function PlatformScriptNavigationRunner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const mounted = useRef(false)

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }

    const controller = new AbortController()
    async function runNavigationScripts() {
      const response = await fetch("/api/platform/scripts/navigation", {
        cache: "no-store",
        signal: controller.signal
      })
      if (!response.ok) return
      const payload = await response.json().catch(() => ({ scripts: [] as NavigationScript[] }))
      for (const script of payload.scripts || []) {
        try {
          new Function(script.content)()
        } catch (error) {
          console.error(`Platform script ${script.id} failed on navigation`, error)
        }
      }
    }
    runNavigationScripts().catch((error) => {
      if (!controller.signal.aborted) console.error("Platform navigation scripts failed", error)
    })
    return () => controller.abort()
  }, [pathname, searchParams])

  return null
}
