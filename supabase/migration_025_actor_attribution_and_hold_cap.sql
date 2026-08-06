-- Migration:
--   - Auto-generated comment log entries (due date changes, the review-
--     completion status change) are now attributed to whoever actually
--     performed the action, instead of showing no author.
--   - The On Hold due-date extension is now capped at 30 days (adjustable
--     below) rather than growing indefinitely.
-- Run this in Supabase SQL Editor. Safe to run more than once.

create or replace function current_actor_name()
returns text
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (
      select r.name from resources r
      join profiles p on lower(p.email) = lower(r.email)
      where p.id = auth.uid()
      limit 1
    ),
    (select email from profiles where id = auth.uid()),
    'System'
  );
$$;

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
$$ language plpgsql;

create or replace function log_due_date_change()
returns trigger as $$
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
$$ language plpgsql;

create or replace function manage_hold_started_at()
returns trigger as $$
declare
  is_hold_status boolean;
  was_hold_status boolean;
  extension_days int;
  max_extension_days constant int := 30; -- cap on how far On Hold can push the due date
begin
  is_hold_status := new.status = 'on_hold';
  was_hold_status := (tg_op = 'UPDATE') and old.status = 'on_hold';

  if is_hold_status and not was_hold_status then
    new.hold_started_at := coalesce(new.hold_started_at, current_date);
  elsif (not is_hold_status) and was_hold_status and old.hold_started_at is not null then
    if new.due_date is not null then
      extension_days := least(current_date - old.hold_started_at, max_extension_days);
      new.due_date := new.due_date + extension_days;
    end if;
    new.hold_started_at := null;
  end if;

  return new;
end;
$$ language plpgsql;

NOTIFY pgrst, 'reload schema';
