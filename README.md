# SurveyFlow AI Template Test

SurveyFlow AI migrated into the reusable Next.js app shell template.

Platform shell included:

- Sticky header, footer, dashboard shell, admin shell
- Right-side hamburger navigation
- Workspaces and workspace switching placeholder
- Customizable roles and permissions
- Platform super-admin support
- Middleware route protection
- Supabase-backed session model
- Invites schema
- Entitlements: plans, features, limits, overrides, comped access
- Global and workspace feature flags
- Stripe checkout, portal, and webhook routes
- API key/webhook/email/integration module toggles
- PWA manifest and push-notification-ready module flag

SurveyFlow foundation included:

- SurveyFlow product config
- SurveyFlow permissions, features, and limits
- Survey domain types and defaults
- Survey, response, telemetry, and webhook Supabase migration
- Authenticated survey API skeletons
- Public survey and response API skeletons
- Server-side Gemini AI report route

Presence is intentionally disabled in `config/app.config.ts`.

## Start

```bash
npm install
npm run dev
```

## Configure

Most new-app customization starts in:

```txt
config/app.config.ts
```

Run this in Supabase:

```txt
supabase/schema.sql
```

See `docs/TEMPLATE_GUIDE.md` for the GitHub template workflow.

Agent handoff files:

- `AGENTS.md`
- `DEPENDENCIES.md`

Optional GitHub Actions workflow template:

- `docs/github-actions-validate.yml`
