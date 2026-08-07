-- Migration: adds MRP Planner and IP Tech to projects, editable from the
-- Manage projects panel alongside SDD.
-- Run this in Supabase SQL Editor. Safe to run more than once.

alter table projects add column if not exists mrp_planner text;
alter table projects add column if not exists ip_tech text;

NOTIFY pgrst, 'reload schema';
