# Agent Instructions

You are working inside a reusable application shell template. Keep platform code reusable and place product-specific code in domain modules.

## First Questions To Ask The User

Before spinning up a new app from this template, ask the user for:

1. App/product name
2. Short product description
3. GitHub repository owner/name
4. Deployment target: Vercel, Cloudflare Pages, or other
5. Production app URL
6. Supabase project URL
7. Supabase anon key
8. Supabase service role key
9. Stripe publishable key
10. Stripe secret key
11. Stripe webhook secret
12. Stripe product and price IDs for each plan
13. Platform admin email addresses
14. Initial roles beyond owner/admin/member, if any
15. App-specific navigation items
16. App-specific feature gates
17. App-specific plan limits
18. Whether API keys, webhooks, email templates, integrations, push notifications, impersonation, and workspace branding should remain enabled

Do not ask for secrets in a public channel. If the environment supports secret storage, direct the user to add secrets there.

## Reusable Shell Boundaries

Keep these files generic:

- `config/app.config.ts`
- `config/runtime.config.ts`
- `components/shell/*`
- `lib/platform/*`
- `middleware.ts`
- `supabase/schema.sql`

Put app-specific code here:

- `app/dashboard/[domain-area]`
- `components/[domain-area]`
- `lib/[domain-area]`
- `supabase/migrations/[timestamp]_[domain_change].sql`

## Setup Steps For A New App

1. Clone or create a new repository from this template.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Fill environment variables from the user or secret manager.
5. Run `supabase/schema.sql` in the target Supabase project.
6. Update `config/app.config.ts` with product name, platform admins, roles, nav, features, limits, and module toggles.
7. Update `public/manifest.json` with the product name and theme color.
8. Add product-specific routes under `app/dashboard`.
9. Add product-specific services under `lib/[domain-area]`.
10. Add database migrations for product-specific tables.
11. Run `npm run typecheck`, `npm run lint`, and `npm run build`.
12. Commit changes and push to GitHub.
13. Configure deployment environment variables.
14. Deploy.

## Porting An Existing App

When moving an existing app into this shell, follow `docs/MIGRATION_PLAYBOOK.md`.

The short version:

1. Inventory source routes, models, services, integrations, and environment variables.
2. Keep platform concerns in `lib/platform`, `components/shell`, and `config`.
3. Move product-specific code into `lib/[domain]`, `components/[domain]`, `app/dashboard/[domain]`, public domain routes, and domain migrations.
4. Commit one validated vertical slice at a time.
5. Replace placeholders and dead nav routes before calling the migration done.

## Roles And Permissions

Custom roles should usually be created by copying the closest existing role in `config/app.config.ts`.

Example:

```ts
manager: {
  label: "Manager",
  inherits: ["member"],
  permissions: ["dashboard:read", "team:read", "reports:*"]
}
```

Use permissions on navigation items and server-side checks. Do not rely on hiding UI alone.

## Entitlements

Use entitlements for plan-based or workspace-specific access. Resolution order:

1. Defaults in `config/app.config.ts`
2. Plan features and limits in Supabase
3. Workspace overrides in Supabase

Use workspace overrides for comped access, trials, one-off support adjustments, or customer-specific limits.

## Feature Flags

Use feature flags for release control. Use entitlements for monetization. A feature may use both.

Environment flags use this pattern:

```bash
NEXT_PUBLIC_FLAG_FEATURE_KEY=true
```

## Stripe

The template supports Stripe checkout, billing portal, and webhooks. Before production:

1. Add Stripe webhook signature verification.
2. Map Stripe prices to plan rows.
3. Persist customer and subscription IDs.
4. Update workspace plans from webhook events.
5. Test checkout and cancellation flows in Stripe test mode.

## Security Rules

- Never commit `.env.local`.
- Never log service-role keys, Stripe secrets, webhook secrets, or customer payment data.
- Middleware protects pages, but API routes must still perform their own authorization.
- Service-role Supabase access belongs only in server-side code.
- Add row-level security policies before exposing direct browser access to new tables.

## Completion Criteria

A new app is ready when:

- Product config is updated.
- Environment variables are configured.
- Supabase schema/migrations are applied.
- Stripe test flow works or is explicitly left in stub mode.
- Role-gated navigation behaves correctly.
- Entitlement-locked navigation behaves correctly.
- `npm run typecheck`, `npm run lint`, and `npm run build` pass.
- The app is deployed and the deployed URL loads.
