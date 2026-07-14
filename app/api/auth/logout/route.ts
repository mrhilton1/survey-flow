import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { appConfig } from "@/config/app.config"

export async function POST() {
  const cookieStore = await cookies()
  cookieStore.delete(appConfig.auth.sessionCookieName)
  return NextResponse.json({ ok: true })
}
