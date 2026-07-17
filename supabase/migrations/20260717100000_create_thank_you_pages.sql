set search_path = survey_flow, public;

create table if not exists surveyflow_thank_you_pages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references app_shell_workspaces(id) on delete cascade,
  survey_id uuid not null references surveyflow_surveys(id) on delete cascade,
  name text not null default 'Thank You Page',
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  is_default boolean not null default false,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists surveyflow_thank_you_pages_workspace_idx on surveyflow_thank_you_pages(workspace_id);
create index if not exists surveyflow_thank_you_pages_survey_idx on surveyflow_thank_you_pages(survey_id);
create index if not exists surveyflow_thank_you_pages_status_idx on surveyflow_thank_you_pages(status);

create unique index if not exists surveyflow_thank_you_pages_default_idx
  on surveyflow_thank_you_pages(survey_id)
  where is_default = true and status <> 'archived';

alter table surveyflow_thank_you_pages enable row level security;
grant all on surveyflow_thank_you_pages to service_role;
