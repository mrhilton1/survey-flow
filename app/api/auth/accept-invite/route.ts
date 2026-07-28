import { NextResponse } from "next/server"
import { appConfig } from "@/config/app.config"
import { acceptTeamInvite } from "@/lib/platform/team-invites"

export async function POST(request: Request) {
  const form = await request.formData()
  const result = await acceptTeamInvite({
    token: String(form.get("token") || ""),
    password: String(form.get("password") || ""),
    displayName: String(form.get("displayName") || "")
  })

  if (result.error || !result.userId) {
    const errorUrl = new URL(`/invite/${String(form.get("token") || "")}`, request.url)
    errorUrl.searchParams.set("error", result.error || "Unable to accept invite.")
    return NextResponse.redirect(errorUrl, { status: 303 })
  }

  const response = NextResponse.redirect(new URL(appConfig.auth.afterLoginPath, request.url), { status: 303 })
  response.cookies.set(appConfig.auth.sessionCookieName, result.userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/"
  })
  return response
}

