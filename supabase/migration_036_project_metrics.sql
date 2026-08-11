-- Migration: circuit / migration / decommission counters on projects,
-- entered in Manage projects and used to compute overall project progress
-- on the Project status page.
-- Run this in Supabase SQL Editor. Safe to run more than once.

alter table projects add column if not exists total_circuits int default 0;
alter table projects add column if not exists migration_required int default 0;
alter table projects add column if not exists migration_complete int default 0;
alter table projects add column if not exists data_cleanse_required int default 0;
alter table projects add column if not exists data_cleanse_complete int default 0;
alter table projects add column if not exists total_devices int default 0;
alter table projects add column if not exists total_decommissioned int default 0;

NOTIFY pgrst, 'reload schema';
