-- Migration: role-based access control (Super / Admin / Normal)
-- Run this in Supabase SQL Editor if you already had the tracker deployed
-- before this update. Safe to run more than once.

-- 0. Make sure allowed_emails exists — in case migration_006 was skipped
create table if not exists allowed_emails (
  email text primary key,
  note text,
  created_at timestamptz default now()
);

alter table allowed_emails enable row level security;

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

-- 1. Add role to the allowlist (defaults everyone existing to 'normal')
alter table allowed_emails add column if not exists role text not null default 'normal'
  check (role in ('super','admin','normal'));

-- 2. Profiles table — one row per registered account
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'normal' check (role in ('super','admin','normal')),
  created_at timestamptz default now()
);

alter table profiles enable row level security;

-- 3. Role-check helper functions (SECURITY DEFINER avoids RLS recursion)
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

-- 4. Auto-create a profile (with the right role) whenever someone registers
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
  values (new.id, new.email, coalesce(assigned_role, 'normal'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- 5. Backfill profiles for anyone who registered before this migration —
--    matched against the allowlist's role if they're on it, else 'normal'.
--    IMPORTANT: after running this, manually update the specific people who
--    should be Super or Admin (see the UPDATE statements below).
insert into profiles (id, email, role)
select u.id, u.email, coalesce(ae.role, 'normal')
from auth.users u
left join allowed_emails ae on lower(ae.email) = lower(u.email)
on conflict (id) do nothing;

-- 6. Profiles RLS: everyone can see their own row; admins/super see everyone
drop policy if exists "profiles_select" on profiles;
create policy "profiles_select" on profiles for select
  using (auth.uid() = id or is_admin_or_super());

drop policy if exists "profiles_update_admin" on profiles;
create policy "profiles_update_admin" on profiles for update
  using (is_admin_or_super()) with check (is_admin_or_super());

-- 7. Allowlist management is now admin/super only
drop policy if exists "authenticated_all_allowed_emails" on allowed_emails;
drop policy if exists "admin_all_allowed_emails" on allowed_emails;
create policy "admin_all_allowed_emails" on allowed_emails for all
  using (is_admin_or_super()) with check (is_admin_or_super());

-- 8. Projects: view/insert stays open (auto-creating a project from a new
--    EID must keep working for normal users) — update/delete admin-only
drop policy if exists "authenticated_all_projects" on projects;
drop policy if exists "projects_select_all" on projects;
drop policy if exists "projects_insert_all" on projects;
drop policy if exists "projects_update_admin" on projects;
drop policy if exists "projects_delete_admin" on projects;
create policy "projects_select_all" on projects for select
  using (auth.role() = 'authenticated');
create policy "projects_insert_all" on projects for insert
  with check (auth.role() = 'authenticated');
create policy "projects_update_admin" on projects for update
  using (is_admin_or_super()) with check (is_admin_or_super());
create policy "projects_delete_admin" on projects for delete
  using (is_admin_or_super());

-- 9. Tasks: view/create/edit stays open — delete is admin/super only
drop policy if exists "authenticated_all_tasks" on tasks;
drop policy if exists "tasks_select_all" on tasks;
drop policy if exists "tasks_insert_all" on tasks;
drop policy if exists "tasks_update_all" on tasks;
drop policy if exists "tasks_delete_admin" on tasks;
create policy "tasks_select_all" on tasks for select
  using (auth.role() = 'authenticated');
create policy "tasks_insert_all" on tasks for insert
  with check (auth.role() = 'authenticated');
create policy "tasks_update_all" on tasks for update
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "tasks_delete_admin" on tasks for delete
  using (is_admin_or_super());

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- AFTER running the above, set the actual roles for your team.
-- Uncomment and edit these with the real email addresses:
-- ============================================================
-- update profiles set role = 'super' where lower(email) = lower('sulabh@lumen.com');
-- update profiles set role = 'admin' where lower(email) in (lower('dharmeshkumar.mehta@lumen.com'), lower('gokul@lumen.com'));
--
-- Also update the allowlist so future re-registrations keep the right role:
-- update allowed_emails set role = 'super' where lower(email) = lower('sulabh@lumen.com');
-- update allowed_emails set role = 'admin' where lower(email) in (lower('dharmeshkumar.mehta@lumen.com'), lower('gokul@lumen.com'));
