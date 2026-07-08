-- Migration: require authentication for all data access
-- Run this after setting up login/registration, so existing deployments
-- switch from "anyone with the link" to "must be signed in".
-- Safe to run more than once.

drop policy if exists "public_all_resources" on resources;
drop policy if exists "authenticated_all_resources" on resources;
create policy "authenticated_all_resources" on resources for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "public_all_projects" on projects;
drop policy if exists "authenticated_all_projects" on projects;
create policy "authenticated_all_projects" on projects for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "public_all_tasks" on tasks;
drop policy if exists "authenticated_all_tasks" on tasks;
create policy "authenticated_all_tasks" on tasks for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "public_all_task_comments" on task_comments;
drop policy if exists "authenticated_all_task_comments" on task_comments;
create policy "authenticated_all_task_comments" on task_comments for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

NOTIFY pgrst, 'reload schema';

-- OPTIONAL HARDENING (do this in the Supabase dashboard, not SQL):
-- The app only lets people register with an @lumen.com address, but that
-- check happens in the browser — someone could technically call the
-- Supabase Auth API directly with a different domain. To enforce the
-- domain server-side too:
--   1. Go to Authentication -> Hooks in the Supabase dashboard.
--   2. Add a "Before User Created" hook.
--   3. Point it at a Postgres function that raises an exception unless
--      NEW.email ends with '@lumen.com'. Ask your developer/Claude for the
--      exact function if you want this added.
-- This is optional — the client-side check stops normal sign-ups; this
-- closes the API-level gap for a determined bad actor.
