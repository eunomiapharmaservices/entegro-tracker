-- Migration:
--   - Adds "gcr" as a task status (it now lives in the Status dropdown
--     rather than being inferred from task type).
--   - Adds a helper returning active/completed task counts per project,
--     used by the Manage projects panel (including its "can only delete a
--     project with no tasks" rule).
-- Run this in Supabase SQL Editor. Safe to run more than once.

alter table tasks drop constraint if exists tasks_status_check;
alter table tasks add constraint tasks_status_check
  check (status in ('todo','in_progress','on_hold','review','gcr','done'));

-- Counts exclude soft-deleted tasks and subtasks, matching what the app
-- shows everywhere else.
create or replace function project_task_counts()
returns table(project_id uuid, active_count bigint, completed_count bigint)
language sql
security definer
set search_path = public
as $$
  select
    p.id as project_id,
    count(t.id) filter (where t.status <> 'done') as active_count,
    count(t.id) filter (where t.status = 'done') as completed_count
  from projects p
  left join tasks t
    on t.project_id = p.id
    and t.deleted_at is null
    and t.parent_task_id is null
  group by p.id;
$$;

grant execute on function project_task_counts() to authenticated;

NOTIFY pgrst, 'reload schema';
