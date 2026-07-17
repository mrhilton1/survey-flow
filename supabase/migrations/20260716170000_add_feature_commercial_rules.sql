set search_path = survey_flow, public;

alter table app_shell_feature_registry
  add column if not exists purchase_type text not null default 'plan_only',
  add column if not exists locked_behavior text not null default 'show_locked';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'app_shell_feature_registry_purchase_type_check'
  ) then
    alter table app_shell_feature_registry
      add constraint app_shell_feature_registry_purchase_type_check
      check (purchase_type in ('plan_only', 'addon_available', 'addon_only')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'app_shell_feature_registry_locked_behavior_check'
  ) then
    alter table app_shell_feature_registry
      add constraint app_shell_feature_registry_locked_behavior_check
      check (locked_behavior in ('show_locked', 'hide')) not valid;
  end if;
end $$;

alter table app_shell_feature_registry validate constraint app_shell_feature_registry_purchase_type_check;
alter table app_shell_feature_registry validate constraint app_shell_feature_registry_locked_behavior_check;
