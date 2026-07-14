import { createWebhookDelivery } from "./database"
import type { SurveySettings, SurveyWebhookPayload } from "./types"

interface DeliverWebhookInput {
  workspaceId: string
  surveyId: string
  surveyName: string
  responseId?: string
  settings: SurveySettings
  payload: SurveyWebhookPayload
}

const DEFAULT_TIMEOUT_MS = 8000

export async function deliverSurveyWebhook(input: DeliverWebhookInput) {
  const targetUrl = input.settings.webhookUrl?.trim()
  if (!targetUrl) return null

  const validation = validateWebhookUrl(targetUrl)
  if (validation) {
    return createWebhookDelivery({
      workspaceId: input.workspaceId,
      surveyId: input.surveyId,
      responseId: input.responseId,
      targetUrl,
      status: "failed",
      requestPayload: input.payload,
      errorMessage: validation
    })
  }

  const timeoutMs = Number(process.env.SURVEYFLOW_WEBHOOK_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_TIMEOUT_MS)

  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "SurveyFlow-AI/1.0",
        "X-SurveyFlow-Event": input.payload.event,
        "X-SurveyFlow-Survey-Id": input.surveyId,
        ...(input.responseId ? { "X-SurveyFlow-Response-Id": input.responseId } : {})
      },
      body: JSON.stringify(input.payload),
      signal: controller.signal
    })
    const responseBody = await response.text()

    return createWebhookDelivery({
      workspaceId: input.workspaceId,
      surveyId: input.surveyId,
      responseId: input.responseId,
      targetUrl,
      status: response.ok ? "delivered" : "failed",
      requestPayload: input.payload,
      responseStatus: response.status,
      responseBody: responseBody.slice(0, 4000),
      errorMessage: response.ok ? undefined : `Webhook returned HTTP ${response.status}`
    })
  } catch (err) {
    const message = err instanceof Error && err.name === "AbortError"
      ? "Webhook delivery timed out"
      : err instanceof Error
        ? err.message
        : "Webhook delivery failed"

    return createWebhookDelivery({
      workspaceId: input.workspaceId,
      surveyId: input.surveyId,
      responseId: input.responseId,
      targetUrl,
      status: "failed",
      requestPayload: input.payload,
      errorMessage: message
    })
  } finally {
    clearTimeout(timeout)
  }
}

function validateWebhookUrl(value: string) {
  try {
    const url = new URL(value)
    if (url.protocol !== "https:" && url.protocol !== "http:") return "Webhook URL must use http or https"
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return "Webhook URL cannot target localhost"
    return null
  } catch {
    return "Webhook URL is invalid"
  }
}
