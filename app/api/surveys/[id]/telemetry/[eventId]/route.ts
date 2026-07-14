import { NextResponse } from "next/server"
import { requireSurveyflowSession } from "@/lib/surveyflow/authz"
import { deleteTelemetryEvent } from "@/lib/surveyflow/database"

export async function DELETE(_: Request, { params }: { params: { id: string; eventId: string } }) {
  const { session, error } = await requireSurveyflowSession("telemetry:read")
  if (error) return error

  const result = await deleteTelemetryEvent({
    workspaceId: session.workspace!.id,
    surveyId: params.id,
    eventId: params.eventId
  })
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
