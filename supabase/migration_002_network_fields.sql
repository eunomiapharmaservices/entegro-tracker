-- Migration: add IP Daily Task Tracker fields to an existing deployment
-- Run this in Supabase SQL Editor if you already had the tracker set up
-- before this update. Safe to run more than once.

alter table tasks add column if not exists task_type text;
alter table tasks add column if not exists eid text;
alter table tasks add column if not exists site_name text;
alter table tasks add column if not exists raised_by text;
alter table tasks add column if not exists date_added date;
alter table tasks add column if not exists actual_completion date;
alter table tasks add column if not exists expected_duration_hours numeric;
alter table tasks add column if not exists actual_time_spent_hours numeric;
alter table tasks add column if not exists progress_percent integer default 0;
alter table tasks add column if not exists comments text;

-- Re-add the progress_percent range check (skipped if it already exists)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tasks_progress_percent_check'
  ) then
    alter table tasks add constraint tasks_progress_percent_check
      check (progress_percent between 0 and 100);
  end if;
end $$;
