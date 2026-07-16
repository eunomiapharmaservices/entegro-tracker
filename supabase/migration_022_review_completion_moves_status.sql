-- Migration: when a review task is completed, the main task now also:
--   - moves back from "In review" to "In progress" automatically
--   - gets every comment from the review task copied onto it
-- (in addition to the existing due-date extension). Run this in Supabase
-- SQL Editor. Safe to run more than once.

create or replace function cascade_review_completion()
returns trigger as $$
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
        null
      );
    end if;

    insert into task_comments (task_id, body, author, created_at)
    select new.review_of_task_id, body, author, created_at
    from task_comments
    where task_id = new.id;
  end if;
  return new;
end;
$$ language plpgsql;

NOTIFY pgrst, 'reload schema';
