set search_path = survey_flow, public;

alter table app_shell_plans
  add column if not exists billing_type text not null default 'paid';

update app_shell_plans
set billing_type = case
  when plan_key = 'free' then 'free'
  else 'paid'
end;

alter table app_shell_plans
  drop constraint if exists app_shell_plans_billing_type_check;

alter table app_shell_plans
  add constraint app_shell_plans_billing_type_check
  check (billing_type in ('free', 'paid', 'grant_only'));

update app_shell_plans
set
  price_monthly = 0,
  price_yearly = 0,
  trial_days = 0,
  stripe_sync_status = case
    when stripe_product_id is null
      and stripe_monthly_price_id is null
      and stripe_yearly_price_id is null
      then 'not_applicable'
    else stripe_sync_status
  end,
  stripe_sync_error = null
where billing_type <> 'paid';

comment on column app_shell_plans.billing_type is
  'Billing behavior: free is publicly available without Stripe, paid uses Stripe Billing, and grant_only is assigned by an administrator.';
