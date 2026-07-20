import { createServerSupabaseClient } from "@/lib/platform/supabase"
import { createDefaultSurvey } from "./defaults"
import type { ResponseStatus, SurveyStatus, TelemetryType, SurveyWebhookPayload, ThankYouPageContent } from "./types"

export function surveyflowDb() {
  return createServerSupabaseClient()
}

export async function listSurveys(workspaceId: string) {
  const db = surveyflowDb()
  return db
    .from("surveyflow_surveys")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false })
}

export async function createSurvey(input: {
  workspaceId: string
  ownerUserId: string
  name?: string
}) {
  const db = surveyflowDb()
  const survey = createDefaultSurvey(input)

  return db
    .from("surveyflow_surveys")
    .insert({
      workspace_id: survey.workspaceId,
      owner_user_id: survey.ownerUserId,
      name: survey.name,
      description: survey.description,
      seo_description: survey.seoDescription,
      questions: survey.questions,
      style: survey.style,
      settings: survey.settings,
      status: survey.status,
      responses_count: survey.responsesCount,
      views_count: survey.viewsCount
    })
    .select("*")
    .single()
}

export async function getSurveyForWorkspace(input: {
  workspaceId: string
  surveyId: string
}) {
  const db = surveyflowDb()
  return db
    .from("surveyflow_surveys")
    .select("*")
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.surveyId)
    .single()
}

export async function getPublicSurvey(surveyId: string, options?: { allowPreview?: boolean }) {
  const db = surveyflowDb()
  let query = db
    .from("surveyflow_surveys")
    .select("*")
    .eq("id", surveyId)

  query = options?.allowPreview
    ? query.in("status", ["draft", "testing", "published"])
    : query.in("status", ["testing", "published"])

  return query.single()
}

export async function listThankYouPages(input: {
  workspaceId: string
  surveyId: string
}) {
  const db = surveyflowDb()
  return db
    .from("surveyflow_thank_you_pages")
    .select("*")
    .eq("workspace_id", input.workspaceId)
    .eq("survey_id", input.surveyId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
}

export async function getSelectedThankYouPage(input: {
  surveyId: string
  pageId?: string | null
}) {
  const db = surveyflowDb()
  let query = db
    .from("surveyflow_thank_you_pages")
    .select("*")
    .eq("survey_id", input.surveyId)
    .neq("status", "archived")

  query = input.pageId
    ? query.eq("id", input.pageId)
    : query.eq("is_default", true)

  return query.maybeSingle()
}

export async function createThankYouPage(input: {
  workspaceId: string
  surveyId: string
  name?: string
  content?: ThankYouPageContent
  isDefault?: boolean
}) {
  const db = surveyflowDb()
  if (input.isDefault) {
    await db
      .from("surveyflow_thank_you_pages")
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq("workspace_id", input.workspaceId)
      .eq("survey_id", input.surveyId)
  }

  return db
    .from("surveyflow_thank_you_pages")
    .insert({
      workspace_id: input.workspaceId,
      survey_id: input.surveyId,
      name: input.name || "Outcome",
      status: "active",
      is_default: input.isDefault || false,
      content: input.content || {}
    })
    .select("*")
    .single()
}

export async function updateThankYouPage(input: {
  workspaceId: string
  surveyId: string
  pageId: string
  updates: {
    name?: string
    status?: "draft" | "active" | "archived"
    is_default?: boolean
    content?: ThankYouPageContent
  }
}) {
  const db = surveyflowDb()
  if (input.updates.is_default) {
    await db
      .from("surveyflow_thank_you_pages")
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq("workspace_id", input.workspaceId)
      .eq("survey_id", input.surveyId)
  }

  return db
    .from("surveyflow_thank_you_pages")
    .update({
      ...input.updates,
      updated_at: new Date().toISOString()
    })
    .eq("workspace_id", input.workspaceId)
    .eq("survey_id", input.surveyId)
    .eq("id", input.pageId)
    .select("*")
    .single()
}

export async function deleteThankYouPage(input: {
  workspaceId: string
  surveyId: string
  pageId: string
}) {
  const db = surveyflowDb()
  return db
    .from("surveyflow_thank_you_pages")
    .update({ status: "archived", is_default: false, updated_at: new Date().toISOString() })
    .eq("workspace_id", input.workspaceId)
    .eq("survey_id", input.surveyId)
    .eq("id", input.pageId)
}

export async function updateSurvey(input: {
  workspaceId: string
  surveyId: string
  updates: Record<string, unknown>
}) {
  const db = surveyflowDb()
  return db
    .from("surveyflow_surveys")
    .update({
      ...input.updates,
      updated_at: new Date().toISOString()
    })
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.surveyId)
    .select("*")
    .single()
}

export async function deleteSurvey(input: {
  workspaceId: string
  surveyId: string
}) {
  const db = surveyflowDb()
  return db
    .from("surveyflow_surveys")
    .delete()
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.surveyId)
}

export async function listResponses(input: {
  workspaceId: string
  surveyId: string
}) {
  const db = surveyflowDb()
  return db
    .from("surveyflow_responses")
    .select("*")
    .eq("workspace_id", input.workspaceId)
    .eq("survey_id", input.surveyId)
    .order("last_active_at", { ascending: false })
}

export async function getResponseForSurvey(input: {
  surveyId: string
  responseId: string
}) {
  const db = surveyflowDb()
  return db
    .from("surveyflow_responses")
    .select("id, status, is_test")
    .eq("survey_id", input.surveyId)
    .eq("id", input.responseId)
    .single()
}

export async function writePublicResponse(input: {
  workspaceId: string
  surveyId: string
  responseId?: string
  answers: Record<string, unknown>
  scores?: Record<string, number>
  totalScore?: number
  status: ResponseStatus
  isTest?: boolean
  metadata: Record<string, unknown>
}) {
  const db = surveyflowDb()
  const now = new Date().toISOString()
  const row = {
    workspace_id: input.workspaceId,
    survey_id: input.surveyId,
    answers: input.answers,
    scores: input.scores || {},
    total_score: input.totalScore,
    status: input.status,
    is_test: input.isTest || false,
    metadata: input.metadata,
    submitted_at: input.status === "completed" ? now : null,
    last_active_at: now,
    updated_at: now
  }

  if (input.responseId) {
    return db
      .from("surveyflow_responses")
      .update(row)
      .eq("id", input.responseId)
      .eq("survey_id", input.surveyId)
      .select("*")
      .single()
  }

  return db
    .from("surveyflow_responses")
    .insert(row)
    .select("*")
    .single()
}

export async function incrementSurveyCounter(input: {
  surveyId: string
  counter: "views_count" | "responses_count"
}) {
  const db = surveyflowDb()
  const { data: survey } = await db
    .from("surveyflow_surveys")
    .select("views_count, responses_count")
    .eq("id", input.surveyId)
    .single()

  const currentValue = input.counter === "views_count"
    ? Number(survey?.views_count || 0)
    : Number(survey?.responses_count || 0)
  return db
    .from("surveyflow_surveys")
    .update({ [input.counter]: currentValue + 1, updated_at: new Date().toISOString() })
    .eq("id", input.surveyId)
}

export async function deleteResponse(input: {
  workspaceId: string
  surveyId: string
  responseId: string
}) {
  const db = surveyflowDb()
  return db
    .from("surveyflow_responses")
    .delete()
    .eq("workspace_id", input.workspaceId)
    .eq("survey_id", input.surveyId)
    .eq("id", input.responseId)
}

export async function deleteTestResponses(input: {
  workspaceId: string
  surveyId: string
}) {
  const db = surveyflowDb()
  return db
    .from("surveyflow_responses")
    .delete()
    .eq("workspace_id", input.workspaceId)
    .eq("survey_id", input.surveyId)
    .eq("is_test", true)
}

export async function listTelemetry(input: {
  workspaceId: string
  surveyId: string
}) {
  const db = surveyflowDb()
  return db
    .from("surveyflow_telemetry_events")
    .select("*")
    .eq("workspace_id", input.workspaceId)
    .eq("survey_id", input.surveyId)
    .order("created_at", { ascending: false })
}

export async function createTelemetryEvent(input: {
  workspaceId: string
  surveyId: string
  questionId?: string
  type: TelemetryType
  payload: Record<string, unknown>
}) {
  const db = surveyflowDb()
  return db
    .from("surveyflow_telemetry_events")
    .insert({
      workspace_id: input.workspaceId,
      survey_id: input.surveyId,
      question_id: input.questionId,
      type: input.type,
      payload: input.payload
    })
    .select("*")
    .single()
}

export async function deleteTelemetryEvent(input: {
  workspaceId: string
  surveyId: string
  eventId: string
}) {
  const db = surveyflowDb()
  return db
    .from("surveyflow_telemetry_events")
    .delete()
    .eq("workspace_id", input.workspaceId)
    .eq("survey_id", input.surveyId)
    .eq("id", input.eventId)
}

export async function createWebhookDelivery(input: {
  workspaceId: string
  surveyId: string
  responseId?: string
  targetUrl: string
  status: "pending" | "delivered" | "failed"
  requestPayload: SurveyWebhookPayload
  responseStatus?: number
  responseBody?: string
  errorMessage?: string
}) {
  const db = surveyflowDb()
  return db
    .from("surveyflow_webhook_deliveries")
    .insert({
      workspace_id: input.workspaceId,
      survey_id: input.surveyId,
      response_id: input.responseId,
      target_url: input.targetUrl,
      status: input.status,
      request_payload: input.requestPayload,
      response_status: input.responseStatus,
      response_body: input.responseBody,
      error_message: input.errorMessage,
      attempted_at: new Date().toISOString()
    })
    .select("*")
    .single()
}

export async function listWebhookDeliveries(input: {
  workspaceId: string
  surveyId: string
}) {
  const db = surveyflowDb()
  return db
    .from("surveyflow_webhook_deliveries")
    .select("*")
    .eq("workspace_id", input.workspaceId)
    .eq("survey_id", input.surveyId)
    .order("created_at", { ascending: false })
}
