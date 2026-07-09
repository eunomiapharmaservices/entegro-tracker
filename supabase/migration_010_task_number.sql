-- Migration: add a unique, human-readable Task ID (date + time + ms)
-- Run this in Supabase SQL Editor if you already had the tracker deployed
-- before this update. Safe to run more than once.

alter table tasks add column if not exists task_number text;

create or replace function set_task_number()
returns trigger as $$
begin
  if new.task_number is null then
    new.task_number := to_char(clock_timestamp(), 'YYYYMMDD"T"HH24MISS"."MS')
      || '-' || substr(new.id::text, 1, 4);
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_tasks_task_number on tasks;
create trigger trg_tasks_task_number
before insert on tasks
for each row execute function set_task_number();

-- Backfill existing tasks (using their real created_at, not "now", so older
-- tasks get an ID reflecting when they were actually created).
update tasks
set task_number = to_char(created_at, 'YYYYMMDD"T"HH24MISS"."MS') || '-' || substr(id::text, 1, 4)
where task_number is null;

-- Now that every row has one, enforce uniqueness going forward (guarded so
-- re-running this migration doesn't error on an already-existing constraint).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tasks_task_number_key'
  ) then
    alter table tasks add constraint tasks_task_number_key unique (task_number);
  end if;
end $$;

NOTIFY pgrst, 'reload schema';
