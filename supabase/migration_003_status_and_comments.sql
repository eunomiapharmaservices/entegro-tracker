-- Migration: add "On Hold" status and a timestamped task comment log
-- Run this in Supabase SQL Editor if you already had the tracker deployed
-- before this update. Safe to run more than once.

-- Widen the status check constraint to include 'on_hold'
alter table tasks drop constraint if exists tasks_status_check;
alter table tasks add constraint tasks_status_check
  check (status in ('todo','in_progress','on_hold','review','done'));

-- New table: a timestamped log of comments/updates on a task
create table if not exists task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade not null,
  body text not null,
  author text,
  created_at timestamptz default now()
);

create index if not exists idx_task_comments_task on task_comments(task_id);

alter table task_comments enable row level security;

drop policy if exists "public_all_task_comments" on task_comments;
create policy "public_all_task_comments" on task_comments for all using (true) with check (true);

NOTIFY pgrst, 'reload schema';
