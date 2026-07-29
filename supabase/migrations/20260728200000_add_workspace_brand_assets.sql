set search_path = survey_flow, public;

alter table app_shell_workspaces
  add column if not exists logo_url text,
  add column if not exists logo_mark_url text;

comment on column app_shell_workspaces.logo_url is
  'Workspace brand logo image URL or app asset path used by the app shell.';

comment on column app_shell_workspaces.logo_mark_url is
  'Workspace brand compact mark image URL or app asset path used by compact shell surfaces.';
