-- Migration:
--   1. Changing an existing task's Task Type now adds that type's predefined
--      subtasks, even if the task was created before the change.
--   2. Auto-generated chained tasks no longer carry the user's "add more
--      details" text — each gets a clean "EID <project> – <task type>" title.
--
-- Run this in Supabase SQL Editor. Safe to run more than once.

-- 1. Add the checklist when a task's type changes (existing subtasks with the
--    same title are left alone, so nothing is duplicated).
create or replace function subtasks_on_type_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.parent_task_id is not null then
    return new;
  end if;
  if new.task_type is null or new.task_type is not distinct from old.task_type then
    return new;
  end if;

  insert into tasks (title, parent_task_id, project_id, status, priority, position, date_added)
  select s.title, new.id, new.project_id, 'todo', 'medium', s.position, current_date
  from task_type_subtask s
  where lower(s.task_type) = lower(trim(new.task_type))
    and not exists (
      select 1 from tasks existing
      where existing.parent_task_id = new.id
        and existing.deleted_at is null
        and lower(existing.title) = lower(s.title)
    )
  order by s.position;

  return new;
end;
$$;

drop trigger if exists trg_tasks_subtasks_on_type_change on tasks;
create trigger trg_tasks_subtasks_on_type_change
after update on tasks
for each row execute function subtasks_on_type_change();

-- 2. Chained tasks get a clean title with no inherited detail text.
create or replace function spawn_next_chain_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  already_exists boolean;
  proj_ident text;
  new_title text;
begin
  if new.status <> 'done' or old.status = 'done' then
    return new;
  end if;
  if new.deleted_at is not null or new.parent_task_id is not null then
    return new;
  end if;

  select coalesce(nullif(trim(p.eid), ''), p.name) into proj_ident
  from projects p where p.id = new.project_id;

  for rec in
    select c.to_type from task_type_chain c
    where lower(c.from_type) = lower(trim(coalesce(new.task_type, '')))
    order by c.to_type
  loop
    select exists (
      select 1 from tasks t
      where t.deleted_at is null
        and lower(coalesce(t.task_type, '')) = lower(rec.to_type)
        and t.auto_generated_from = new.id
    ) into already_exists;

    continue when already_exists;

    -- No title_suffix carried over — the detail on the originating task
    -- doesn't necessarily describe the next step.
    new_title := 'EID ' || coalesce(proj_ident, '') || ' – ' || rec.to_type;

    insert into tasks (
      title, title_suffix, project_id, task_type, eid, site_name,
      assigned_to, assignee_ids, raised_by,
      status, priority, date_added, auto_generated_from
    ) values (
      new_title, null, new.project_id, rec.to_type, new.eid, new.site_name,
      new.assigned_to, coalesce(new.assignee_ids, '{}'::uuid[]),
      coalesce(current_actor_name(), 'System'),
      'todo', coalesce(new.priority, 'medium'), current_date, new.id
    );

    insert into task_comments (task_id, body, author)
    values (new.id, format('Auto-created next task: "%s"', new_title), current_actor_name());
  end loop;

  return new;
end;
$$;

NOTIFY pgrst, 'reload schema';
