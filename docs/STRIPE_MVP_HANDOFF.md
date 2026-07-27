# Stripe MVP Handoff

## Objective

Monetize SurveyFlow with workspace-based Stripe subscriptions using the existing dynamic plan registry. A platform owner can define plans and Stripe pricing, while workspace owners can subscribe, change plans, and manage billing.

## Verified Current State

- Dynamic plans already store Stripe product and monthly/yearly price IDs.
- Workspaces already store Stripe customer/subscription IDs, status, and billing-period dates.
- Stripe SDK and environment-variable placeholders already exist.
- Checkout, customer portal, webhook, and platform SKU routes exist, but they are not production-complete.
- The billing page is currently a placeholder.

## Critical Gaps

1. The portal endpoint is not authenticated and accepts a caller-supplied customer ID.
2. Checkout accepts a caller-supplied price ID instead of resolving an allowed plan price on the server.
3. The webhook does not verify Stripe signatures or synchronize subscription state.
4. Checkout does not reliably create/reuse the workspace's Stripe Customer.
5. Stripe event processing is not idempotent.
6. The workspace billing UI does not expose plan selection, subscription state, renewal, checkout, or portal access.
7. Repeated SKU provisioning can create duplicate immutable Stripe Prices.

## MVP Build Order

### 1. Secure Billing APIs

- Require an authenticated workspace owner or a role with `billing:manage`.
- Resolve the workspace from the authenticated session, never from an untrusted customer ID.
- Accept a plan ID and billing interval, then resolve the approved Stripe Price server-side.
- Reject inactive, archived, free, or unavailable plans.

### 2. Customer and Checkout Lifecycle

- Create one Stripe Customer per workspace and persist its ID.
- Reuse the stored customer for later checkout and portal sessions.
- Add `workspace_id`, `application_key`, and `plan_id` to Checkout and Subscription metadata.
- Set `client_reference_id` to the workspace ID.
- Use Stripe Checkout Sessions in `subscription` mode.

### 3. Verified, Idempotent Webhooks

- Read the raw request body and verify `Stripe-Signature` using `STRIPE_WEBHOOK_SECRET`.
- Add a processed-events table with a unique Stripe event ID.
- Handle at minimum:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
  - `invoice.payment_failed`
- Update workspace customer ID, subscription ID, plan, status, and period dates.
- Return successful responses for already-processed events.

### 4. Workspace Billing Page

- Show current plan, status, price, interval, renewal/cancellation date, and payment state.
- Allow selection of active paid plans and monthly/yearly billing.
- Start Checkout for a new subscription.
- Open the Stripe Customer Portal for an existing customer.
- Show a clear free-plan state without creating a Stripe subscription.

### 5. Platform Plan Provisioning

- Keep plan creation flexible; do not hardcode three tiers.
- Create or update one Stripe Product per platform plan.
- Reuse unchanged prices instead of creating duplicates.
- Create a new Price when amount, currency, or interval changes and archive obsolete prices when appropriate.
- Persist all returned Stripe IDs to Supabase.
- Show provisioning status and actionable errors in the plan editor.

### 6. Production Validation

- Exercise test-mode checkout end to end.
- Confirm webhook updates appear in Supabase and the billing page.
- Test upgrade, downgrade, failed payment, cancellation, and portal flows.
- Confirm one workspace cannot access another workspace's customer or subscription.
- Repeat the flow with Stripe live-mode keys before launch.

## Database Addition

Add a workspace-scoped Stripe event ledger, for example:

- `id uuid primary key`
- `application_key text not null`
- `workspace_id uuid null`
- `stripe_event_id text unique not null`
- `event_type text not null`
- `status text not null`
- `payload jsonb not null`
- `error text null`
- `processed_at timestamptz null`
- `created_at timestamptz not null default now()`

Keep service-role writes server-only. Platform users may receive read-only diagnostics through a protected API rather than direct table access.

## Required Configuration

Set these directly in Cloudflare for both Preview and Production as appropriate. Do not paste secret values into a Codex task or commit them.

- `STRIPE_SECRET_KEY` as an encrypted secret
- `STRIPE_WEBHOOK_SECRET` as an encrypted secret
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` as a public variable
- `NEXT_PUBLIC_APP_URL` set to the deployed application URL

Stripe webhook destination:

`https://survey-flow.steep-field-929d.workers.dev/api/webhooks/stripe`

Recommended MVP defaults:

- Currency: USD
- Trials: use each plan's configured trial days; otherwise none
- Cancellation: at period end through the Stripe Customer Portal
- Coupons/promotion codes: later unless immediately required
- Stripe Tax: keep off until tax registrations and product tax codes are decided

## Acceptance Criteria

- A platform owner can provision Stripe products/prices for any active paid plan.
- A workspace owner can subscribe without supplying a raw Stripe Price or Customer ID.
- Checkout returns to the correct workspace and the subscription appears without manual database edits.
- Signed webhooks update the workspace plan and subscription state exactly once.
- A subscribed workspace can open its own Stripe Customer Portal.
- Cross-workspace billing access is rejected.
- Free workspaces do not require a Stripe Customer or Subscription.
- Billing UI clearly handles active, trialing, past-due, canceled, and incomplete states.
- Automated tests cover authorization, price resolution, signature rejection, idempotency, and subscription synchronization.

## Build Now vs Later

Build now: recurring monthly/yearly subscriptions, Checkout, Customer Portal, verified webhooks, dynamic plans, workspace isolation, and billing status UI.

Later: metered usage, overage invoicing, coupons, add-ons, proration controls, tax automation, dunning customization, and self-service plan comparison pages.

## Fresh Task Prompt

Read `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/docs/STRIPE_MVP_HANDOFF.md`. Implement Stripe subscriptions end to end in `survey-flow`, using the existing dynamic plan registry. Work terminal-first and keep updates concise. Do not ask me to paste secrets; tell me exactly where to set them in Stripe and Cloudflare. Run focused tests, commit, and push `main` with network permission. Stop after Stripe billing is production-ready.
