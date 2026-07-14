import { NextResponse } from "next/server"
import { requireSurveyflowSession } from "@/lib/surveyflow/authz"
import { deleteTelemetryEvent } from "@/lib/surveyflow/database"

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string; eventId: string }> }) {
  const { id, eventId } = await params
  const { session, error } = await requireSurveyflowSession("telemetry:read")
  if (error) return error

  const result = await deleteTelemetryEvent({
    workspaceId: session.workspace!.id,
    surveyId: id,
    eventId
  })
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
