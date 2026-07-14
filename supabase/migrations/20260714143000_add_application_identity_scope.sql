set search_path = survey_flow, public;

alter table app_shell_workspaces
  add column if not exists application_key text not null default 'survey-flow';

alter table app_shell_workspace_users
  add column if not exists application_key text not null default 'survey-flow',
  add column if not exists auth_user_id uuid references auth.users(id) on delete cascade;

update app_shell_workspaces
set application_key = 'survey-flow'
where application_key is null;

update app_shell_workspace_users
set application_key = 'survey-flow'
where application_key is null;

create index if not exists app_shell_workspaces_application_key_idx
  on app_shell_workspaces(application_key);

create index if not exists app_shell_workspace_users_application_key_email_idx
  on app_shell_workspace_users(application_key, lower(email));

create unique index if not exists app_shell_workspace_users_application_auth_user_id_idx
  on app_shell_workspace_users(application_key, auth_user_id)
  where auth_user_id is not null;
