# Stripe production setup

The application code never needs secret values committed to Git or pasted into a Codex task. Configure Stripe in a sandbox first, repeat the steps in live mode, and keep the two environments' keys and webhook signing secrets separate.

## 1. Create the Stripe API key

In Stripe Dashboard, open **Workbench → API keys → Create restricted key**. Name it `SurveyFlow Worker` and grant only the resources used by the Worker:

- Customers: Write
- Checkout Sessions: Write
- Customer Portal: Write
- Products: Write
- Prices: Write
- Subscriptions: Read

Make sure the Dashboard is in **Sandbox** mode before creating the first key. Store the resulting sandbox restricted key (`rk_test_...`) as `STRIPE_SECRET_KEY`. An unrestricted sandbox key (`sk_test_...`) also works, but a restricted key is preferred. Never use a publishable `pk_test_...` key in this server-secret field.

## 2. Configure the Customer Portal

In Stripe Dashboard, open **Settings → Billing → Customer portal**.

- Enable payment-method and billing-information updates.
- Enable subscription switching for the products/prices provisioned from SurveyFlow.
- Enable cancellation at the end of the billing period.
- Decide the proration behavior for upgrades and downgrades before enabling plan switching.
- Leave promotion codes and tax collection off for this MVP unless they have been separately configured.

Save the sandbox configuration, test it, then configure the live-mode portal separately.

## 3. Create the event destination

In Stripe Dashboard, open **Workbench → Webhooks → Create destination**.

- Source: events on this account (not connected accounts)
- API version: `2026-06-24.dahlia`
- Endpoint: `https://survey-flow.steep-field-929d.workers.dev/api/webhooks/stripe`
- Events:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
  - `invoice.payment_failed`

Reveal the destination signing secret (`whsec_...`) and store it as `STRIPE_WEBHOOK_SECRET`. The sandbox and live destinations have different signing secrets.

## 4. Set Cloudflare variables and secrets

In Cloudflare Dashboard, open **Workers & Pages → survey-flow → Settings → Variables and Secrets**.

For the deployed sandbox Worker, add these as encrypted secrets:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

Confirm the existing `SUPABASE_SERVICE_ROLE_KEY` remains an encrypted secret. Keep `NEXT_PUBLIC_APP_URL=https://survey-flow.steep-field-929d.workers.dev` as a plain-text variable. The current hosted Checkout integration does not use a Stripe publishable key in the browser, so `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is not required.

The equivalent safe CLI commands prompt interactively and do not expose values in shell history:

```bash
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
```

Run those commands from the `survey-flow` repository directory and paste the value only when Wrangler displays its hidden prompt. For local development, put the same sandbox values in `survey-flow/.dev.vars` (which is Git-ignored):

```dotenv
STRIPE_SECRET_KEY=rk_test_REPLACE_ME
STRIPE_WEBHOOK_SECRET=whsec_REPLACE_ME
```

Do not pass a key as a command argument. `wrangler.jsonc` declares the required secret names, so deployment fails clearly when any server secret is missing, and `keep_vars` preserves public variables that were set in the Dashboard.

## 5. Provision plans and validate

1. In SurveyFlow, open **Platform Admin → Plans**.
2. Choose **Paid** as the billing type and set a positive monthly and/or yearly price on each plan that should use Stripe. Choose **Free** or **Grant only** for plans that should remain local with zero pricing.
3. Save the plan. SurveyFlow automatically creates or updates the Stripe catalog records.
4. Confirm the status reads **synced** and Product and Price IDs appear. Use **Sync with Stripe** to reconcile manually.
5. Subscribe a sandbox workspace from **Workspace → Billing**.
6. In Stripe Workbench, confirm webhook deliveries return `200`.
7. Confirm `survey_flow.app_shell_workspace_plans` and `survey_flow.app_shell_stripe_events` update.
8. Test portal access, upgrade, downgrade, end-of-period cancellation, payment failure, and webhook replay.
9. Repeat with live-mode keys and a live webhook destination before launch.
