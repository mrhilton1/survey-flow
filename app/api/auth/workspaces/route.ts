import { NextResponse } from "next/server"
import { getCurrentSession } from "@/lib/platform/auth"

export async function GET() {
  const session = await getCurrentSession()
  return NextResponse.json({ workspaces: session.workspace ? [session.workspace] : [] })
}
