# Platform Workspace Admin

SurveyFlow includes a platform-owner workspace console at `Platform Admin -> Workspaces`.

This page is intentionally limited to platform admins. Workspace owners should not see this menu item or the backing API data.

## What It Shows

- Every workspace for the current application key.
- Workspace owners and users.
- Current plan or edition.
- Survey counts by status.
- Response counts, including completed, partial, test, and official responses.
- View totals from published surveys.
- Telemetry counts.
- Webhook delivery counts and failures.
- Recent audit events.
- Usage counters from the app shell usage table.

The page combines shared app-shell tables with SurveyFlow-specific tables:

- `app_shell_workspaces`
- `app_shell_workspace_users`
- `app_shell_workspace_plans`
- `app_shell_plans`
- `app_shell_usage_counters`
- `app_shell_audit_log`
- `surveyflow_surveys`
- `surveyflow_responses`
- `surveyflow_telemetry_events`
- `surveyflow_webhook_deliveries`

## Supported Actions

- Change a workspace plan or edition.
- Change a user's workspace role.
- Copy workspace IDs for support work.
- Open an audited workspace view.

## Audited Workspace View

The `View workspace` button does not silently impersonate a user session. It sets an httpOnly platform workspace-context cookie for the platform admin, then reloads the app shell against the selected workspace.

This keeps support access visible and reversible:

- The platform admin remains the authenticated actor.
- The right navigation shows that workspace context is active.
- The platform admin can exit the context from the right navigation.
- Start and end events are written to `app_shell_audit_log`.

Audit actions:

- `platform.workspace_context.start`
- `platform.workspace_context.end`

This is safer than direct cookie-swapping impersonation and preserves accountability.

## Security Notes

- The API route is guarded by `session.isPlatformAdmin`.
- Service-role Supabase access must remain server-side only.
- Platform routes should always filter by `appConfig.product.applicationKey`.
- Product-specific metrics must still filter by workspace IDs from the current application.
- Never expose Supabase service keys or raw auth cookies to the browser.

## Extending Metrics

To add another SurveyFlow metric:

1. Add the table query in `app/api/platform/admin/access/route.ts`.
2. Include the rows in `data`.
3. Fold the rows into `buildWorkspaceStats`.
4. Render the stat in `components/platform/workspace-admin-console.tsx`.
5. Add a smoke check to the QA console if the metric affects customer support decisions.

## MVP Support Flow

1. Open `Platform Admin -> Workspaces`.
2. Search for the customer's email, workspace name, or workspace ID.
3. Review plan, users, surveys, responses, webhooks, and recent activity.
4. Use `View workspace` when you need to inspect the customer workspace UI.
5. Exit workspace view from the right navigation when support is complete.
