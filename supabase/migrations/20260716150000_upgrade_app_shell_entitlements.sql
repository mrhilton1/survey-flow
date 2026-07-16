create extension if not exists "pgcrypto";
set search_path = survey_flow, public;

create table if not exists app_shell_feature_registry (
  id uuid primary key default gen_random_uuid(),
  application_key text not null default 'survey-flow',
  feature_key text not null,
  feature_name text not null,
  description text,
  category text not null default 'General',
  display_order integer not null default 0,
  icon text,
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
  stripe_customer_id text,
  stripe_subscription_id text,
  trial_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id)
);

alter table app_shell_workspace_overrides
  add column if not exists application_key text not null default 'survey-flow',
  add column if not exists feature_id uuid references app_shell_feature_registry(id) on delete set null,
  add column if not exists limit_type_id uuid references app_shell_limit_types(id) on delete set null,
  add column if not exists expires_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

insert into app_shell_feature_registry (application_key, feature_key, feature_name, category, display_order, is_active)
values
  ('survey-flow', 'api_access', 'API Access', 'Platform', 10, true),
  ('survey-flow', 'survey_builder', 'Survey Builder', 'Surveys', 20, true),
  ('survey-flow', 'survey_publishing', 'Survey Publishing', 'Surveys', 30, true),
  ('survey-flow', 'ai_reports', 'AI Reports', 'AI', 40, true),
  ('survey-flow', 'advanced_analytics', 'Advanced Analytics', 'Analytics', 50, true),
  ('survey-flow', 'webhook_delivery', 'Webhook Delivery', 'Integrations', 60, true),
  ('survey-flow', 'custom_tracking', 'Custom Tracking', 'Tracking', 70, true),
  ('survey-flow', 'webhooks', 'Webhooks', 'Integrations', 80, true),
  ('survey-flow', 'custom_branding', 'Custom Branding', 'Branding', 90, true),
  ('survey-flow', 'thank_you_pages.custom_builder', 'Thank You Page Builder', 'Conversion', 100, true),
  ('survey-flow', 'thank_you_pages.conditional_logic', 'Thank You Page Logic', 'Conversion', 110, true)
on conflict (application_key, feature_key) do update
set feature_name = excluded.feature_name,
    category = excluded.category,
    display_order = excluded.display_order,
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

update app_shell_plan_features pf
set plan_id = p.id,
    feature_id = (
      select fr.id
      from app_shell_feature_registry fr
      where fr.application_key = p.application_key
        and fr.feature_key = pf.feature_key
      limit 1
    ),
    is_included = coalesce(pf.is_included, pf.enabled),
    application_key = p.application_key
from app_shell_plans p
where pf.plan_key = p.plan_key;

update app_shell_plan_limits pl
set plan_id = p.id,
    limit_type_id = (
      select lt.id
      from app_shell_limit_types lt
      where lt.application_key = p.application_key
        and lt.limit_key = pl.limit_key
      limit 1
    ),
    is_unlimited = pl.limit_value = 'unlimited',
    application_key = p.application_key
from app_shell_plans p
where pl.plan_key = p.plan_key;

insert into app_shell_workspace_plans (application_key, workspace_id, plan_id, plan_key, stripe_customer_id, status)
select w.application_key, w.id, p.id, w.plan_key, w.stripe_customer_id, 'active'
from app_shell_workspaces w
left join app_shell_plans p
  on p.application_key = w.application_key
 and p.plan_key = w.plan_key
on conflict (workspace_id) do update
set plan_id = excluded.plan_id,
    plan_key = excluded.plan_key,
    stripe_customer_id = excluded.stripe_customer_id,
    updated_at = now();

alter table app_shell_feature_registry enable row level security;
alter table app_shell_limit_types enable row level security;
alter table app_shell_workspace_plans enable row level security;

grant all on all tables in schema survey_flow to service_role;
grant all on all sequences in schema survey_flow to service_role;
