import assert from "node:assert/strict"
import test from "node:test"
import { buildInviteEmail, canSendEmail, resolveEmailProviderConfig } from "../lib/platform/email-logic.ts"

test("email provider config stays disabled until provider, from address, and key exist", () => {
  assert.deepEqual(resolveEmailProviderConfig({}), { provider: "none", from: undefined, hasApiKey: false })
  assert.equal(canSendEmail(resolveEmailProviderConfig({ EMAIL_PROVIDER: "resend", EMAIL_FROM: "noreply@example.com" })), false)
  assert.equal(canSendEmail(resolveEmailProviderConfig({ EMAIL_PROVIDER: "resend", EMAIL_FROM: "noreply@example.com", RESEND_API_KEY: "key" })), true)
  assert.equal(canSendEmail(resolveEmailProviderConfig({ EMAIL_PROVIDER: "postmark", EMAIL_FROM: "noreply@example.com", POSTMARK_SERVER_TOKEN: "key" })), true)
})

test("invite email includes workspace and acceptance link", () => {
  const email = buildInviteEmail({
    appName: "SurveyFlow AI",
    workspaceName: "Acme Research",
    inviteUrl: "https://example.com/invite/token",
    role: "member"
  })
  assert.match(email.subject, /Acme Research/)
  assert.match(email.text, /https:\/\/example.com\/invite\/token/)
  assert.match(email.html, /Accept the invite/)
})

