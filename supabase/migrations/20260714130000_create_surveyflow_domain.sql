create extension if not exists "pgcrypto";
create schema if not exists survey_flow;
grant usage on schema survey_flow to anon, authenticated, service_role;
set search_path = survey_flow, public;

create table if not exists surveyflow_surveys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references app_shell_workspaces(id) on delete cascade,
  owner_user_id uuid not null references app_shell_workspace_users(id) on delete cascade,
  name text not null,
  description text not null default '',
  seo_description text,
  questions jsonb not null default '[]'::jsonb,
  style jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'testing', 'published')),
  responses_count integer not null default 0,
  views_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists surveyflow_surveys_workspace_idx on surveyflow_surveys(workspace_id);
create index if not exists surveyflow_surveys_owner_idx on surveyflow_surveys(owner_user_id);
create index if not exists surveyflow_surveys_status_idx on surveyflow_surveys(status);
create index if not exists surveyflow_surveys_updated_idx on surveyflow_surveys(updated_at desc);

create table if not exists surveyflow_responses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references app_shell_workspaces(id) on delete cascade,
  survey_id uuid not null references surveyflow_surveys(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  scores jsonb not null default '{}'::jsonb,
  total_score numeric,
  status text not null default 'partial' check (status in ('partial', 'completed')),
  is_test boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists surveyflow_responses_workspace_idx on surveyflow_responses(workspace_id);
create index if not exists surveyflow_responses_survey_idx on surveyflow_responses(survey_id);
create index if not exists surveyflow_responses_status_idx on surveyflow_responses(status);
create index if not exists surveyflow_responses_submitted_idx on surveyflow_responses(submitted_at desc);
create index if not exists surveyflow_responses_test_idx on surveyflow_responses(is_test);

create table if not exists surveyflow_telemetry_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references app_shell_workspaces(id) on delete cascade,
  survey_id uuid not null references surveyflow_surveys(id) on delete cascade,
  question_id text,
  type text not null check (type in ('error', 'submit_attempt', 'save_progress_error', 'other')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists surveyflow_telemetry_workspace_idx on surveyflow_telemetry_events(workspace_id);
create index if not exists surveyflow_telemetry_survey_idx on surveyflow_telemetry_events(survey_id);
create index if not exists surveyflow_telemetry_created_idx on surveyflow_telemetry_events(created_at desc);
create index if not exists surveyflow_telemetry_type_idx on surveyflow_telemetry_events(type);

create table if not exists surveyflow_webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references app_shell_workspaces(id) on delete cascade,
  survey_id uuid not null references surveyflow_surveys(id) on delete cascade,
  response_id uuid references surveyflow_responses(id) on delete set null,
  target_url text not null,
  status text not null default 'pending' check (status in ('pending', 'delivered', 'failed')),
  request_payload jsonb not null default '{}'::jsonb,
  response_status integer,
  response_body text,
  error_message text,
  attempted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists surveyflow_webhooks_workspace_idx on surveyflow_webhook_deliveries(workspace_id);
create index if not exists surveyflow_webhooks_survey_idx on surveyflow_webhook_deliveries(survey_id);
create index if not exists surveyflow_webhooks_response_idx on surveyflow_webhook_deliveries(response_id);
create index if not exists surveyflow_webhooks_status_idx on surveyflow_webhook_deliveries(status);

insert into app_shell_plan_features (plan_key, feature_key, enabled)
values
  ('free', 'survey_builder', true),
  ('free', 'survey_publishing', true),
  ('free', 'ai_reports', false),
  ('free', 'advanced_analytics', false),
  ('free', 'webhook_delivery', false),
  ('free', 'custom_tracking', false),
  ('pro', 'survey_builder', true),
  ('pro', 'survey_publishing', true),
  ('pro', 'ai_reports', true),
  ('pro', 'advanced_analytics', true),
  ('pro', 'webhook_delivery', true),
  ('pro', 'custom_tracking', false),
  ('business', 'survey_builder', true),
  ('business', 'survey_publishing', true),
  ('business', 'ai_reports', true),
  ('business', 'advanced_analytics', true),
  ('business', 'webhook_delivery', true),
  ('business', 'custom_tracking', true)
on conflict (plan_key, feature_key) do update set enabled = excluded.enabled;

insert into app_shell_plan_limits (plan_key, limit_key, limit_value)
values
  ('free', 'surveys', '3'),
  ('free', 'responses_monthly', '250'),
  ('free', 'ai_reports_monthly', '0'),
  ('free', 'webhook_deliveries_monthly', '0'),
  ('pro', 'surveys', '25'),
  ('pro', 'responses_monthly', '5000'),
  ('pro', 'ai_reports_monthly', '50'),
  ('pro', 'webhook_deliveries_monthly', '5000'),
  ('business', 'surveys', 'unlimited'),
  ('business', 'responses_monthly', 'unlimited'),
  ('business', 'ai_reports_monthly', 'unlimited'),
  ('business', 'webhook_deliveries_monthly', 'unlimited')
on conflict (plan_key, limit_key) do update set limit_value = excluded.limit_value;

alter table surveyflow_surveys enable row level security;
alter table surveyflow_responses enable row level security;
alter table surveyflow_telemetry_events enable row level security;
alter table surveyflow_webhook_deliveries enable row level security;

grant all on all tables in schema survey_flow to service_role;
grant all on all sequences in schema survey_flow to service_role;
