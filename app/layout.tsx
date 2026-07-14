import type { Metadata, Viewport } from "next"
import "./globals.css"
import { appConfig } from "@/config/app.config"

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
