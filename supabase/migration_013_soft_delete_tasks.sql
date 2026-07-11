-- Migration: soft-delete tasks instead of removing them, so the comment log
-- (including "Task deleted" and all history) is never lost. Also adds a
-- DB-level guard so only Admin/Super can actually delete, since the normal
-- tasks UPDATE policy is open to any editor for regular field edits.
-- Run this in Supabase SQL Editor. Safe to run more than once.

alter table tasks add column if not exists deleted_at timestamptz;

create or replace function prevent_unauthorized_delete()
returns trigger as $$
begin
  if (old.deleted_at is null and new.deleted_at is not null) and not is_admin_or_super() then
    raise exception 'Only Admin/Super can delete tasks';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_tasks_prevent_unauthorized_delete on tasks;
create trigger trg_tasks_prevent_unauthorized_delete
before update on tasks
for each row execute function prevent_unauthorized_delete();

NOTIFY pgrst, 'reload schema';
