# SurveyFlow MVP Handoff and Requirements Map

Last verified locally: 2026-07-28  
Primary repo: `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow`  
Template repo: `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/app-shell-template`  
User-recalled checkpoint: `38720d1` (`Fix shell nav and plan entitlement refresh`)  
Latest verified local HEAD before platform stabilization: `d6974fb` (`Add explicit plan billing types`)  
Latest deployed Worker version from this stabilization pass: `d8790709-c1bd-415f-8d57-478ee1eaa6cb`  
Current stabilization branch: `codex/stabilize-platform-work`

## Purpose

This file is the starting point for any new Codex task in this folder. It captures what has shipped, what still needs to be finished for MVP, where the important code and docs live, and the exact prompts a new chat can use to continue without re-discovering the system.

SurveyFlow is roughly 85 percent complete for MVP. The foundation exists. The remaining work is mostly finishing real workflows, hardening permissions/workspace isolation, validating Stripe, and backfilling reusable platform capabilities into the app-shell template.

## Current Update - 2026-07-28 Later Continuation

This is the newest continuation note. The previous update below is still useful background, but the following work has now been implemented locally after the platform stabilization commit:

- Team invite email abstraction:
  - `lib/platform/email-logic.ts`
  - `lib/platform/email.ts`
  - Supports `EMAIL_PROVIDER=none`, `resend`, or `postmark`.
  - Invite records/links still work when no provider is configured; email sends once `EMAIL_FROM` and the provider key are present.
- Team invite acceptance workflow:
  - `/invite/[token]`
  - `/api/auth/accept-invite`
  - Accepting an invite creates or links a Supabase Auth user, creates/upserts the workspace membership, marks the invite accepted, sets the app-shell session cookie, and writes an audit event.
- QA board create/delete workflow coverage:
  - Team invite create/delete cleanup.
  - Platform Scripts create/delete cleanup.
  - Existing guard checks remain non-destructive.
- Platform Scripts module:
  - `/admin/scripts`
  - `/api/platform/admin/scripts`
  - `lib/platform/script-logic.ts`
  - `lib/platform/scripts.tsx`
  - `components/platform/scripts-admin-console.tsx`
  - `supabase/migrations/20260728090000_add_platform_scripts.sql`
  - `supabase/migrations/20260728193000_add_script_navigation_option.sql`
  - Scripts support global/workspace scope, head/body-start/body-end placement, inline or HTTPS external scripts, environment targeting, run-once or client-navigation behavior for inline scripts, enabled/disabled state, ordering, and audit logging.
- Root layout renders enabled platform scripts by placement and workspace context. Inline scripts default to once per full page load; opt into client-navigation behavior for SPA pageview/test snippets.
- App-shell template backfill completed for the reusable email abstraction and Platform Scripts module:
  - Template env placeholders added for email providers.
  - Template `/admin/scripts`, API, migration, docs, nav, and root layout wiring added.

Validation run locally after this continuation:

- SurveyFlow: `npm test` passed with 16 tests.
- SurveyFlow: `npm run typecheck` passed.
- SurveyFlow: `npm run build` passed.
- app-shell-template: `npm run typecheck` passed.
- app-shell-template: `npm run build` passed.

Supabase/live DB note:

- The connected Supabase project `vupriscnyrqmibmfowdx` was visible and healthy through the Supabase connector.
- The Platform Scripts SQL was applied manually in Supabase after updating the feature registry `purchase_type` constraint to include `grant_only`.
- Verified live through the connector:
  - `survey_flow.app_shell_scripts` exists.
  - `platform_scripts` exists in `app_shell_feature_registry` with `purchase_type = grant_only`, `locked_behavior = hide`, and `required_permissions = {platform:admin}`.
- Historical note: two attempts to apply the migration through the Supabase connector returned only `INVALID_ARGUMENT`; manual SQL editor application succeeded after the registry constraint fix.

Recommended next order from here:

1. Run `/admin/qa` Platform Integration Board in the deployed app, including the create/delete checks.
2. Commit this platform/team/scripts/template hardening slice.
3. Start a separate Thrive/Stripe live validation thread.

## Previous Current Update - 2026-07-28

This is the most current continuation note. The previous priority list below includes sections that were true when the handoff was first written, but the following platform slice has now been implemented and deployed:

- Team Management page and workspace-scoped API.
- Workspace Settings page and API, including persisted name, logo label, theme color, support email, and shell refresh data.
- API Docs page backed by an endpoint registry.
- Platform-admin API Endpoint Registry page.
- OpenAPI JSON route with visibility filtering.
- Supabase migrations for workspace settings, API endpoint registry, and API registry feature seed.
- Platform QA board with app-shell API checks.
- Feature/Entitlements page QA coverage indicators that show the board and exact QA test name.

Important repo state:

- The stabilization work was developed on top of `main` after `d6974fb`.
- The live Supabase migrations were already applied to project ref `vupriscnyrqmibmfowdx`.
- The app was deployed to `https://survey-flow.steep-field-929d.workers.dev`.
- If this document is being read in a later thread, first check `git status --short` and `git log --oneline -5` to confirm the stabilization commit is present.

Current validation already run for the deployed platform slice:

- `npm run build`
- `npm run typecheck`
- `npm test`
- Unauthenticated smoke checks confirmed admin routes redirect to `/login`.

Current priority order:

1. Commit/stabilize today's deployed work if it is not already committed.
2. Hardening: auth, permissions, and workspace isolation.
3. Hardening: happy-path workflow tests for Team, Workspace Settings, API Endpoint Registry, and OpenAPI access by user type.
4. Feature QA coverage gaps on `/admin/entitlements`.
5. Stripe live end-to-end validation.
6. Knowledge Base.
7. Template backfill to `app-shell-template`.
8. Final deploy verification pass.

Best next thread prompt:

```text
Read docs/MVP_HANDOFF_REQUIREMENTS.md, then verify git status/log. Start hardening SurveyFlow around auth, permissions, and workspace isolation for the recently shipped Team Management, Workspace Settings, API Endpoint Registry, API Docs, OpenAPI, QA board, and Feature QA coverage work. Add focused QA tests where useful, keep changes scoped, run build/typecheck/tests, and deploy when green.
```

## Start Here In A New Chat

1. Open this file first:
   `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/docs/MVP_HANDOFF_REQUIREMENTS.md`
2. Verify current repo state:
   ```bash
   cd "/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow"
   git status --short
   git log --oneline -5
   ```
3. Read only the companion docs relevant to the task:
   - Feature access and plans:
     `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/docs/FEATURE_ACCESS_FRAMEWORK.md`
   - Platform workspace owner tools:
     `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/docs/PLATFORM_WORKSPACE_ADMIN.md`
   - Stripe MVP handoff:
     `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/docs/STRIPE_MVP_HANDOFF.md`
   - Stripe production setup:
     `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/docs/STRIPE_PRODUCTION_SETUP.md`
4. For implementation, inspect the files listed in the relevant section below before editing.
5. Do not ask the user to paste secrets into chat. Tell them exactly where secrets belong in Cloudflare or Stripe.
6. Preserve multi-tenant workspace boundaries. Any platform-owner functionality must be explicitly permission-gated and auditable.
7. When network is required for push/deploy, the user has said they generally want it allowed, but still use the normal approval flow if the tool requires escalation.

## Current Architecture Snapshot

### App Shell

Core shell pieces are in place:

- Header and footer
- Right-side navigation tray
- Auth
- Workspace scoping
- Roles and permissions foundations
- Platform owner/admin navigation
- Feature flags
- Entitlements
- Flexible plans
- Billing foundations

Key shell and platform files:

- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/components/platform/access-admin-console.tsx`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/components/platform/workspace-admin-console.tsx`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/components/platform/platform-qa-console.tsx`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/components/platform/billing-console.tsx`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/lib/platform/entitlements.ts`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/lib/platform/feature-access.ts`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/lib/platform/feature-flags.ts`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/lib/platform/billing.ts`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/lib/platform/billing-logic.ts`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/lib/platform/stripe.ts`

### Existing Pages

Workspace pages:

- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/app/dashboard/page.tsx`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/app/dashboard/team/page.tsx`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/app/dashboard/settings/page.tsx`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/app/dashboard/api-docs/page.tsx`

Platform admin pages:

- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/app/admin/workspaces/page.tsx`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/app/admin/users/page.tsx`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/app/admin/plans/page.tsx`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/app/admin/entitlements/page.tsx`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/app/admin/flags/page.tsx`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/app/admin/billing/page.tsx`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/app/admin/qa/page.tsx`

### Important APIs

Platform/admin:

- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/app/api/platform/admin/access/route.ts`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/app/api/platform/admin/workspace-context/route.ts`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/app/api/platform/admin/workspaces/route.ts`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/app/api/platform/admin/users/route.ts`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/app/api/platform/flags/route.ts`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/app/api/platform/entitlements/route.ts`

Billing/Stripe:

- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/app/api/platform/billing/checkout/route.ts`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/app/api/platform/billing/portal/route.ts`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/app/api/webhooks/stripe/route.ts`

Survey runtime:

- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/app/api/public/surveys/[id]/route.ts`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/app/api/public/surveys/[id]/responses/route.ts`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/app/api/surveys/[id]/thank-you-pages/route.ts`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/app/api/surveys/[id]/thank-you-pages/[pageId]/route.ts`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/app/api/platform/qa/surveys/[id]/thank-you-router/evaluate/route.ts`

Auth/workspaces:

- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/app/api/auth/workspaces/route.ts`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/app/api/auth/bootstrap-owner/route.ts`

### Supabase Migrations To Know

- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/supabase/migrations/20260716150000_upgrade_app_shell_entitlements.sql`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/supabase/migrations/20260716173000_add_feature_access_associations.sql`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/supabase/migrations/20260716174500_seed_feature_access_associations.sql`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/supabase/migrations/20260727120000_add_stripe_billing_event_ledger.sql`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/supabase/migrations/20260727160000_add_plan_stripe_catalog_sync.sql`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/supabase/migrations/20260728044013_add_plan_billing_type.sql`

## Product Decisions Already Made

### Entitlements, Flags, And Permissions

Entitlements are the billing/source-of-truth layer. They decide what a workspace has purchased or has been granted.

Flags are rollout and operational switches. They help test, pause, emergency-disable, or gradually release functionality. Flags should not be the source of truth for paid access.

Permissions decide what the current user can do inside the workspace or platform context.

Important troubleshooting rule:

- Entitlement answers: "Does this workspace have access?"
- Flag answers: "Is this capability operationally enabled?"
- Permission answers: "Can this user use/manage it?"

Associated flags and permissions should be stored on feature/entitlement registry rows so platform owners can troubleshoot without memorizing flag names.

### Platform Workspace View

The platform workspace view is not silent impersonation. It sets an audited platform workspace-context cookie so a platform owner can inspect a workspace through the app shell. Actions must remain permission-gated and workspace-scoped.

See:
`/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/docs/PLATFORM_WORKSPACE_ADMIN.md`

### Thank You Pages

The app has a Thank You Page Builder foundation, custom page blocks, merge fields, form blocks, media blocks, schedule/booking blocks, and an Outcomes/Router model.

The user prefers:

- "Outcomes" for thank-you pages in the left rail.
- "Option Result Fields" instead of "Outcome Result Fields" for This-or-That option result metadata.
- Router logic in the Questions tab area.
- Dropdown-based rule building so users do not need backend syntax.
- AND/OR logic that is simple and visually obvious.
- Ability to create/edit an outcome page without leaving the current workflow.

### Stripe

Stripe is now basically connected, but it still needs end-to-end validation and likely final UI/portal polish.

Current Stripe decisions:

- Plans are flexible, not locked to three hardcoded tiers.
- Paid active plans can sync Stripe Product and Price records.
- Free or grant-only plans should not require Stripe customers/subscriptions.
- Stripe webhook must be signed, idempotent, and update workspace billing state.
- Hosted Checkout currently does not require `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.

See:

- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/docs/STRIPE_MVP_HANDOFF.md`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/docs/STRIPE_PRODUCTION_SETUP.md`

## MVP Remaining Work In Priority Order

### 1. Team Management

Status: page exists, workflow foundation exists, not complete.

Why this is first:

Real users are signing up. Workspace owners need to invite teammates, manage roles, and remove access safely. Platform owners need to inspect users/workspaces without breaking tenant boundaries.

Likely files:

- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/app/dashboard/team/page.tsx`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/app/api/auth/workspaces/route.ts`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/app/api/platform/admin/users/route.ts`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/components/platform/workspace-admin-console.tsx`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/lib/platform/entitlements.ts`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/lib/platform/feature-access.ts`
- Relevant Supabase workspace/user tables in migrations.

Acceptance criteria:

- Workspace owner/admin can invite a user by email.
- Invited user gets an invite flow or at minimum an invite record/token that can be accepted.
- Owner/admin can change user role.
- Owner/admin can remove a user.
- Owner cannot remove themselves if they are the only owner.
- Team member limits respect the active plan or workspace override.
- Role changes immediately refresh permissions in the UI.
- Platform owner can view users across workspaces from platform admin.
- Platform owner can inspect a workspace user list from workspace management.
- All team endpoints enforce workspace membership or platform-owner permission.
- Cross-workspace team access is rejected.
- Actions are auditable where platform owner context is involved.

Suggested implementation prompt:

```text
Read docs/MVP_HANDOFF_REQUIREMENTS.md, docs/FEATURE_ACCESS_FRAMEWORK.md, and docs/PLATFORM_WORKSPACE_ADMIN.md. Finish Team Management for SurveyFlow. Implement invitations, role changes, removal, permission enforcement, owner safety checks, workspace scoping, plan/team-limit enforcement, and platform-owner visibility. Use existing app-shell patterns. Do not add broad refactors. Run focused build/tests. Commit the result.
```

### 2. Stripe Monetization Completion

Status: basic Stripe connection exists; needs live validation and polished owner flow.

Why this moved up:

The user wants to monetize soon and recently connected basic Stripe. Finish enough for paid workspaces to subscribe and manage billing.

Likely files:

- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/docs/STRIPE_MVP_HANDOFF.md`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/docs/STRIPE_PRODUCTION_SETUP.md`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/lib/platform/stripe.ts`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/lib/platform/billing.ts`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/lib/platform/billing-logic.ts`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/app/api/platform/billing/checkout/route.ts`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/app/api/platform/billing/portal/route.ts`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/app/api/webhooks/stripe/route.ts`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/components/platform/billing-console.tsx`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/app/admin/plans/page.tsx`
- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/app/admin/billing/page.tsx`

Acceptance criteria:

- Platform owner can create/update a paid plan and sync Product/Price records to Stripe.
- Stripe Product ID and Price IDs are persisted back to Supabase.
- Workspace owner can start checkout from Billing.
- Checkout uses the workspace's active/selected plan.
- Successful checkout updates `app_shell_workspace_plans` or equivalent billing state.
- Webhooks are signed and idempotent.
- Webhook event ledger records processed events.
- Billing portal opens for a subscribed workspace.
- Free/grant-only plans do not require Stripe customer/subscription.
- Cross-workspace checkout and portal access are rejected.
- Missing Stripe secrets fail gracefully with actionable UI/admin diagnostics.
- Production setup doc remains accurate after validation.

Suggested implementation prompt:

```text
Read docs/MVP_HANDOFF_REQUIREMENTS.md, docs/STRIPE_MVP_HANDOFF.md, and docs/STRIPE_PRODUCTION_SETUP.md. Complete and validate Stripe monetization for SurveyFlow: plan sync, product/price persistence, checkout, billing portal, signed webhook handling, event idempotency, workspace scoping, and UI diagnostics. Do not ask for secrets in chat; tell the user where each key belongs in Cloudflare/Stripe. Run focused tests/build and document any remaining manual Stripe dashboard steps.
```

### 3. Workspace Settings

Status: screen exists, mostly foundation.

Goal:

Create a real editable workspace settings page persisted in Supabase. This should cover the reusable app-shell settings any future SaaS app will need.

Likely files:

- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/app/dashboard/settings/page.tsx`
- Workspace settings APIs, if already present, or new route under `/app/api/...`
- Workspace schema migrations for settings columns/tables as needed.

Acceptance criteria:

- Workspace owner/admin can edit workspace name/display name.
- Workspace owner/admin can edit basic branding fields used by the shell.
- Workspace owner/admin can edit contact/support email if applicable.
- Settings persist to Supabase.
- Settings refresh in header/nav/dashboard without hard refresh where reasonable.
- Non-admin members cannot edit settings.
- Platform owner workspace view can inspect settings but still records context/audit.
- Design stays minimal and consistent with the current shell.

Suggested implementation prompt:

```text
Read docs/MVP_HANDOFF_REQUIREMENTS.md and inspect app/dashboard/settings/page.tsx plus workspace schema/API patterns. Finish Workspace Settings with persisted Supabase-backed editable settings, permission enforcement, workspace scoping, and shell refresh behavior. Keep the UI minimal and reusable for app-shell-template.
```

### 4. Knowledge Base

Status: desired for template and feature-gated use; likely not complete in SurveyFlow.

Goal:

Add a reusable Knowledge Base module that can be enabled/disabled by plan entitlement and feature flag.

Expected capabilities:

- Knowledge Base page in workspace nav when enabled.
- Collections CRUD.
- Articles CRUD.
- Status: draft/published/archived.
- Public/help-center view can be scaffolded if needed.
- Feature gating via entitlement and flags.
- Template inclusion so future apps can use it without rebuilding.

Likely locations to create or inspect:

- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/app/dashboard/knowledge-base/page.tsx`
- New APIs under `/app/api/knowledge-base/...`
- New Supabase migrations for collections/articles.
- Feature registry seed rows in migrations.
- Template equivalent files in `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/app-shell-template`

Acceptance criteria:

- Workspace owner/admin can create, edit, publish, archive, delete articles.
- Workspace owner/admin can create/edit/delete collections.
- Knowledge Base nav item appears only when enabled or shows locked state according to feature access behavior.
- Knowledge Base data is workspace-scoped.
- Feature registry includes entitlement, related flags, and permissions.
- Template has docs and reusable implementation pattern.

Suggested implementation prompt:

```text
Read docs/MVP_HANDOFF_REQUIREMENTS.md and docs/FEATURE_ACCESS_FRAMEWORK.md. Build the Knowledge Base MVP as a reusable, feature-gated app-shell module with collections, articles, draft/published/archive status, workspace-scoped Supabase persistence, nav gating, and template backfill.
```

### 5. API Platform And Docs

Status: API Docs page exists, but endpoint registry/OpenAPI/documentation workflow needs completion.

Goal:

Build platform-level API registry and user-facing API docs similar in capability to the reference support tool, while using SurveyFlow's own routes and product concepts.

Expected capabilities:

- Platform admin endpoint registry.
- Endpoint visibility: public/internal/admin-only.
- Endpoint doc status: documented/undocumented.
- Categories.
- Useful API docs page for workspace users.
- OpenAPI JSON generation or at least downloadable route metadata.
- Copyable auth examples.
- API key guidance if API keys exist or are planned.

Likely files:

- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/survey-flow/app/dashboard/api-docs/page.tsx`
- New `/app/admin/api-endpoints/page.tsx` or equivalent.
- New API registry lib/table/migration.
- Any existing route metadata helpers.

Acceptance criteria:

- Platform owner can view all registered endpoints.
- Platform owner can edit endpoint category, visibility, and docs status.
- API Docs page shows clean user-facing docs.
- OpenAPI JSON endpoint exists or is clearly stubbed with useful schema.
- Public documentation does not expose internal/admin-only endpoints unless explicitly marked.
- Template includes the API registry/docs pattern.

Suggested implementation prompt:

```text
Read docs/MVP_HANDOFF_REQUIREMENTS.md. Build the API Platform MVP: platform endpoint registry, endpoint visibility/doc status/category management, user-facing API docs, OpenAPI JSON generation or structured export, and template-ready docs. Keep platform-only editing permission-gated.
```

### 6. Final Hardening

Status: still needed before calling MVP production-ready.

Focus areas:

- Workspace isolation.
- Permission audit.
- Build verification.
- Deploy verification.
- QA console useful output.
- Stripe webhook replay/idempotency.
- Survey runtime validation.

Acceptance criteria:

- Admin/platform routes reject unauthorized users.
- Workspace-scoped routes reject cross-workspace IDs.
- Public survey routes expose only intended public data.
- TY router tests cover fallback, configured outcomes, AND/OR, URL params, contact fields, scores, question answers, preferences, ranked-order, rating.
- Webhook payload remains useful and not noisy.
- Stripe webhooks cannot be replayed into duplicate state changes.
- `npm run build` passes.
- Deployment target loads the expected route after deploy.

Suggested implementation prompt:

```text
Read docs/MVP_HANDOFF_REQUIREMENTS.md and inspect app/admin/qa plus the public survey APIs. Do the final hardening pass: workspace isolation tests, permission audit, build verification, QA console output improvements, and deploy verification. Keep changes focused on preventing production bugs.
```

### 7. Template Backfill

Status: ongoing. Must happen after each reusable platform capability is stable in SurveyFlow.

Goal:

Copy the reusable shell capabilities back into `app-shell-template` so future apps do not rebuild:

- App shell nav patterns.
- Auth/workspace/role foundation.
- Plans, entitlements, flags, permissions framework.
- Feature registry with associated flags/permissions.
- Stripe plan sync and billing skeleton.
- Team management.
- Workspace settings.
- Knowledge Base module.
- API registry/docs module.
- QA console pattern.
- AI Studio migration documentation.
- Supabase and Cloudflare setup checklist.

Likely template location:

- `/Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/app-shell-template`

Acceptance criteria:

- Template includes docs explaining how to configure each feature.
- Template includes migrations or migration templates.
- Template includes clear `.env.example` or setup checklist.
- Template tells future agents what IDs and env vars to ask the user for.
- SurveyFlow-specific copy/product names are removed or parameterized.
- A new app can be generated from the template and know how to configure Stripe, Supabase, Cloudflare, roles, flags, entitlements, and app navigation.

Suggested implementation prompt:

```text
Read docs/MVP_HANDOFF_REQUIREMENTS.md and identify reusable platform work completed in SurveyFlow. Backfill the same patterns into /Users/mikehilton/Documents/Segment Smarter (SurveyFlow)/app-shell-template with template-safe naming, setup docs, env var checklist, Supabase/Cloudflare/Stripe instructions, and agent-facing migration notes.
```

## Stripe Setup Notes

Do not ask the user to paste Stripe secrets into chat.

Expected Cloudflare variables/secrets:

- `STRIPE_SECRET_KEY` as encrypted secret.
- `STRIPE_WEBHOOK_SECRET` as encrypted secret.
- `SUPABASE_SERVICE_ROLE_KEY` as encrypted secret.
- `NEXT_PUBLIC_APP_URL=https://survey-flow.steep-field-929d.workers.dev`

Webhook endpoint:

```text
https://survey-flow.steep-field-929d.workers.dev/api/webhooks/stripe
```

Webhook events to validate should include checkout completion and subscription lifecycle events. See `docs/STRIPE_PRODUCTION_SETUP.md` for the current event list and setup steps.

Stripe validation checklist:

1. Confirm Cloudflare secrets are set.
2. Confirm a paid plan exists in `/admin/plans`.
3. Sync the plan to Stripe.
4. Verify Product ID and Price IDs are written back to Supabase.
5. Start checkout from workspace Billing.
6. Complete test Checkout.
7. Confirm webhook returns 200 in Stripe Workbench.
8. Confirm workspace billing state updates in Supabase.
9. Open billing portal.
10. Test cancellation/update path.
11. Replay webhook and confirm idempotency.

## Recommended New-Chat Task Order

Use this order unless the user says otherwise:

1. Confirm the stabilization commit from 2026-07-28 is present.
2. Hardening: auth, permissions, and workspace isolation.
3. Hardening: happy-path workflow tests.
4. Fill Feature QA coverage gaps visible on `/admin/entitlements`.
5. Finish Stripe monetization validation.
6. Build Knowledge Base.
7. Template backfill.
8. Final deploy verification.

## Current "Done Enough" Items

These are not perfect, but they are not the biggest blockers:

- App shell header/footer/nav.
- Auth and owner bootstrap.
- Workspace creation and basic scoping.
- Plans/entitlements/flags foundations.
- Feature registry with associated flags/permissions.
- Survey dashboard and editor.
- Public survey runtime.
- This-or-That inference and ranked results.
- Thank You Page Builder foundation.
- Outcome/TY page router foundation.
- Team Management foundation.
- Workspace Settings foundation.
- API Docs and API Endpoint Registry foundation.
- QA console foundation with Platform Integration Board.
- Feature QA coverage indicators.
- Stripe foundation.

## Open Requirements To Ask Mike Later

Ask these when starting the relevant work, not all at once:

Team Management:

- Should invites send real email now, or is an invite-link MVP acceptable?
- Which roles should ship first: owner/admin/member/viewer?
- Can admins invite/remove admins, or only owners?

Workspace Settings:

- Which settings are must-have for MVP: workspace name, support email, logo, brand color, custom domain, notification preferences?
- Should settings be app-shell generic or SurveyFlow-specific?

Knowledge Base:

- Is public help center required for MVP or only admin CRUD?
- Should articles support markdown, rich text, or plain text first?
- Should AI suggested articles be stubbed or omitted for MVP?

API Platform:

- Are API keys required for MVP, or can docs ship before external API auth?
- Which endpoints should be public documentation first?
- Should OpenAPI be generated from code comments, a registry table, or a static file?

Stripe:

- Are monthly and annual prices both required for MVP?
- Should plans support trials now?
- Should upgrades/downgrades be immediate, prorated, or Stripe default?

Template:

- How generic should names be: `AppShell`, `Platform`, or product placeholders like `{{APP_NAME}}`?

## Definition Of MVP Done

MVP should be considered done when:

- A new user can sign up and create a workspace.
- The platform owner can see that workspace and inspect basic usage.
- A workspace owner can invite/manage teammates.
- A workspace owner can create and publish a survey.
- A respondent can complete the survey and land on the correct thank-you outcome.
- Responses, contact capture, rankings, and metadata are saved correctly.
- Webhooks send the useful payload.
- A workspace can subscribe to a paid plan through Stripe Checkout.
- Stripe webhook updates workspace billing state.
- The workspace can open the Stripe billing portal.
- Plan entitlements unlock/lock UI accurately.
- Workspace settings persist.
- Admin-only/platform-only pages are actually protected.
- QA console gives useful green/yellow/red output after deploy.
- The reusable parts are documented and backfilled into `app-shell-template`.

## Current Best Next Move

Start hardening with auth, permission, and workspace-isolation tests around the recently shipped platform surfaces. After that, add happy-path QA coverage for Team Management, Workspace Settings, API Endpoint Registry saves, and OpenAPI access by user type. Stripe live validation remains the next major product workflow after platform hardening.
