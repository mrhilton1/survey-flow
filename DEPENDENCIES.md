# Dependencies

This template is a Next.js application shell with Supabase and Stripe integration points.

## Runtime

- Node.js 22.x recommended
- npm 10.x recommended
- Next.js 14
- React 18
- TypeScript 5
- Tailwind CSS 3
- Supabase JavaScript client
- Stripe Node SDK

## Required Services

The template can render locally without live services, but a real app needs:

- GitHub repository
- Supabase project
- Stripe account
- Deployment host such as Vercel, Cloudflare Pages, or another Next.js-capable host

## Required Environment Variables

```bash
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

GEMINI_API_KEY=
```

## Optional Environment Variables

Feature flags can be overridden without database changes:

```bash
NEXT_PUBLIC_FLAG_API_ACCESS=true
NEXT_PUBLIC_FLAG_ADVANCED_REPORTING=false
NEXT_PUBLIC_FLAG_WEBHOOKS=true
NEXT_PUBLIC_FLAG_CUSTOM_BRANDING=true
SURVEYFLOW_WEBHOOK_TIMEOUT_MS=8000
```

## Install

```bash
npm install
npm run dev
```

## Validate

```bash
npm run typecheck
npm run lint
npm run build
```

## Database

Run this file in Supabase SQL editor or through the Supabase CLI:

```txt
supabase/schema.sql
```

## Stripe

Create products/prices in Stripe, then add price IDs to:

- `app_shell_plans.stripe_monthly_price_id`
- `app_shell_plans.stripe_yearly_price_id`

The template includes checkout, portal, and webhook routes, but production apps should add webhook signature verification before launch.
