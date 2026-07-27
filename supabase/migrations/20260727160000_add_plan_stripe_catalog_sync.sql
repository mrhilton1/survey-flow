set search_path = survey_flow, public;

alter table app_shell_plans
  add column if not exists stripe_sync_status text not null default 'pending',
  add column if not exists stripe_sync_error text,
  add column if not exists stripe_synced_at timestamptz;

update app_shell_plans
set stripe_sync_status = case
  when plan_key = 'free' then 'not_applicable'
  when not active or status <> 'active' then 'archived'
  else 'pending'
end
where stripe_sync_status = 'pending';

comment on column app_shell_plans.stripe_sync_status is
  'SurveyFlow-to-Stripe catalog state: pending, synced, error, archived, or not_applicable.';
