import { NextResponse } from "next/server"
import { requireSurveyflowSession } from "@/lib/surveyflow/authz"
import { deleteTestResponses, listResponses } from "@/lib/surveyflow/database"

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { session, error } = await requireSurveyflowSession("responses:read")
  if (error) return error

  const result = await listResponses({ workspaceId: session.workspace!.id, surveyId: id })
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
  return NextResponse.json({ responses: result.data || [] })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { session, error } = await requireSurveyflowSession("responses:delete")
  if (error) return error

  const url = new URL(request.url)
  if (url.searchParams.get("kind") !== "test") {
    return NextResponse.json({ error: "Only kind=test bulk deletion is supported." }, { status: 400 })
  }

  const result = await deleteTestResponses({ workspaceId: session.workspace!.id, surveyId: id })
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
