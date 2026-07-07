-- Entegro Task Tracker — Supabase schema
-- Run this in Supabase SQL Editor (Project > SQL Editor > New query)

create extension if not exists "pgcrypto";

-- Resources: the people tasks are assigned to
create table if not exists resources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  color text default '#1F5C4A',
  created_at timestamptz default now()
);

-- Projects: groupings of tasks (e.g. "Entegro Hub", "Client X Onboarding")
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text default '#E07A3E',
  archived boolean default false,
  created_at timestamptz default now()
);

-- Tasks: parent_task_id null = top-level task; non-null = subtask
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete set null,
  parent_task_id uuid references tasks(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo','in_progress','on_hold','review','done')),
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  assigned_to uuid references resources(id) on delete set null,
  start_date date,
  due_date date,
  is_milestone boolean default false,
  milestone_date date,
  position integer default 0,
  -- Network/ops tracker fields (from IP Daily Task Tracker Log)
  task_type text,               -- e.g. MRP Planning, Full Audit, Config Removal, GCR_MOP...
  eid text,                     -- circuit / equipment ID
  site_name text,               -- site or market name
  raised_by text,               -- who requested the task (may not be a tracked resource)
  date_added date,              -- date the task was logged (distinct from created_at)
  actual_completion date,       -- actual completion date (vs planned due_date)
  expected_duration_hours numeric,
  actual_time_spent_hours numeric,
  progress_percent integer default 0 check (progress_percent between 0 and 100),
  comments text,                -- running notes, separate from the description
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_tasks_parent on tasks(parent_task_id);
create index if not exists idx_tasks_project on tasks(project_id);
create index if not exists idx_tasks_assigned on tasks(assigned_to);

-- Task comments: a timestamped log of notes/updates on a task (distinct from
-- the single legacy `comments` text field above, which is kept for anything
-- imported before this existed).
create table if not exists task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade not null,
  body text not null,
  author text,
  created_at timestamptz default now()
);

create index if not exists idx_task_comments_task on task_comments(task_id);

-- Keep updated_at fresh
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_tasks_updated_at on tasks;
create trigger trg_tasks_updated_at
before update on tasks
for each row execute function set_updated_at();

-- Auto-stamp actual_completion the moment a task becomes 'done', unless it
-- was already set explicitly (e.g. via CSV import or manual entry). This
-- gives the board a reliable date to filter "recently completed" tasks by.
create or replace function set_actual_completion()
returns trigger as $$
begin
  if new.status = 'done' and new.actual_completion is null then
    new.actual_completion := current_date;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_tasks_actual_completion on tasks;
create trigger trg_tasks_actual_completion
before insert or update on tasks
for each row execute function set_actual_completion();

-- Open access (no login) — RLS enabled but permissive, since this is an
-- internal tool anyone with the link can use. Tighten later if you add auth.
alter table resources enable row level security;
alter table projects enable row level security;
alter table tasks enable row level security;
alter table task_comments enable row level security;

drop policy if exists "public_all_resources" on resources;
create policy "public_all_resources" on resources for all using (true) with check (true);

drop policy if exists "public_all_projects" on projects;
create policy "public_all_projects" on projects for all using (true) with check (true);

drop policy if exists "public_all_tasks" on tasks;
create policy "public_all_tasks" on tasks for all using (true) with check (true);

drop policy if exists "public_all_task_comments" on task_comments;
create policy "public_all_task_comments" on task_comments for all using (true) with check (true);

-- Seed data so the dashboard isn't empty on first run
insert into resources (name, email, color) values
  ('Rashmi Papneja', 'rashmi@entegro.com', '#1F5C4A'),
  ('Kiran', 'kiran@entegro.com', '#E07A3E'),
  ('Uday', 'uday@entegro.com', '#3B6E8F')
on conflict do nothing;

insert into projects (name, color) values
  ('Entegro Marketing & GTM', '#E07A3E'),
  ('Client Delivery', '#1F5C4A')
on conflict do nothing;
