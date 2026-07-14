import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { appConfig } from "@/config/app.config"

export async function POST() {
  cookies().delete(appConfig.auth.sessionCookieName)
  return NextResponse.json({ ok: true })
}
