set search_path = survey_flow, public;

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
)
values (
  'survey-flow',
  'api_endpoint_registry',
  'API Endpoint Registry',
  'Platform owner registry for endpoint visibility, documentation status, categories, and OpenAPI export.',
  'Platform',
  15,
  'plan_only',
  'hide',
  '{}'::text[],
  array['platform:admin'],
  true
)
on conflict (application_key, feature_key) do update
set feature_name = excluded.feature_name,
    description = excluded.description,
    category = excluded.category,
    display_order = excluded.display_order,
    purchase_type = excluded.purchase_type,
    locked_behavior = excluded.locked_behavior,
    associated_flags = excluded.associated_flags,
    required_permissions = excluded.required_permissions,
    is_active = excluded.is_active,
    updated_at = now();
