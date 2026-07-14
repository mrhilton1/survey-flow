import { NextResponse } from "next/server"
import { getCurrentSession } from "@/lib/platform/auth"
import { resolveEntitlements } from "@/lib/platform/entitlements"

export async function GET() {
  const session = await getCurrentSession()
  if (!session.workspace) return NextResponse.json({ error: "No workspace" }, { status: 401 })
  return NextResponse.json(await resolveEntitlements(session.workspace.id, session.workspace.planKey))
}
