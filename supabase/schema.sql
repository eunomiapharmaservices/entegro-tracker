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

-- Allowed emails: registration is gated to specific pre-approved addresses,
-- not just a domain. Managed by admins; checked (via the function below) by
-- the registration page before anyone can sign up. The role here is copied
-- onto the person's profile automatically the moment they register.
create table if not exists allowed_emails (
  email text primary key,
  note text,
  role text not null default 'normal' check (role in ('super','admin','normal')),
  created_at timestamptz default now()
);

alter table allowed_emails enable row level security;

-- Callable by anyone (including signed-out visitors on the register page),
-- but only ever returns true/false — never exposes the list itself.
create or replace function is_email_allowed(check_email text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from allowed_emails where lower(email) = lower(check_email)
  );
$$;

grant execute on function is_email_allowed(text) to anon, authenticated;

-- No rows seeded here on purpose — add at least one allowed email (with
-- role 'super') before anyone can register, e.g.:
-- insert into allowed_emails (email, note, role) values ('you@lumen.com', 'First admin', 'super');

-- Profiles: one row per registered account, holding their role. Created
-- automatically at sign-up (see the trigger below), copying the role from
-- allowed_emails at that moment.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'normal' check (role in ('super','admin','normal')),
  created_at timestamptz default now()
);

alter table profiles enable row level security;

-- SECURITY DEFINER so it can check a user's role without recursing into the
-- RLS policy that itself calls this function.
create or replace function is_admin_or_super()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role in ('admin', 'super')
  );
$$;

create or replace function is_super()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'super'
  );
$$;

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_role text;
begin
  select role into assigned_role from allowed_emails where lower(email) = lower(new.email);
  insert into public.profiles (id, email, role)
  values (new.id, new.email, coalesce(assigned_role, 'normal'));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

drop policy if exists "profiles_select" on profiles;
create policy "profiles_select" on profiles for select
  using (auth.uid() = id or is_admin_or_super());

drop policy if exists "profiles_update_admin" on profiles;
create policy "profiles_update_admin" on profiles for update
  using (is_admin_or_super()) with check (is_admin_or_super());

-- Only admins/super manage the allowlist itself (registration is still
-- checked through is_email_allowed() above regardless of these policies).
drop policy if exists "authenticated_all_allowed_emails" on allowed_emails;
drop policy if exists "admin_all_allowed_emails" on allowed_emails;
create policy "admin_all_allowed_emails" on allowed_emails for all
  using (is_admin_or_super()) with check (is_admin_or_super());

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

-- Resources and task_comments stay open to any signed-in user — the roster
-- of assignable people and the comment log aren't part of the admin/super
-- distinction described for projects, tasks, and user accounts.
alter table resources enable row level security;
alter table projects enable row level security;
alter table tasks enable row level security;
alter table task_comments enable row level security;

drop policy if exists "public_all_resources" on resources;
drop policy if exists "authenticated_all_resources" on resources;
create policy "authenticated_all_resources" on resources for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "public_all_task_comments" on task_comments;
drop policy if exists "authenticated_all_task_comments" on task_comments;
create policy "authenticated_all_task_comments" on task_comments for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Projects: anyone signed in can view, and INSERT stays open to everyone —
-- entering a new EID while creating a task auto-creates its project behind
-- the scenes, which normal users need to keep working. Deliberate management
-- (renaming, archiving/restoring, deleting) is admin/super only.
drop policy if exists "public_all_projects" on projects;
drop policy if exists "authenticated_all_projects" on projects;
create policy "projects_select_all" on projects for select
  using (auth.role() = 'authenticated');
create policy "projects_insert_all" on projects for insert
  with check (auth.role() = 'authenticated');
create policy "projects_update_admin" on projects for update
  using (is_admin_or_super()) with check (is_admin_or_super());
create policy "projects_delete_admin" on projects for delete
  using (is_admin_or_super());

-- Tasks: anyone signed in can view/create/edit (that's the core "normal
-- user" workflow) — only deleting a task is admin/super only.
drop policy if exists "public_all_tasks" on tasks;
drop policy if exists "authenticated_all_tasks" on tasks;
create policy "tasks_select_all" on tasks for select
  using (auth.role() = 'authenticated');
create policy "tasks_insert_all" on tasks for insert
  with check (auth.role() = 'authenticated');
create policy "tasks_update_all" on tasks for update
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "tasks_delete_admin" on tasks for delete
  using (is_admin_or_super());

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
