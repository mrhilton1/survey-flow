import { NextResponse } from "next/server"
import { getCurrentSession } from "@/lib/platform/auth"
import { hasPermission } from "@/lib/platform/permissions"
import type { Permission } from "@/lib/platform/types"

export async function requireSurveyflowSession(permission: Permission) {
  const session = await getCurrentSession()

  if (!session.authenticated || !session.user || !session.workspace) {
    return {
      session,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  if (!session.isPlatformAdmin && !hasPermission(session.user.role, permission)) {
    return {
      session,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  return { session, error: null }
}

export async function requirePlatformQaSession() {
  const session = await getCurrentSession()
  const permission = "platform_qa:run" as Permission

  if (!session.authenticated || !session.user || !session.workspace) {
    return {
      session,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  if (!session.isPlatformAdmin && !hasPermission(session.user.role, permission)) {
    return {
      session,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  return { session, error: null }
}
