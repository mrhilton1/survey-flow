set search_path = survey_flow, public;

update app_shell_feature_registry
set feature_name = 'Outcome Builder'
where application_key = 'survey-flow'
  and feature_key = 'thank_you_pages.custom_builder';

update app_shell_feature_registry
set feature_name = 'Outcome Routing'
where application_key = 'survey-flow'
  and feature_key = 'thank_you_pages.conditional_logic';
