# App Shell Template Guide

This repository is meant to become a GitHub template repository. New products should start here, then replace or add app-specific modules under `app/dashboard` while keeping the platform services stable.

## Create A New App

1. Create a new repository from this template in GitHub.
2. Copy `.env.example` to `.env.local`.
3. Create a Supabase project and run `supabase/schema.sql`.
4. Update `config/app.config.ts`.
5. Add your app-specific pages under `app/dashboard`.
6. Add or remove nav items in `appConfig.nav.app`.
7. Add custom roles by duplicating a role in `appConfig.roles` and changing its permissions.

## Custom Roles

Roles are data-light and code-configured by default:

```ts
manager: {
  label: "Manager",
  inherits: ["member"],
  permissions: ["dashboard:read", "team:read", "reports:*"]
}
```

Use `permission: "reports:*"` or `permission: "team:invite"` on navigation items, pages, and API handlers.

## Entitlements

Entitlements resolve in this order:

1. Template defaults from `app.config.ts`
2. Plan rows from Supabase
3. Workspace overrides

Use this for paid features, comped access, trials, and support overrides.

## Feature Flags

Flags can be controlled by environment variables or by `app_shell_feature_flags`.

Environment override format:

```bash
NEXT_PUBLIC_FLAG_API_ACCESS=true
```

## Stripe

Stripe is wired as a production-ready seam but can run in stub mode without keys.

- Checkout: `POST /api/platform/billing/checkout`
- Portal: `POST /api/platform/billing/portal`
- Webhook: `POST /api/webhooks/stripe`

Add webhook signature validation before production launch.

## What Was Intentionally Excluded

Presence/online-away status is disabled because it was explicitly marked "No" during scoping.
