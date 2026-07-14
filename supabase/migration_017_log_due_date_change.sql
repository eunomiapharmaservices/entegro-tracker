-- Migration: log a comment whenever a task's due date actually changes,
-- from any source (manual edit, CSV import, or the On Hold/In Review
-- bake-in). Run this in Supabase SQL Editor. Safe to run more than once.

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
      null
    );
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_tasks_log_due_date_change on tasks;
create trigger trg_tasks_log_due_date_change
after update on tasks
for each row execute function log_due_date_change();

NOTIFY pgrst, 'reload schema';
