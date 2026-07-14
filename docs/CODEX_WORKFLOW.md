# Codex Workflow

Use this repository as the reference shell when creating a new product.

## Prompt Pattern

```txt
Create a new app from my app-shell-template repository.

Use the shell as-is for:
- auth
- workspaces
- roles
- permissions
- navigation
- entitlements
- feature flags
- Stripe billing
- platform admin

Use the following code/use cases as the app-specific domain context:
[paste or point to the new code]

Keep platform-shell code separate from domain modules.
Only add domain pages under app/dashboard or a clearly named app module folder.
```

## Where Domain Code Goes

- `app/dashboard/[domain-area]`
- `components/[domain-area]`
- `lib/[domain-area]`

Keep reusable shell code in:

- `components/shell`
- `lib/platform`
- `config/app.config.ts`

## How To Add A New App Feature

1. Add the route under `app/dashboard`.
2. Add a feature key to `appConfig.features` if it should be paid or gated.
3. Add a permission to the appropriate role in `appConfig.roles`.
4. Add a nav item to `appConfig.nav.app`.
5. Add Supabase tables in a new migration file.

## How To Add A Custom Role

Duplicate the closest existing role:

```ts
manager: {
  label: "Manager",
  inherits: ["member"],
  permissions: ["dashboard:read", "team:read", "reports:*"]
}
```

Then assign that role in `app_shell_workspace_users.role`.
