set search_path = survey_flow, public;

update app_shell_feature_registry
set associated_flags = array['thank_you_builder_enabled', 'thank_you_builder_runtime_enabled'],
    required_permissions = array['survey_thank_you_pages:manage'],
    updated_at = now()
where feature_key = 'thank_you_pages.custom_builder';

update app_shell_feature_registry
set associated_flags = array['thank_you_builder_enabled', 'thank_you_logic_rules_enabled'],
    required_permissions = array['survey_thank_you_pages:manage_logic'],
    updated_at = now()
where feature_key = 'thank_you_pages.conditional_logic';
