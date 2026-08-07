-- Migration: make the trigger functions that write comment-log entries
-- SECURITY DEFINER.
--
-- Why: these functions INSERT into task_comments, which has an RLS policy
-- requiring can_edit(). Without SECURITY DEFINER the insert runs as the
-- invoking user and RLS can silently block it — the task update still
-- succeeds, but no log entry appears. Running them as the definer makes the
-- logging reliable regardless of who triggered the change.
--
-- Run this in Supabase SQL Editor. Safe to run more than once.

create or replace function log_due_date_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.due_date is distinct from old.due_date then
    insert into task_comments (task_id, body, author)
    values (
      new.id,
      case
        when old.due_date is null then format('Due date set to %s', to_char(new.due_date, 'DD Mon YYYY'))
        when new.due_date is null then format('Due date cleared (was %s)', to_char(old.due_date, 'DD Mon YYYY'))
        else format('Due date changed from %s to %s', to_char(old.due_date, 'DD Mon YYYY'), to_char(new.due_date, 'DD Mon YYYY'))
      end,
      current_actor_name()
    );
  end if;
  return new;
end;
$$;

create or replace function cascade_review_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  duration_days int;
  was_in_review boolean;
begin
  if new.is_review_task and new.review_of_task_id is not null
     and new.actual_completion is not null
     and (old.actual_completion is distinct from new.actual_completion) then
    duration_days := greatest(0, new.actual_completion - coalesce(new.date_added, new.created_at::date));

    select (status = 'review') into was_in_review from tasks where id = new.review_of_task_id;

    update tasks
    set due_date = coalesce(due_date, current_date) + duration_days,
        status = case when status = 'review' then 'in_progress' else status end
    where id = new.review_of_task_id;

    if was_in_review then
      insert into task_comments (task_id, body, author)
      values (
        new.review_of_task_id,
        'Status changed from "In review" to "In progress" (review completed)',
        current_actor_name()
      );
    end if;

    insert into task_comments (task_id, body, author, created_at)
    select new.review_of_task_id, body, author, created_at
    from task_comments
    where task_id = new.id;
  end if;
  return new;
end;
$$;

NOTIFY pgrst, 'reload schema';
