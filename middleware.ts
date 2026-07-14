import { NextResponse, type NextRequest } from "next/server"
import { runtimeConfig } from "@/config/runtime.config"

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublic = runtimeConfig.publicPaths.some((publicPath) => {
    return publicPath === "/" ? pathname === "/" : pathname.startsWith(publicPath)
  })
  const hasSession = Boolean(request.cookies.get(runtimeConfig.sessionCookieName)?.value)

  if (!isPublic && !hasSession) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = request.nextUrl.clone()
    url.pathname = runtimeConfig.loginPath
    url.searchParams.set("redirect", pathname)
    return NextResponse.redirect(url)
  }

  if (pathname === runtimeConfig.loginPath && hasSession) {
    return NextResponse.redirect(new URL(runtimeConfig.afterLoginPath, request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
}
