set search_path = survey_flow, public;

alter table app_shell_feature_registry
  add column if not exists associated_flags text[] not null default '{}'::text[],
  add column if not exists required_permissions text[] not null default '{}'::text[];
