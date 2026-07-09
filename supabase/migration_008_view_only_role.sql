-- Migration: add a 4th role, "View Only" (can browse everything, can't
-- create/edit/delete tasks, comments, or trigger project auto-creation).
-- Run this in Supabase SQL Editor after migration_007_roles.sql.
-- Safe to run more than once.

-- 1. Widen the role check constraints to allow 'view'
alter table allowed_emails drop constraint if exists allowed_emails_role_check;
alter table allowed_emails add constraint allowed_emails_role_check
  check (role in ('super','admin','normal','view'));

alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('super','admin','normal','view'));

-- 2. Helper function: true for super/admin/normal, false for 'view'
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

-- 3. Projects: insert now requires can_edit() instead of just being signed in
drop policy if exists "projects_insert_all" on projects;
drop policy if exists "projects_insert_editors" on projects;
create policy "projects_insert_editors" on projects for insert
  with check (can_edit());

-- 4. Tasks: insert/update now require can_edit()
drop policy if exists "tasks_insert_all" on tasks;
drop policy if exists "tasks_update_all" on tasks;
drop policy if exists "tasks_insert_editors" on tasks;
drop policy if exists "tasks_update_editors" on tasks;
create policy "tasks_insert_editors" on tasks for insert
  with check (can_edit());
create policy "tasks_update_editors" on tasks for update
  using (can_edit()) with check (can_edit());

-- 5. Task comments: split so View Only can read but not write
drop policy if exists "authenticated_all_task_comments" on task_comments;
drop policy if exists "task_comments_select_all" on task_comments;
drop policy if exists "task_comments_insert_editors" on task_comments;
drop policy if exists "task_comments_update_editors" on task_comments;
drop policy if exists "task_comments_delete_editors" on task_comments;
create policy "task_comments_select_all" on task_comments for select
  using (auth.role() = 'authenticated');
create policy "task_comments_insert_editors" on task_comments for insert
  with check (can_edit());
create policy "task_comments_update_editors" on task_comments for update
  using (can_edit()) with check (can_edit());
create policy "task_comments_delete_editors" on task_comments for delete
  using (can_edit());

NOTIFY pgrst, 'reload schema';

-- To make someone View Only:
-- update profiles set role = 'view' where lower(email) = lower('someone@lumen.com');
-- update allowed_emails set role = 'view' where lower(email) = lower('someone@lumen.com');
