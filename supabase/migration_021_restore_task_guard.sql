-- Migration: the "only Admin/Super" guard on tasks.deleted_at now covers
-- restoring a task too (setting deleted_at back to null), not just deleting
-- it — a symmetric protection for the new Restore feature.
-- Run this in Supabase SQL Editor. Safe to run more than once.

create or replace function prevent_unauthorized_delete()
returns trigger as $$
begin
  if (old.deleted_at is distinct from new.deleted_at) and not is_admin_or_super() then
    raise exception 'Only Admin/Super can delete or restore tasks';
  end if;
  return new;
end;
$$ language plpgsql;

NOTIFY pgrst, 'reload schema';
