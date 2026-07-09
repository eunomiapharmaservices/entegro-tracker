-- Migration: shorten the Task ID format from the millisecond-precision
-- version to YYMMDD-HHMMSS (e.g. 260708-120927). Regenerates every existing
-- task's ID in the new format too, so everything stays consistent.
-- Run this in Supabase SQL Editor. Safe to run more than once.

create or replace function set_task_number()
returns trigger as $$
declare
  base text;
  candidate text;
  suffix int := 0;
begin
  if new.task_number is not null then
    return new;
  end if;
  base := to_char(clock_timestamp(), 'YYMMDD"-"HH24MISS');
  candidate := base;
  while exists (select 1 from tasks where task_number = candidate) loop
    suffix := suffix + 1;
    candidate := base || '-' || suffix;
  end loop;
  new.task_number := candidate;
  return new;
end;
$$ language plpgsql;

-- Regenerate every existing task's ID in the new format, using each task's
-- real creation time (not "now"), handling any same-second collisions with
-- a numeric suffix, processed in creation order for reproducible results.
do $$
declare
  r record;
  base text;
  candidate text;
  suffix int;
begin
  for r in select id, created_at from tasks order by created_at loop
    base := to_char(r.created_at, 'YYMMDD"-"HH24MISS');
    candidate := base;
    suffix := 0;
    while exists (select 1 from tasks where task_number = candidate and id <> r.id) loop
      suffix := suffix + 1;
      candidate := base || '-' || suffix;
    end loop;
    update tasks set task_number = candidate where id = r.id;
  end loop;
end $$;

NOTIFY pgrst, 'reload schema';
