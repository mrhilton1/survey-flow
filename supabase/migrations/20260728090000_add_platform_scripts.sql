set search_path = survey_flow, public;

create table if not exists app_shell_scripts (
  id uuid primary key default gen_random_uuid(),
  application_key text not null default 'survey-flow',
  name text not null,
  description text,
  scope text not null default 'global' check (scope in ('global', 'workspace')),
  workspace_id uuid references app_shell_workspaces(id) on delete cascade,
  placement text not null default 'body_end' check (placement in ('head', 'body_start', 'body_end')),
  environment text not null default 'all' check (environment in ('all', 'production', 'development')),
  script_type text not null default 'inline' check (script_type in ('inline', 'external')),
  content text,
  src_url text,
  enabled boolean not null default true,
  display_order integer not null default 100,
  created_by uuid references app_shell_workspace_users(id) on delete set null,
  updated_by uuid references app_shell_workspace_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_shell_scripts_workspace_scope_check check (
    (scope = 'global' and workspace_id is null)
    or (scope = 'workspace' and workspace_id is not null)
  ),
  constraint app_shell_scripts_content_check check (
    (script_type = 'inline' and content is not null and src_url is null)
    or (script_type = 'external' and src_url is not null and content is null)
  )
);

create index if not exists app_shell_scripts_application_key_idx
  on app_shell_scripts(application_key, enabled, placement, display_order);

create index if not exists app_shell_scripts_workspace_idx
  on app_shell_scripts(workspace_id)
  where workspace_id is not null;

alter table app_shell_scripts enable row level security;
grant all on app_shell_scripts to service_role;

alter table app_shell_feature_registry
  drop constraint if exists app_shell_feature_registry_purchase_type_check;

alter table app_shell_feature_registry
  add constraint app_shell_feature_registry_purchase_type_check
  check (purchase_type in ('plan_only', 'addon_available', 'addon_only', 'grant_only'));

insert into app_shell_feature_registry (
  application_key,
  feature_key,
  feature_name,
  description,
  category,
  display_order,
  purchase_type,
  locked_behavior,
  associated_flags,
  required_permissions,
  is_active
) values (
  'survey-flow',
  'platform_scripts',
  'Platform Scripts',
  'Platform-managed global and workspace script injection for GTM, chat tools, pixels, and similar snippets.',
  'Platform',
  18,
  'grant_only',
  'hide',
  '{}'::text[],
  array['platform:admin'],
  true
)
on conflict (application_key, feature_key) do update set
  feature_name = excluded.feature_name,
  description = excluded.description,
  category = excluded.category,
  display_order = excluded.display_order,
  purchase_type = excluded.purchase_type,
  locked_behavior = excluded.locked_behavior,
  required_permissions = excluded.required_permissions,
  is_active = excluded.is_active;
