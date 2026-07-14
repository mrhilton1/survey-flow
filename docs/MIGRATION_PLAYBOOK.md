# Existing App Migration Playbook

Use this when an agent is asked to move an existing app into the reusable shell.

## Discovery

1. Identify the source app framework, package manager, auth provider, database, payments, AI services, and deployment target.
2. Inventory product routes, API routes, data models, background jobs, webhooks, and environment variables.
3. Separate platform concerns from domain concerns:
   - Platform: auth, workspaces, roles, permissions, navigation, entitlements, feature flags, billing, admin.
   - Domain: product screens, product tables, product APIs, integrations, analytics, reports.
4. Write a migration checklist before editing code.

## Porting Order

1. Configure shell product identity in `config/app.config.ts`, `config/runtime.config.ts`, and `public/manifest.json`.
2. Add domain types, defaults, scoring/utility functions, and database helpers under `lib/[domain]`.
3. Add Supabase migrations for domain tables.
4. Add server API routes before client UI.
5. Port the main authenticated dashboard list.
6. Port create/edit workflows.
7. Port public or external-facing workflows.
8. Port analytics/reports.
9. Port integrations such as AI, webhooks, email, imports, or exports.
10. Tighten permissions, entitlement gates, counters, duplicate guards, and operational visibility.
11. Replace placeholders and dead nav targets.
12. Write migration notes for future agents.

## Commit Strategy

Commit one vertical slice at a time. A good slice should pass:

```bash
npm run typecheck
npm run lint
npm run build
```

Recommended commit sequence:

1. Domain foundation
2. Dashboard/list shell
3. Editor or primary creation flow
4. Public/end-user flow
5. Reports/analytics
6. Integrations
7. Permissions and correctness
8. Polish and docs

## Questions For The User

Ask these before connecting a real environment:

1. What GitHub repo should receive the migrated app?
2. What production URL should the app assume?
3. What Supabase project URL and anon key should be public?
4. What Supabase service role key should be added to server secrets?
5. Which emails are platform admins?
6. Which roles should exist beyond owner/admin/member?
7. Which features should be plan-gated?
8. What Stripe product and price IDs map to each plan?
9. Should Stripe remain in stub mode for now?
10. Which third-party integrations need live keys?
11. Which public routes must be unauthenticated?
12. Which legacy data needs to be imported?

Never ask the user to paste secrets into committed files.

## SurveyFlow AI Migration Status

This test migration moved SurveyFlow AI from a Firebase/Vite source app into the shell as a Next.js/Supabase module.

Implemented:

- Survey domain schema and APIs
- Survey dashboard
- Survey editor
- Public survey-taking flow
- Response reports and CSV export
- Gemini-backed AI report endpoint and UI trigger
- Public telemetry capture and admin visibility
- Webhook delivery and delivery history
- Dashboard hubs for responses and AI reports
- Shell navigation cleanup

Still requires a live environment before production:

- Run `supabase/schema.sql` and `supabase/migrations/20260714130000_create_surveyflow_domain.sql`.
- Add real Supabase and Stripe environment variables.
- Add `GEMINI_API_KEY` if AI reports should generate.
- Confirm Stripe plan and entitlement rows.
- Submit a real public survey response and verify response, telemetry, webhook, and report views.
- Decide whether legacy Firebase data should be imported.
