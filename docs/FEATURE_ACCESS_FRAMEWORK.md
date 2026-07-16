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
- `app_shell_feature_registry`: DB-backed catalog of sellable/grantable features.
- `app_shell_limit_types`: DB-backed catalog of reusable meters and limits.
- `app_shell_plans`: flexible plan catalog. Plans are not limited to `free/pro/business`; create whatever plan records the business needs.
- `app_shell_plan_features`: feature entitlements per plan, linked to the feature registry.
- `app_shell_plan_limits`: usage or capacity limits per plan, linked to limit types.
- `app_shell_workspace_plans`: active plan assignment per workspace, with billing cycle/status/Stripe subscription metadata.
- `app_shell_workspace_overrides`: workspace-specific feature/limit overrides.
- `app_shell_usage_counters`: current usage against limits.
- `app_shell_audit_log`: server-side audit trail for platform admin changes.

All admin writes go through server routes. Never expose `SUPABASE_SERVICE_ROLE_KEY` to client code.

## Code Entry Points

- `config/app.config.ts`: product config, roles, permissions, feature definitions, limits, nav.
- `lib/platform/entitlements.ts`: resolves a workspace entitlement snapshot from workspace plan assignment, plan rows, registries, and workspace overrides.
- `lib/platform/feature-flags.ts`: resolves global flags, workspace flag overrides, and env overrides.
- `lib/platform/permissions.ts`: resolves inherited role permissions.
- `lib/platform/feature-access.ts`: maps product capabilities to entitlement + flags + permissions.
- `app/api/platform/admin/access/route.ts`: platform admin CRUD and diagnostics API.
- `components/platform/access-admin-console.tsx`: shared admin UI for plans, registries, flags, roles, overrides, and diagnostics.

## Adding a Gated Feature

1. Add the entitlement feature to `appConfig.features` as the code fallback/default.

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

5. Configure the feature registry and access in the shell UI.

- `/admin/flags`: create and override rollout flags.
- `/admin/plans`: create arbitrary plans, edit pricing/Stripe IDs, attach plan features, set plan limits, and assign workspace plans.
- `/admin/entitlements`: create feature registry rows, limit types, workspace overrides, and inspect access diagnostics.
- `/admin/permissions`: review role permissions and update workspace user roles.

## Plan Model

The registry tables make the app shell plan system templatizable:

- Define capabilities once in `app_shell_feature_registry`.
- Define meters once in `app_shell_limit_types`.
- Create any number of plans in `app_shell_plans`.
- Attach capabilities to plans through `app_shell_plan_features`.
- Attach meters to plans through `app_shell_plan_limits`.
- Assign each workspace its current plan through `app_shell_workspace_plans`.

`appConfig.features` and `appConfig.limits` remain useful because they give agents and fresh installs a code-reviewed default list. After the database exists, the admin UI and entitlement resolver use the DB registries as the operational source.

## Admin UI Hierarchy

Plans are the packaging layer. Entitlements are the reusable catalog.

- Use `/admin/plans` when the question is "what does this customer-facing plan include?"
- Use `/admin/plans/[id]` when editing a specific plan's basic information, pricing, Stripe IDs, included features, and limits.
- Use `/admin/entitlements` when adding or editing reusable feature and limit definitions that any plan can reference.
- Use `/admin/flags` when testing, gradually rolling out, or emergency-pausing a capability already owned by the workspace.

Do not bury plan-level choices inside the entitlement registry. A platform owner should be able to open one plan and see every moving part that applies to that plan.

## Entitlements And Flags

Entitlements are the primary source for whether a workspace owns a feature. Flags do not grant paid access; they can only allow, pause, test, or emergency-disable features that the entitlement layer says the workspace can use.

For troubleshooting, keep flags associated with the entitlement definition in `appConfig.features.associatedFlags` and `lib/platform/feature-access.ts`. This lets platform admins see the full chain:

1. Workspace plan or override grants the entitlement.
2. Associated flags are enabled globally or for that workspace.
3. The user's role has the required permission.

## Multi-Tenant Rules

- Workspaces are tenant boundaries.
- Workspace users carry roles within a workspace.
- Entitlement resolution always requires `workspaceId`; `planKey` is a fallback when no `app_shell_workspace_plans` row exists.
- Feature flags may be global or overridden by workspace.
- Workspace overrides are the support/admin escape hatch for trials, comped access, and temporary limit changes.
- Product code should never assume global access when a workspace is missing.

## Troubleshooting

Use `/admin/entitlements` and the Access Diagnostics section to see why a workspace can or cannot use a capability. Use `/admin/plans` to inspect or change what a plan grants. A feature is available only when:

- The entitlement is enabled for the workspace plan or workspace override.
- Every associated flag resolves to enabled for the workspace.
- The user's role has every required permission.

Keep flags associated with entitlements in the registry even when flags do not automatically turn entitlements on. That association makes support and rollout troubleshooting visible.
