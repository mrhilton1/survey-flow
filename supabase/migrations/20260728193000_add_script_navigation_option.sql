set search_path = survey_flow, public;

alter table app_shell_scripts
  add column if not exists run_on_navigation boolean not null default false;
