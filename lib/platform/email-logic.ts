export type EmailProvider = "none" | "resend" | "postmark"

export interface EmailProviderConfig {
  provider: EmailProvider
  from?: string
  hasApiKey: boolean
}

export interface EmailDeliveryStatus {
  provider: EmailProvider
  ready: boolean
  fromConfigured: boolean
  apiKeyConfigured: boolean
  message: string
}

export function resolveEmailProviderConfig(env: Record<string, string | undefined>): EmailProviderConfig {
  const provider = normalizeProvider(env.EMAIL_PROVIDER)
  return {
    provider,
    from: env.EMAIL_FROM || env.RESEND_FROM_EMAIL || env.POSTMARK_FROM_EMAIL,
    hasApiKey: provider === "resend"
      ? Boolean(env.RESEND_API_KEY)
      : provider === "postmark"
        ? Boolean(env.POSTMARK_SERVER_TOKEN)
        : false
  }
}

export function canSendEmail(config: EmailProviderConfig): boolean {
  return config.provider !== "none" && Boolean(config.from) && config.hasApiKey
}

export function resolveEmailDeliveryStatus(env: Record<string, string | undefined>): EmailDeliveryStatus {
  const config = resolveEmailProviderConfig(env)
  const ready = canSendEmail(config)
  return {
    provider: config.provider,
    ready,
    fromConfigured: Boolean(config.from),
    apiKeyConfigured: config.hasApiKey,
    message: ready
      ? `${providerLabel(config.provider)} invite email is configured.`
      : config.provider === "none"
        ? "Invite email is disabled because EMAIL_PROVIDER is not configured."
        : `Invite email is not ready. Configure EMAIL_FROM and the ${providerLabel(config.provider)} API key.`
  }
}

export function buildInviteEmail(input: {
  appName: string
  workspaceName: string
  inviteUrl: string
  role: string
}) {
  const subject = `You're invited to ${input.workspaceName}`
  const text = [
    `You've been invited to join ${input.workspaceName} in ${input.appName} as ${input.role}.`,
    "",
    `Accept the invite: ${input.inviteUrl}`,
    "",
    "If you were not expecting this invite, you can ignore this email."
  ].join("\n")
  const html = [
    `<p>You've been invited to join <strong>${escapeHtml(input.workspaceName)}</strong> in ${escapeHtml(input.appName)} as ${escapeHtml(input.role)}.</p>`,
    `<p><a href="${escapeHtml(input.inviteUrl)}">Accept the invite</a></p>`,
    "<p>If you were not expecting this invite, you can ignore this email.</p>"
  ].join("")

  return { subject, text, html }
}

export function normalizeProvider(value?: string): EmailProvider {
  if (value === "resend" || value === "postmark") return value
  return "none"
}

function providerLabel(provider: EmailProvider): string {
  if (provider === "resend") return "Resend"
  if (provider === "postmark") return "Postmark"
  return "Email"
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}
