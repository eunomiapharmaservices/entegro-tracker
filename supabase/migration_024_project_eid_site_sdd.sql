-- Migration: adds EID, Site Name, and Site Dark Date (SDD) to projects,
-- managed from a new Admin/Super-only "Manage projects" panel. SDD shows on
-- the header of any task belonging to that project.
-- Run this in Supabase SQL Editor. Safe to run more than once.

alter table projects add column if not exists eid text;
alter table projects add column if not exists site_name text;
alter table projects add column if not exists site_dark_date date;

-- No RLS changes needed — updating these fields already requires Admin/Super
-- via the existing projects_update_admin policy.

NOTIFY pgrst, 'reload schema';
