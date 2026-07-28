set search_path = survey_flow, public;

alter table app_shell_workspaces
  add column if not exists logo_label text,
  add column if not exists theme_color text,
  add column if not exists support_email text,
  add column if not exists updated_at timestamptz not null default now();

update app_shell_workspaces
set updated_at = coalesce(updated_at, created_at, now());

comment on column app_shell_workspaces.logo_label is
  'Short workspace-specific mark used by the app shell when present.';

comment on column app_shell_workspaces.theme_color is
  'Workspace-specific brand color as a hex value used by the app shell when present.';

comment on column app_shell_workspaces.support_email is
  'Workspace-specific support/contact email used by the app shell when present.';
