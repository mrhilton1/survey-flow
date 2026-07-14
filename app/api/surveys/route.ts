import { NextResponse } from "next/server"
import { requireSurveyflowSession } from "@/lib/surveyflow/authz"
import { createSurvey, listSurveys } from "@/lib/surveyflow/database"

export async function GET() {
  const { session, error } = await requireSurveyflowSession("surveys:read")
  if (error) return error

  const result = await listSurveys(session.workspace!.id)
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
  return NextResponse.json({ surveys: result.data || [] })
}

export async function POST(request: Request) {
  const { session, error } = await requireSurveyflowSession("surveys:create")
  if (error) return error

  const body = await request.json().catch(() => ({}))
  const result = await createSurvey({
    workspaceId: session.workspace!.id,
    ownerUserId: session.user!.id,
    name: body.name
  })

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
  return NextResponse.json({ survey: result.data }, { status: 201 })
}
