-- Migration: Review workflow.
--   - "In Review" no longer auto-extends the due date daily (that's now
--     On Hold only) — due date freezes while a task is in review.
--   - Entering Review spawns a duplicate "<title> Review" task, assigned to
--     a chosen Reviewer, and the original task depends on it.
--   - When that review task is completed, however long it took (its
--     completion date minus its creation date) is added onto the original
--     task's due date.
-- Run this in Supabase SQL Editor. Safe to run more than once.

alter table tasks add column if not exists reviewer_id uuid references resources(id) on delete set null;
alter table tasks add column if not exists is_review_task boolean not null default false;
alter table tasks add column if not exists review_of_task_id uuid references tasks(id) on delete cascade;

-- Restrict the On Hold-style auto-extend to on_hold only (was previously
-- on_hold + review)
create or replace function manage_hold_started_at()
returns trigger as $$
declare
  is_hold_status boolean;
  was_hold_status boolean;
begin
  is_hold_status := new.status = 'on_hold';
  was_hold_status := (tg_op = 'UPDATE') and old.status = 'on_hold';

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

create or replace function spawn_review_task()
returns trigger as $$
declare
  new_review_id uuid;
begin
  if new.status = 'review'
     and (old.status is distinct from 'review')
     and not coalesce(old.is_review_task, false) then
    insert into tasks (
      title, project_id, task_type, eid, site_name, assigned_to, assignee_ids,
      status, priority, is_review_task, review_of_task_id, date_added
    ) values (
      new.title || ' Review',
      new.project_id, new.task_type, new.eid, new.site_name,
      new.reviewer_id,
      case when new.reviewer_id is not null then array[new.reviewer_id] else '{}'::uuid[] end,
      'todo', new.priority, true, new.id, current_date
    )
    returning id into new_review_id;

    new.depends_on_task_id := new_review_id;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_tasks_spawn_review_task on tasks;
create trigger trg_tasks_spawn_review_task
before update on tasks
for each row execute function spawn_review_task();

create or replace function cascade_review_completion()
returns trigger as $$
declare
  duration_days int;
begin
  if new.is_review_task and new.review_of_task_id is not null
     and new.actual_completion is not null
     and (old.actual_completion is distinct from new.actual_completion) then
    duration_days := greatest(0, new.actual_completion - coalesce(new.date_added, new.created_at::date));
    update tasks
    set due_date = coalesce(due_date, current_date) + duration_days
    where id = new.review_of_task_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_tasks_cascade_review_completion on tasks;
create trigger trg_tasks_cascade_review_completion
after update on tasks
for each row execute function cascade_review_completion();

NOTIFY pgrst, 'reload schema';
