# Feature Access Framework

This app shell separates access into three layers:

1. Entitlements decide what a workspace has purchased or been granted.
2. Feature flags decide whether a capability is available for rollout, testing, or emergency shutoff.
3. Permissions decide whether the current user role can use the capability inside that workspace.

The entitlement is the business source of truth. Flags should not sell or grant a feature by themselves; they are rollout controls. Permissions should not sell or grant a feature by themselves; they are actor controls.

## Supabase Tables

The framework uses the app shell tables in the private application schema:

- `app_shell_workspaces`: tenant/workspace records scoped by `application_key`.
- `app_shell_workspace_users`: workspace user membership and role assignment.
- `app_shell_feature_flags`: global flags with optional `workspace_overrides`.
- `app_shell_plans`: plan catalog.
- `app_shell_plan_features`: feature entitlements per plan.
- `app_shell_plan_limits`: usage or capacity limits per plan.
- `app_shell_workspace_overrides`: workspace-specific feature/limit overrides.
- `app_shell_usage_counters`: current usage against limits.
- `app_shell_audit_log`: server-side audit trail for platform admin changes.

All admin writes go through server routes. Never expose `SUPABASE_SERVICE_ROLE_KEY` to client code.

## Code Entry Points

- `config/app.config.ts`: product config, roles, permissions, feature definitions, limits, nav.
- `lib/platform/entitlements.ts`: resolves a workspace entitlement snapshot from plan rows plus workspace overrides.
- `lib/platform/feature-flags.ts`: resolves global flags, workspace flag overrides, and env overrides.
- `lib/platform/permissions.ts`: resolves inherited role permissions.
- `lib/platform/feature-access.ts`: maps product capabilities to entitlement + flags + permissions.
- `app/api/platform/admin/access/route.ts`: platform admin CRUD and diagnostics API.
- `components/platform/access-admin-console.tsx`: shared admin UI for flags, entitlements, roles, and diagnostics.

## Adding a Gated Feature

1. Add the entitlement feature to `appConfig.features`.

```ts
{
  key: "thank_you_pages.custom_builder",
  label: "Thank You Page Builder",
  defaultEnabled: false,
  lockedBehavior: "show_locked",
  associatedFlags: ["thank_you_builder_enabled"],
  requiredPermissions: ["survey_thank_you_pages:manage"]
}
```

2. Add the permission to the role definitions in `appConfig.roles`.

```ts
owner: {
  permissions: ["survey_thank_you_pages:*"]
},
admin: {
  permissions: ["survey_thank_you_pages:manage"]
}
```

3. Add a feature access definition in `lib/platform/feature-access.ts`.

```ts
{
  key: "thank_you_builder",
  label: "Thank You Page Builder",
  entitlement: "thank_you_pages.custom_builder",
  flags: ["thank_you_builder_enabled", "thank_you_builder_runtime_enabled"],
  permissions: ["survey_thank_you_pages:manage"],
  fallback: "generic_thank_you_page",
  description: "Allows a workspace to create and render custom thank-you pages."
}
```

4. Gate application code with `canUseFeature`.

```ts
const decision = await canUseFeature(session, "thank_you_builder")
if (!decision.allowed) {
  // Show locked state, hide action, or use decision.fallback.
}
```

5. Configure access in the shell UI.

- `/admin/flags`: create and override rollout flags.
- `/admin/entitlements`: create plans, toggle plan features, set plan limits, and add workspace overrides.
- `/admin/permissions`: review role permissions and update workspace user roles.

## Multi-Tenant Rules

- Workspaces are tenant boundaries.
- Workspace users carry roles within a workspace.
- Entitlement resolution always requires `workspaceId` and `planKey`.
- Feature flags may be global or overridden by workspace.
- Workspace overrides are the support/admin escape hatch for trials, comped access, and temporary limit changes.
- Product code should never assume global access when a workspace is missing.

## Troubleshooting

Use `/admin/entitlements` and the Access Diagnostics section to see why a workspace can or cannot use a capability. A feature is available only when:

- The entitlement is enabled for the workspace plan or workspace override.
- Every associated flag resolves to enabled for the workspace.
- The user's role has every required permission.

Keep flags associated with entitlements in the registry even when flags do not automatically turn entitlements on. That association makes support and rollout troubleshooting visible.
