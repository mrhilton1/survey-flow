set search_path = survey_flow, public;

create table if not exists app_shell_api_endpoints (
  id uuid primary key default gen_random_uuid(),
  application_key text not null default 'survey-flow',
  route_key text not null,
  method text not null,
  path text not null,
  title text not null,
  summary text,
  category text not null default 'General',
  visibility text not null default 'internal' check (visibility in ('public', 'internal', 'admin_only')),
  doc_status text not null default 'documented' check (doc_status in ('documented', 'undocumented', 'draft')),
  auth_type text not null default 'workspace_session',
  request_schema jsonb not null default '{}'::jsonb,
  response_schema jsonb not null default '{}'::jsonb,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_key, route_key)
);

alter table app_shell_api_endpoints enable row level security;

grant all on app_shell_api_endpoints to service_role;

insert into app_shell_api_endpoints (application_key, route_key, method, path, title, summary, category, visibility, doc_status, auth_type, display_order)
values
  ('survey-flow', 'get-surveys', 'GET', '/api/surveys', 'List surveys', 'Returns surveys for the authenticated workspace.', 'Surveys', 'internal', 'documented', 'workspace_session', 10),
  ('survey-flow', 'create-survey', 'POST', '/api/surveys', 'Create survey', 'Creates a survey in the authenticated workspace.', 'Surveys', 'internal', 'documented', 'workspace_session', 20),
  ('survey-flow', 'get-survey', 'GET', '/api/surveys/{id}', 'Get survey', 'Returns one workspace-scoped survey.', 'Surveys', 'internal', 'documented', 'workspace_session', 30),
  ('survey-flow', 'update-survey', 'PATCH', '/api/surveys/{id}', 'Update survey', 'Updates one workspace-scoped survey.', 'Surveys', 'internal', 'documented', 'workspace_session', 40),
  ('survey-flow', 'delete-survey', 'DELETE', '/api/surveys/{id}', 'Delete survey', 'Deletes one workspace-scoped survey.', 'Surveys', 'internal', 'documented', 'workspace_session', 50),
  ('survey-flow', 'list-responses', 'GET', '/api/surveys/{id}/responses', 'List responses', 'Returns responses for one workspace-scoped survey.', 'Responses', 'internal', 'documented', 'workspace_session', 60),
  ('survey-flow', 'delete-response', 'DELETE', '/api/surveys/{id}/responses/{responseId}', 'Delete response', 'Deletes one response from a workspace-scoped survey.', 'Responses', 'internal', 'documented', 'workspace_session', 70),
  ('survey-flow', 'create-ai-report', 'POST', '/api/surveys/{id}/ai-report', 'Create AI report', 'Generates an AI report for one workspace-scoped survey.', 'Reports', 'internal', 'documented', 'workspace_session', 80),
  ('survey-flow', 'get-public-survey', 'GET', '/api/public/surveys/{id}', 'Get public survey', 'Returns the public runtime payload for a published survey.', 'Public Survey', 'public', 'documented', 'public', 90),
  ('survey-flow', 'submit-public-response', 'POST', '/api/public/surveys/{id}/responses', 'Submit survey response', 'Submits a public response for a published survey.', 'Public Survey', 'public', 'documented', 'public', 100),
  ('survey-flow', 'record-public-telemetry', 'POST', '/api/public/telemetry', 'Record public telemetry', 'Records public survey telemetry events.', 'Public Survey', 'public', 'documented', 'public', 110),
  ('survey-flow', 'get-session', 'GET', '/api/auth/session', 'Get session', 'Returns the current app shell session.', 'Auth', 'internal', 'documented', 'workspace_session', 120),
  ('survey-flow', 'billing-checkout', 'POST', '/api/platform/billing/checkout', 'Start billing checkout', 'Starts Stripe Checkout for the authenticated workspace.', 'Billing', 'internal', 'documented', 'workspace_session', 130),
  ('survey-flow', 'billing-portal', 'POST', '/api/platform/billing/portal', 'Open billing portal', 'Creates a Stripe Customer Portal session for the authenticated workspace.', 'Billing', 'internal', 'documented', 'workspace_session', 140),
  ('survey-flow', 'workspace-settings', 'POST', '/api/dashboard/settings', 'Update workspace settings', 'Updates workspace identity and contact settings.', 'Workspace', 'internal', 'documented', 'workspace_session', 150),
  ('survey-flow', 'team-management', 'POST', '/api/dashboard/team', 'Manage team', 'Invites users, updates roles, removes members, and cancels invites.', 'Workspace', 'internal', 'documented', 'workspace_session', 160),
  ('survey-flow', 'platform-access-admin', 'GET', '/api/platform/admin/access', 'Platform access registry', 'Returns platform owner access, billing, entitlement, and workspace diagnostics.', 'Platform Admin', 'admin_only', 'documented', 'platform_admin', 900),
  ('survey-flow', 'stripe-webhook', 'POST', '/api/webhooks/stripe', 'Stripe webhook', 'Receives signed Stripe billing events.', 'Webhooks', 'admin_only', 'documented', 'stripe_signature', 910)
on conflict (application_key, route_key) do update
set method = excluded.method,
    path = excluded.path,
    title = excluded.title,
    summary = excluded.summary,
    category = excluded.category,
    visibility = excluded.visibility,
    doc_status = excluded.doc_status,
    auth_type = excluded.auth_type,
    display_order = excluded.display_order,
    updated_at = now();
