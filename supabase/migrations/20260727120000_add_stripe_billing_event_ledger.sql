set search_path = survey_flow, public;

alter table app_shell_workspace_plans
  add column if not exists cancel_at timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists latest_invoice_status text;

create table if not exists app_shell_stripe_events (
  id uuid primary key default gen_random_uuid(),
  application_key text not null default 'survey-flow',
  workspace_id uuid references app_shell_workspaces(id) on delete set null,
  stripe_event_id text not null unique,
  event_type text not null,
  status text not null default 'processing' check (status in ('processing', 'processed', 'failed')),
  payload jsonb not null,
  error text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists app_shell_stripe_events_workspace_created_idx
  on app_shell_stripe_events (workspace_id, created_at desc);

alter table app_shell_stripe_events enable row level security;
grant all on app_shell_stripe_events to service_role;
