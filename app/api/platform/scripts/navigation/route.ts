import { NextResponse } from "next/server"
import { getCurrentSession } from "@/lib/platform/auth"
import { getNavigationScripts, listRenderableScripts } from "@/lib/platform/scripts"

export async function GET() {
  const session = await getCurrentSession()
  const [headScripts, bodyStartScripts, bodyEndScripts] = await Promise.all([
    listRenderableScripts({ workspaceId: session.workspace?.id, placement: "head" }).catch(() => []),
    listRenderableScripts({ workspaceId: session.workspace?.id, placement: "body_start" }).catch(() => []),
    listRenderableScripts({ workspaceId: session.workspace?.id, placement: "body_end" }).catch(() => [])
  ])

  return NextResponse.json({ scripts: getNavigationScripts([...headScripts, ...bodyStartScripts, ...bodyEndScripts]) })
}
