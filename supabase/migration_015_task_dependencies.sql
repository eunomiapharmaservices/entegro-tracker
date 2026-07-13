-- Migration: task dependencies. A task can depend on another task; once
-- that other task is marked complete, dependent tasks automatically get
-- their start date set to the day after. Run this in Supabase SQL Editor.
-- Safe to run more than once.

alter table tasks add column if not exists depends_on_task_id uuid references tasks(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tasks_depends_on_task_id_check'
  ) then
    alter table tasks add constraint tasks_depends_on_task_id_check
      check (depends_on_task_id is null or depends_on_task_id <> id);
  end if;
end $$;

create index if not exists idx_tasks_depends_on on tasks(depends_on_task_id);

-- Immediately apply a completed dependency's date when one is newly set
create or replace function apply_dependency_start_date()
returns trigger as $$
declare
  dep_completion date;
begin
  if new.depends_on_task_id is not null and (
       tg_op = 'INSERT' or new.depends_on_task_id is distinct from old.depends_on_task_id
     ) then
    select actual_completion into dep_completion from tasks where id = new.depends_on_task_id;
    if dep_completion is not null then
      new.start_date := dep_completion + 1;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_tasks_apply_dependency_start_date on tasks;
create trigger trg_tasks_apply_dependency_start_date
before insert or update on tasks
for each row execute function apply_dependency_start_date();

-- Cascade to dependents whenever a task's completion date is set/changes
create or replace function cascade_dependency_start_date()
returns trigger as $$
begin
  if new.actual_completion is not null
     and (old.actual_completion is distinct from new.actual_completion) then
    update tasks
    set start_date = new.actual_completion + 1
    where depends_on_task_id = new.id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_tasks_cascade_dependency on tasks;
create trigger trg_tasks_cascade_dependency
after update on tasks
for each row execute function cascade_dependency_start_date();

NOTIFY pgrst, 'reload schema';
