-- Migration: while a task sits in On Hold or In Review, its *effective* due
-- date grows by a day for every day that passes (computed on read, not
-- stored day-by-day — see lib/dateUtils.ts effectiveDueDate). This adds the
-- marker column + trigger that manage when that extension starts/stops.
-- Run this in Supabase SQL Editor. Safe to run more than once.

alter table tasks add column if not exists hold_started_at date;

create or replace function manage_hold_started_at()
returns trigger as $$
declare
  is_hold_status boolean;
  was_hold_status boolean;
begin
  is_hold_status := new.status in ('on_hold', 'review');
  was_hold_status := (tg_op = 'UPDATE') and old.status in ('on_hold', 'review');

  if is_hold_status and not was_hold_status then
    new.hold_started_at := coalesce(new.hold_started_at, current_date);
  elsif (not is_hold_status) and was_hold_status and old.hold_started_at is not null then
    if new.due_date is not null then
      new.due_date := new.due_date + (current_date - old.hold_started_at);
    end if;
    new.hold_started_at := null;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_tasks_manage_hold_started_at on tasks;
create trigger trg_tasks_manage_hold_started_at
before insert or update on tasks
for each row execute function manage_hold_started_at();

-- Backfill: for any task currently sitting in On Hold/In Review without a
-- marker yet (i.e. everything that existed before this migration), start
-- the marker today rather than leaving it null.
update tasks
set hold_started_at = current_date
where status in ('on_hold', 'review') and hold_started_at is null;

NOTIFY pgrst, 'reload schema';
