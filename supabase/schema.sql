create extension if not exists "pgcrypto";
create schema if not exists survey_flow;
grant usage on schema survey_flow to anon, authenticated, service_role;
set search_path = survey_flow, public;

create table if not exists app_shell_workspaces (
  id uuid primary key default gen_random_uuid(),
  application_key text not null default 'survey-flow',
  name text not null,
  slug text not null unique,
  plan_key text not null default 'free',
  stripe_customer_id text,
  created_at timestamptz not null default now()
);

create table if not exists app_shell_workspace_users (
  id uuid primary key default gen_random_uuid(),
  application_key text not null default 'survey-flow',
  auth_user_id uuid references auth.users(id) on delete cascade,
  workspace_id uuid not null references app_shell_workspaces(id) on delete cascade,
  email text not null,
  display_name text,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  unique (workspace_id, email)
);

create table if not exists app_shell_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references app_shell_workspaces(id) on delete cascade,
  email text not null,
  role text not null default 'member',
  token text not null unique,
  accepted_at timestamptz,
  expires_at timestamptz not null default now() + interval '14 days',
  created_at timestamptz not null default now()
);

create table if not exists app_shell_feature_flags (
  flag_key text primary key,
  enabled boolean not null default true,
  workspace_overrides jsonb not null default '{}'::jsonb,
  description text,
  updated_at timestamptz not null default now()
);

create table if not exists app_shell_plans (
  plan_key text primary key,
  name text not null,
  stripe_monthly_price_id text,
  stripe_yearly_price_id text,
  active boolean not null default true
);

create table if not exists app_shell_plan_features (
  plan_key text not null references app_shell_plans(plan_key) on delete cascade,
  feature_key text not null,
  enabled boolean not null default false,
  primary key (plan_key, feature_key)
);

create table if not exists app_shell_plan_limits (
  plan_key text not null references app_shell_plans(plan_key) on delete cascade,
  limit_key text not null,
  limit_value text not null,
  primary key (plan_key, limit_key)
);

create table if not exists app_shell_workspace_overrides (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references app_shell_workspaces(id) on delete cascade,
  target_type text not null check (target_type in ('feature', 'limit')),
  target_key text not null,
  override_value text not null,
  reason text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists app_shell_usage_counters (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references app_shell_workspaces(id) on delete cascade,
  counter_key text not null,
  used_value integer not null default 0,
  period_start date not null default date_trunc('month', now())::date,
  period_end date not null default (date_trunc('month', now()) + interval '1 month - 1 day')::date,
  unique (workspace_id, counter_key, period_start)
);

create table if not exists app_shell_audit_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references app_shell_workspaces(id) on delete set null,
  actor_user_id uuid references app_shell_workspace_users(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into app_shell_plans (plan_key, name)
values ('free', 'Free'), ('pro', 'Pro'), ('business', 'Business')
on conflict (plan_key) do nothing;

insert into app_shell_plan_features (plan_key, feature_key, enabled)
values
  ('free', 'api_access', false),
  ('free', 'advanced_reporting', false),
  ('free', 'webhooks', false),
  ('free', 'custom_branding', false),
  ('pro', 'api_access', true),
  ('pro', 'advanced_reporting', true),
  ('pro', 'webhooks', true),
  ('pro', 'custom_branding', false),
  ('business', 'api_access', true),
  ('business', 'advanced_reporting', true),
  ('business', 'webhooks', true),
  ('business', 'custom_branding', true)
on conflict (plan_key, feature_key) do update set enabled = excluded.enabled;

insert into app_shell_plan_limits (plan_key, limit_key, limit_value)
values
  ('free', 'team_members', '2'),
  ('free', 'api_requests_monthly', '1000'),
  ('free', 'workspaces', '1'),
  ('pro', 'team_members', '10'),
  ('pro', 'api_requests_monthly', '50000'),
  ('pro', 'workspaces', '3'),
  ('business', 'team_members', 'unlimited'),
  ('business', 'api_requests_monthly', 'unlimited'),
  ('business', 'workspaces', 'unlimited')
on conflict (plan_key, limit_key) do update set limit_value = excluded.limit_value;

alter table app_shell_workspaces enable row level security;
alter table app_shell_workspace_users enable row level security;
alter table app_shell_invites enable row level security;
alter table app_shell_feature_flags enable row level security;
alter table app_shell_plans enable row level security;
alter table app_shell_plan_features enable row level security;
alter table app_shell_plan_limits enable row level security;
alter table app_shell_workspace_overrides enable row level security;
alter table app_shell_usage_counters enable row level security;
alter table app_shell_audit_log enable row level security;

grant all on all tables in schema survey_flow to service_role;
grant all on all sequences in schema survey_flow to service_role;

create table if not exists app_shell_feature_registry (
  id uuid primary key default gen_random_uuid(),
  application_key text not null default 'survey-flow',
  feature_key text not null,
  feature_name text not null,
  description text,
  category text not null default 'General',
  display_order integer not null default 0,
  icon text,
  purchase_type text not null default 'plan_only',
  locked_behavior text not null default 'show_locked',
  associated_flags text[] not null default '{}'::text[],
  required_permissions text[] not null default '{}'::text[],
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_key, feature_key)
);

create table if not exists app_shell_limit_types (
  id uuid primary key default gen_random_uuid(),
  application_key text not null default 'survey-flow',
  limit_key text not null,
  limit_name text not null,
  description text,
  category text not null default 'General',
  unit text not null default 'count',
  unit_label text,
  is_unlimited_available boolean not null default true,
  overage_enabled boolean not null default false,
  overage_unit_price numeric(12, 4),
  display_order integer not null default 0,
  icon text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_key, limit_key)
);

alter table app_shell_plans
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists application_key text not null default 'survey-flow',
  add column if not exists description text,
  add column if not exists status text not null default 'active',
  add column if not exists price_monthly numeric(12, 2),
  add column if not exists price_yearly numeric(12, 2),
  add column if not exists currency text not null default 'usd',
  add column if not exists stripe_product_id text,
  add column if not exists display_order integer not null default 0,
  add column if not exists is_featured boolean not null default false,
  add column if not exists badge_text text,
  add column if not exists trial_days integer not null default 0,
  add column if not exists version integer not null default 1,
  add column if not exists parent_plan_id uuid,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists app_shell_plans_id_key on app_shell_plans(id);
create unique index if not exists app_shell_plans_application_plan_key on app_shell_plans(application_key, plan_key);

alter table app_shell_plan_features
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists application_key text not null default 'survey-flow',
  add column if not exists plan_id uuid references app_shell_plans(id) on delete cascade,
  add column if not exists feature_id uuid references app_shell_feature_registry(id) on delete cascade,
  add column if not exists is_included boolean,
  add column if not exists limited_access boolean not null default false,
  add column if not exists access_limit integer,
  add column if not exists access_limit_period text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table app_shell_plan_limits
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists application_key text not null default 'survey-flow',
  add column if not exists plan_id uuid references app_shell_plans(id) on delete cascade,
  add column if not exists limit_type_id uuid references app_shell_limit_types(id) on delete cascade,
  add column if not exists is_unlimited boolean not null default false,
  add column if not exists pricing_tiers jsonb not null default '[]'::jsonb,
  add column if not exists overage_price numeric(12, 4),
  add column if not exists overage_enabled boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists app_shell_workspace_plans (
  id uuid primary key default gen_random_uuid(),
  application_key text not null default 'survey-flow',
  workspace_id uuid not null references app_shell_workspaces(id) on delete cascade,
  plan_id uuid references app_shell_plans(id) on delete set null,
  plan_key text not null default 'free',
  billing_cycle text not null default 'monthly',
  status text not null default 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at timestamptz,
  cancel_at_period_end boolean not null default false,
  latest_invoice_status text,
  stripe_customer_id text,
  stripe_subscription_id text,
  trial_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id)
);

create table if not exists app_shell_stripe_events (
  id uuid primary key default gen_random_uuid(),
  application_key text not null default 'survey-flow',
  workspace_id uuid references app_shell_workspaces(id) on delete set null,
  stripe_event_id text not null unique,
  event_type text not null,
  status text not null default 'processing',
  payload jsonb not null,
  error text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table app_shell_stripe_events enable row level security;
grant all on app_shell_stripe_events to service_role;

alter table app_shell_workspace_overrides
  add column if not exists application_key text not null default 'survey-flow',
  add column if not exists feature_id uuid references app_shell_feature_registry(id) on delete set null,
  add column if not exists limit_type_id uuid references app_shell_limit_types(id) on delete set null,
  add column if not exists expires_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

insert into app_shell_feature_registry (application_key, feature_key, feature_name, category, display_order, associated_flags, required_permissions, is_active)
values
  ('survey-flow', 'api_access', 'API Access', 'Platform', 10, '{}'::text[], '{}'::text[], true),
  ('survey-flow', 'survey_builder', 'Survey Builder', 'Surveys', 20, '{}'::text[], '{}'::text[], true),
  ('survey-flow', 'survey_publishing', 'Survey Publishing', 'Surveys', 30, '{}'::text[], '{}'::text[], true),
  ('survey-flow', 'ai_reports', 'AI Reports', 'AI', 40, '{}'::text[], '{}'::text[], true),
  ('survey-flow', 'advanced_analytics', 'Advanced Analytics', 'Analytics', 50, '{}'::text[], '{}'::text[], true),
  ('survey-flow', 'webhook_delivery', 'Webhook Delivery', 'Integrations', 60, '{}'::text[], '{}'::text[], true),
  ('survey-flow', 'custom_tracking', 'Custom Tracking', 'Tracking', 70, '{}'::text[], '{}'::text[], true),
  ('survey-flow', 'webhooks', 'Webhooks', 'Integrations', 80, '{}'::text[], '{}'::text[], true),
  ('survey-flow', 'custom_branding', 'Custom Branding', 'Branding', 90, '{}'::text[], '{}'::text[], true),
  ('survey-flow', 'thank_you_pages.custom_builder', 'Outcome Builder', 'Conversion', 100, array['thank_you_builder_enabled', 'thank_you_builder_runtime_enabled'], array['survey_thank_you_pages:manage'], true),
  ('survey-flow', 'thank_you_pages.conditional_logic', 'Outcome Routing', 'Conversion', 110, array['thank_you_builder_enabled', 'thank_you_logic_rules_enabled'], array['survey_thank_you_pages:manage_logic'], true)
on conflict (application_key, feature_key) do update
set feature_name = excluded.feature_name,
    category = excluded.category,
    display_order = excluded.display_order,
    associated_flags = excluded.associated_flags,
    required_permissions = excluded.required_permissions,
    is_active = excluded.is_active,
    updated_at = now();

insert into app_shell_limit_types (application_key, limit_key, limit_name, category, unit, unit_label, display_order, is_active)
values
  ('survey-flow', 'team_members', 'Team Members', 'Workspace', 'seat', 'members', 10, true),
  ('survey-flow', 'api_requests_monthly', 'Monthly API Requests', 'API', 'request', 'requests/month', 20, true),
  ('survey-flow', 'workspaces', 'Workspaces', 'Workspace', 'workspace', 'workspaces', 30, true),
  ('survey-flow', 'surveys', 'Surveys', 'Surveys', 'survey', 'surveys', 40, true),
  ('survey-flow', 'responses_monthly', 'Monthly Survey Responses', 'Surveys', 'response', 'responses/month', 50, true),
  ('survey-flow', 'ai_reports_monthly', 'Monthly AI Reports', 'AI', 'report', 'reports/month', 60, true),
  ('survey-flow', 'webhook_deliveries_monthly', 'Monthly Webhook Deliveries', 'Integrations', 'delivery', 'deliveries/month', 70, true)
on conflict (application_key, limit_key) do update
set limit_name = excluded.limit_name,
    category = excluded.category,
    unit = excluded.unit,
    unit_label = excluded.unit_label,
    display_order = excluded.display_order,
    is_active = excluded.is_active,
    updated_at = now();

alter table app_shell_feature_registry enable row level security;
alter table app_shell_limit_types enable row level security;
alter table app_shell_workspace_plans enable row level security;

grant all on all tables in schema survey_flow to service_role;
grant all on all sequences in schema survey_flow to service_role;
