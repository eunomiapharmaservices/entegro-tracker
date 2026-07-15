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
  task_number text unique,      -- human-readable unique ID: YYMMDD-HHMMSS, e.g. 260708-120927
  project_id uuid references projects(id) on delete set null,
  parent_task_id uuid references tasks(id) on delete cascade,
  depends_on_task_id uuid references tasks(id) on delete set null
    check (depends_on_task_id is null or depends_on_task_id <> id),
  reviewer_id uuid references resources(id) on delete set null,  -- who reviews this
                                                                   -- task if it enters Review
  is_review_task boolean not null default false,   -- true for the auto-generated
                                                     -- "<title> Review" task itself
  review_of_task_id uuid references tasks(id) on delete cascade,  -- back-reference from
                                                                   -- a review task to the
                                                                   -- original task it reviews
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo','in_progress','on_hold','review','done')),
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  assigned_to uuid references resources(id) on delete set null,
  assignee_ids uuid[] default '{}',  -- full set of assignees; assigned_to stays
                                      -- the primary one for backward compatibility
                                      -- with existing filters/board avatars
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
  deleted_at timestamptz,       -- soft delete: set instead of removing the row, so
                                 -- the comment log/history is never lost
  hold_started_at date,         -- date the task most recently entered On Hold/In Review —
                                 -- used to extend the effective due date while it sits there
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_tasks_parent on tasks(parent_task_id);
create index if not exists idx_tasks_project on tasks(project_id);
create index if not exists idx_tasks_assigned on tasks(assigned_to);
create index if not exists idx_tasks_depends_on on tasks(depends_on_task_id);

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
  role text not null default 'normal' check (role in ('super','admin','normal','view')),
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
  role text not null default 'normal' check (role in ('super','admin','normal','view')),
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

-- True for super/admin/normal — false for 'view' (View Only can look but not
-- touch: no creating/editing tasks, no comments, no project auto-creation).
create or replace function can_edit()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role in ('super', 'admin', 'normal')
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

-- Admins can set someone's role to Normal or View Only — that covers routine
-- day-to-day access changes. Only Super Users can grant Admin or Super
-- itself, so privilege escalation always requires a Super User's say-so.
drop policy if exists "profiles_update_admin" on profiles;
drop policy if exists "profiles_update_super" on profiles;
drop policy if exists "profiles_update_role" on profiles;
create policy "profiles_update_role" on profiles for update
  using (is_admin_or_super())
  with check (is_super() or (is_admin_or_super() and role in ('normal', 'view')));

-- Allowed emails: Admins/Super can view, invite, and remove entries. Admins
-- can set a role of Normal or View Only; only Super Users can invite or
-- edit someone straight into Admin/Super. This applies to both new invites
-- and editing an existing (not-yet-registered) invite's role.
drop policy if exists "authenticated_all_allowed_emails" on allowed_emails;
drop policy if exists "admin_all_allowed_emails" on allowed_emails;
drop policy if exists "allowed_emails_select" on allowed_emails;
drop policy if exists "allowed_emails_insert" on allowed_emails;
drop policy if exists "allowed_emails_update" on allowed_emails;
drop policy if exists "allowed_emails_delete" on allowed_emails;
create policy "allowed_emails_select" on allowed_emails for select
  using (is_admin_or_super());
create policy "allowed_emails_insert" on allowed_emails for insert
  with check (is_super() or (is_admin_or_super() and role in ('normal', 'view')));
create policy "allowed_emails_update" on allowed_emails for update
  using (is_admin_or_super())
  with check (is_super() or (is_admin_or_super() and role in ('normal', 'view')));
create policy "allowed_emails_delete" on allowed_emails for delete
  using (is_admin_or_super());

-- Lets ANY signed-in user check whether a given email belongs to a View Only
-- account, without needing broad SELECT access to profiles/allowed_emails
-- (which is admin-only). Used to hide View Only people from task-workload
-- views like the People dashboard, regardless of the viewer's own role.
create or replace function view_only_emails()
returns setof text
language sql
security definer
set search_path = public
as $$
  select email from profiles where role = 'view'
  union
  select email from allowed_emails ae
    where ae.role = 'view'
    and lower(ae.email) not in (select lower(email) from profiles);
$$;

grant execute on function view_only_emails() to authenticated;

-- Same idea, but also returns a guessed first name (from the email's local
-- part) so a People entry that hasn't been linked to an email yet can still
-- be matched by name as a fallback.
create or replace function view_only_people()
returns table(email text, name_guess text)
language sql
security definer
set search_path = public
as $$
  select email, initcap(split_part(split_part(email, '@', 1), '.', 1)) as name_guess
  from profiles where role = 'view'
  union
  select ae.email, initcap(split_part(split_part(ae.email, '@', 1), '.', 1))
  from allowed_emails ae
    where ae.role = 'view'
    and lower(ae.email) not in (select lower(email) from profiles);
$$;

grant execute on function view_only_people() to authenticated;

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

-- Unique, human-readable task ID: YYMMDD-HHMMSS (e.g. 260708-120927). If two
-- tasks somehow land in the exact same second, a "-1", "-2"... suffix is
-- appended so the ID stays unique — the common case keeps the clean format.
-- Set once at creation and never changed afterward.
create or replace function set_task_number()
returns trigger as $$
declare
  base text;
  candidate text;
  suffix int := 0;
begin
  if new.task_number is not null then
    return new;
  end if;
  base := to_char(clock_timestamp(), 'YYMMDD"-"HH24MISS');
  candidate := base;
  while exists (select 1 from tasks where task_number = candidate) loop
    suffix := suffix + 1;
    candidate := base || '-' || suffix;
  end loop;
  new.task_number := candidate;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_tasks_task_number on tasks;
create trigger trg_tasks_task_number
before insert on tasks
for each row execute function set_task_number();

-- Tasks are "deleted" by setting deleted_at (soft delete — the row and its
-- full comment log stay in the database forever, just hidden from normal
-- views). This trigger enforces that only Admin/Super can actually do that,
-- since the general tasks UPDATE policy is open to any editor for normal
-- field edits.
create or replace function prevent_unauthorized_delete()
returns trigger as $$
begin
  if (old.deleted_at is distinct from new.deleted_at) and not is_admin_or_super() then
    raise exception 'Only Admin/Super can delete or restore tasks';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_tasks_prevent_unauthorized_delete on tasks;
create trigger trg_tasks_prevent_unauthorized_delete
before update on tasks
for each row execute function prevent_unauthorized_delete();

-- Task dependencies: when a task is (newly) set to depend on another task
-- that's already completed, immediately set its start date to the day
-- after that completion date.
create or replace function apply_dependency_start_date()
returns trigger as $$
declare
  dep_completion date;
begin
  if new.depends_on_task_id is not null and (
       tg_op = 'INSERT' or new.depends_on_task_id is distinct from old.depends_on_task_id
     ) then
    select actual_completion into dep_completion from tasks where id = new.depends_on_task_id;
    if dep_completion is not null then
      new.start_date := dep_completion + 1;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_tasks_apply_dependency_start_date on tasks;
create trigger trg_tasks_apply_dependency_start_date
before insert or update on tasks
for each row execute function apply_dependency_start_date();

-- When a task's actual completion date is set or changes, push that
-- forward to every task depending on it: their start date becomes the day
-- after this task's completion date.
create or replace function cascade_dependency_start_date()
returns trigger as $$
begin
  if new.actual_completion is not null
     and (old.actual_completion is distinct from new.actual_completion) then
    update tasks
    set start_date = new.actual_completion + 1
    where depends_on_task_id = new.id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_tasks_cascade_dependency on tasks;
create trigger trg_tasks_cascade_dependency
after update on tasks
for each row execute function cascade_dependency_start_date();

-- While a task sits in On Hold, its *effective* due date grows by one day
-- for every day that passes (computed on read — see lib/dateUtils.ts
-- effectiveDueDate — not stored day-by-day). This trigger just manages the
-- marker date the extension counts from:
--   - entering On Hold from anything else: start the marker today
--   - leaving On Hold: "bake in" the accumulated extension into the real
--     due_date, then clear the marker so it stops growing
-- In Review works differently (see spawn_review_task/cascade_review_completion
-- below) — its due date freezes rather than growing daily.
create or replace function manage_hold_started_at()
returns trigger as $$
declare
  is_hold_status boolean;
  was_hold_status boolean;
begin
  is_hold_status := new.status = 'on_hold';
  was_hold_status := (tg_op = 'UPDATE') and old.status = 'on_hold';

  if is_hold_status and not was_hold_status then
    new.hold_started_at := coalesce(new.hold_started_at, current_date);
  elsif (not is_hold_status) and was_hold_status and old.hold_started_at is not null then
    if new.due_date is not null then
      new.due_date := new.due_date + (current_date - old.hold_started_at);
    end if;
    new.hold_started_at := null;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_tasks_manage_hold_started_at on tasks;
create trigger trg_tasks_manage_hold_started_at
before insert or update on tasks
for each row execute function manage_hold_started_at();

-- Review workflow: the moment a task enters "In Review" (from anything
-- else), spawn a duplicate task titled "<title> Review", assigned to the
-- original task's chosen Reviewer — or, if that's not set, whoever is named
-- in "Raised by" (matched to a People entry by name) — and make the
-- original task depend on that new review task. The original's due date is
-- frozen (no automatic daily growth) while this is in progress.
create or replace function spawn_review_task()
returns trigger as $$
declare
  new_review_id uuid;
  reviewer_resource_id uuid;
begin
  if new.status = 'review'
     and (old.status is distinct from 'review')
     and not coalesce(old.is_review_task, false) then

    reviewer_resource_id := new.reviewer_id;
    if reviewer_resource_id is null and new.raised_by is not null then
      select id into reviewer_resource_id
      from resources
      where lower(name) = lower(trim(new.raised_by))
      limit 1;
    end if;

    insert into tasks (
      title, project_id, task_type, eid, site_name, assigned_to, assignee_ids,
      status, priority, is_review_task, review_of_task_id, date_added
    ) values (
      new.title || ' Review',
      new.project_id, new.task_type, new.eid, new.site_name,
      reviewer_resource_id,
      case when reviewer_resource_id is not null then array[reviewer_resource_id] else '{}'::uuid[] end,
      'todo', new.priority, true, new.id, current_date
    )
    returning id into new_review_id;

    new.depends_on_task_id := new_review_id;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_tasks_spawn_review_task on tasks;
create trigger trg_tasks_spawn_review_task
before update on tasks
for each row execute function spawn_review_task();

-- When an auto-generated review task is completed, add however long the
-- review itself took (its completion date minus the date it was created)
-- onto the due date of the original task it was reviewing.
create or replace function cascade_review_completion()
returns trigger as $$
declare
  duration_days int;
begin
  if new.is_review_task and new.review_of_task_id is not null
     and new.actual_completion is not null
     and (old.actual_completion is distinct from new.actual_completion) then
    duration_days := greatest(0, new.actual_completion - coalesce(new.date_added, new.created_at::date));
    update tasks
    set due_date = coalesce(due_date, current_date) + duration_days
    where id = new.review_of_task_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_tasks_cascade_review_completion on tasks;
create trigger trg_tasks_cascade_review_completion
after update on tasks
for each row execute function cascade_review_completion();

-- Logs a comment whenever a task's due date actually changes, from any
-- source — manual edit, CSV import, or the automatic On Hold/In Review
-- bake-in above. AFTER trigger so it sees the final committed value (i.e.
-- it captures the real change even when another BEFORE trigger adjusted it
-- further). Only fires on UPDATE, not INSERT, so creating a task with a due
-- date doesn't also log a redundant "due date set" entry.
create or replace function log_due_date_change()
returns trigger as $$
begin
  if new.due_date is distinct from old.due_date then
    insert into task_comments (task_id, body, author)
    values (
      new.id,
      case
        when old.due_date is null then format('Due date set to %s', to_char(new.due_date, 'DD Mon YYYY'))
        when new.due_date is null then format('Due date cleared (was %s)', to_char(old.due_date, 'DD Mon YYYY'))
        else format('Due date changed from %s to %s', to_char(old.due_date, 'DD Mon YYYY'), to_char(new.due_date, 'DD Mon YYYY'))
      end,
      null
    );
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_tasks_log_due_date_change on tasks;
create trigger trg_tasks_log_due_date_change
after update on tasks
for each row execute function log_due_date_change();

-- Resources stay open to any signed-in user (roster used to assign tasks —
-- who can add/remove entries is gated in the UI, not RLS, for Admin/Super).
alter table resources enable row level security;
alter table projects enable row level security;
alter table tasks enable row level security;
alter table task_comments enable row level security;

drop policy if exists "public_all_resources" on resources;
drop policy if exists "authenticated_all_resources" on resources;
create policy "authenticated_all_resources" on resources for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Projects: anyone signed in can view. INSERT requires can_edit() (so View
-- Only can't trigger project auto-creation, since they can't create tasks
-- either) — everyone else (super/admin/normal) keeps this open, since
-- entering a new EID while creating a task auto-creates its project.
-- Deliberate management (renaming, archiving/restoring, deleting) stays
-- admin/super only.
drop policy if exists "public_all_projects" on projects;
drop policy if exists "authenticated_all_projects" on projects;
drop policy if exists "projects_insert_all" on projects;
create policy "projects_select_all" on projects for select
  using (auth.role() = 'authenticated');
create policy "projects_insert_editors" on projects for insert
  with check (can_edit());
create policy "projects_update_admin" on projects for update
  using (is_admin_or_super()) with check (is_admin_or_super());
create policy "projects_delete_admin" on projects for delete
  using (is_admin_or_super());

-- Tasks: anyone signed in can view. Creating/editing requires can_edit()
-- (View Only can look but not touch) — deleting stays admin/super only.
drop policy if exists "public_all_tasks" on tasks;
drop policy if exists "authenticated_all_tasks" on tasks;
drop policy if exists "tasks_insert_all" on tasks;
drop policy if exists "tasks_update_all" on tasks;
create policy "tasks_select_all" on tasks for select
  using (auth.role() = 'authenticated');
create policy "tasks_insert_editors" on tasks for insert
  with check (can_edit());
create policy "tasks_update_editors" on tasks for update
  using (can_edit()) with check (can_edit());
create policy "tasks_delete_admin" on tasks for delete
  using (is_admin_or_super());

-- Task comments: anyone signed in can read the log (including View Only) —
-- posting/editing/deleting a comment requires can_edit().
drop policy if exists "public_all_task_comments" on task_comments;
drop policy if exists "authenticated_all_task_comments" on task_comments;
create policy "task_comments_select_all" on task_comments for select
  using (auth.role() = 'authenticated');
create policy "task_comments_insert_editors" on task_comments for insert
  with check (can_edit());
create policy "task_comments_update_editors" on task_comments for update
  using (can_edit()) with check (can_edit());
create policy "task_comments_delete_editors" on task_comments for delete
  using (can_edit());

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
