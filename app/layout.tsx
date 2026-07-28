import type { Metadata, Viewport } from "next"
import { Suspense } from "react"
import "./globals.css"
import { appConfig } from "@/config/app.config"
import { PlatformScriptNavigationRunner } from "@/components/platform/platform-script-navigation-runner"
import { getCurrentSession } from "@/lib/platform/auth"
import { getNavigationScripts, listRenderableScripts, renderPlatformScripts } from "@/lib/platform/scripts"

export const metadata: Metadata = {
  title: appConfig.product.name,
  description: appConfig.product.description,
  manifest: "/manifest.json"
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: appConfig.product.themeColor
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession()
  const [headScripts, bodyStartScripts, bodyEndScripts] = await Promise.all([
    listRenderableScripts({ workspaceId: session.workspace?.id, placement: "head" }).catch(() => []),
    listRenderableScripts({ workspaceId: session.workspace?.id, placement: "body_start" }).catch(() => []),
    listRenderableScripts({ workspaceId: session.workspace?.id, placement: "body_end" }).catch(() => [])
  ])
  const navigationScripts = getNavigationScripts([...headScripts, ...bodyStartScripts, ...bodyEndScripts])

  return (
    <html lang="en">
      <head>{renderPlatformScripts(headScripts)}</head>
      <body>
        {renderPlatformScripts(bodyStartScripts)}
        <Suspense fallback={null}>
          <PlatformScriptNavigationRunner scripts={navigationScripts} />
        </Suspense>
        {children}
        {renderPlatformScripts(bodyEndScripts)}
      </body>
    </html>
  )
}
