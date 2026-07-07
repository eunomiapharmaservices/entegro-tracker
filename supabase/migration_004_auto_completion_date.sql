-- Migration: auto-stamp actual_completion when a task is marked done
-- Run this in Supabase SQL Editor if you already had the tracker deployed
-- before this update. Safe to run more than once.

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

NOTIFY pgrst, 'reload schema';
