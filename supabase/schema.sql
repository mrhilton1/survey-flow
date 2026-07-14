create extension if not exists "pgcrypto";
create schema if not exists survey_flow;
grant usage on schema survey_flow to anon, authenticated, service_role;
set search_path = survey_flow, public;

create table if not exists app_shell_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  plan_key text not null default 'free',
  stripe_customer_id text,
  created_at timestamptz not null default now()
);

create table if not exists app_shell_workspace_users (
  id uuid primary key default gen_random_uuid(),
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
