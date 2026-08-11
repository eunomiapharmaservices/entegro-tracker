-- Migration: an audit trail for the Manage projects page, mirroring what
-- task_comments does for tasks.
-- Run this in Supabase SQL Editor. Safe to run more than once.

create table if not exists project_change_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  body text not null,
  author text,
  created_at timestamptz default now()
);

create index if not exists idx_project_change_log_project on project_change_log(project_id);

alter table project_change_log enable row level security;

drop policy if exists "project_change_log_select" on project_change_log;
create policy "project_change_log_select" on project_change_log for select
  using (auth.role() = 'authenticated');

-- Any signed-in user can write an entry — an audit trail must never be
-- silently dropped by RLS (the same lesson as task_comments).
drop policy if exists "project_change_log_insert" on project_change_log;
create policy "project_change_log_insert" on project_change_log for insert
  with check (auth.role() = 'authenticated');

NOTIFY pgrst, 'reload schema';
