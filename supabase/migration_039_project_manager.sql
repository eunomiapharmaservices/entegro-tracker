-- Migration: PM (Project Manager) on projects, alongside MRP Planner and
-- IP Tech in Manage projects.
-- Run this in Supabase SQL Editor. Safe to run more than once.

alter table projects add column if not exists project_manager text;

NOTIFY pgrst, 'reload schema';
