import { NextResponse } from "next/server"
import { buildOpenApiDocument, listApiEndpoints } from "@/lib/platform/api-endpoints"
import { getCurrentSession } from "@/lib/platform/auth"

export async function GET() {
  const session = await getCurrentSession()
  const endpoints = session.authenticated
    ? await listApiEndpoints({ documentedOnly: true, includeAdmin: session.isPlatformAdmin })
    : await listApiEndpoints({ documentedOnly: true, visibility: "public" })

  return NextResponse.json(buildOpenApiDocument(endpoints))
}
