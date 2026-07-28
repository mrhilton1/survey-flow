import { appConfig } from "@/config/app.config"
import { buildInviteEmail, canSendEmail, resolveEmailProviderConfig } from "@/lib/platform/email-logic"

export interface SendEmailInput {
  to: string
  subject: string
  text: string
  html?: string
}

export interface SendEmailResult {
  sent: boolean
  provider: string
  warning?: string
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const config = resolveEmailProviderConfig(process.env)
  if (!canSendEmail(config)) {
    return {
      sent: false,
      provider: config.provider,
      warning: config.provider === "none"
        ? "Email provider is not configured; invite link was generated but not emailed."
        : "Email provider is missing EMAIL_FROM or provider API key; invite link was generated but not emailed."
    }
  }

  if (config.provider === "resend") {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: config.from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html
      })
    })
    if (!response.ok) return { sent: false, provider: "resend", warning: `Resend returned ${response.status}.` }
    return { sent: true, provider: "resend" }
  }

  if (config.provider === "postmark") {
    const response = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        "X-Postmark-Server-Token": process.env.POSTMARK_SERVER_TOKEN || "",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        From: config.from,
        To: input.to,
        Subject: input.subject,
        TextBody: input.text,
        HtmlBody: input.html
      })
    })
    if (!response.ok) return { sent: false, provider: "postmark", warning: `Postmark returned ${response.status}.` }
    return { sent: true, provider: "postmark" }
  }

  return { sent: false, provider: "none", warning: "Email provider is not configured." }
}

export async function sendTeamInviteEmail(input: {
  to: string
  workspaceName: string
  inviteUrl: string
  role: string
}) {
  const email = buildInviteEmail({
    appName: appConfig.product.name,
    workspaceName: input.workspaceName,
    inviteUrl: input.inviteUrl,
    role: input.role
  })

  return sendEmail({
    to: input.to,
    subject: email.subject,
    text: email.text,
    html: email.html
  })
}

