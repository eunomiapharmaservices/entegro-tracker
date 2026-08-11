-- Migration:
--   1. Ring counters on projects (Manage projects).
--   2. tasks.title_suffix — the free-text part a user adds after the
--      auto-generated "EID <project> – <task type>" title prefix. Storing it
--      separately lets chained tasks rebuild their own title correctly.
--   3. Everyone can view and edit projects (previously Admin/Super only);
--      deleting a project stays Admin/Super.
--   4. Parent task progress is derived from its subtasks.
--
-- Run this in Supabase SQL Editor. Safe to run more than once.

alter table projects add column if not exists total_rings int default 0;
alter table projects add column if not exists rings_migrated int default 0;
alter table tasks add column if not exists title_suffix text;

-- 3. Open project editing to any signed-in user
drop policy if exists "projects_update_admin" on projects;
drop policy if exists "projects_update_all" on projects;
create policy "projects_update_all" on projects for update
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
-- (delete stays admin-only via the existing projects_delete_admin policy)

-- 4. Keep a parent task's progress in step with its subtasks
create or replace function sync_parent_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent uuid;
  total int;
  done_count int;
begin
  parent := coalesce(new.parent_task_id, old.parent_task_id);
  if parent is null then
    return coalesce(new, old);
  end if;

  select count(*), count(*) filter (where status = 'done')
    into total, done_count
  from tasks
  where parent_task_id = parent and deleted_at is null;

  if total > 0 then
    update tasks
    set progress_percent = round((done_count::numeric / total) * 100)
    where id = parent;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_tasks_sync_parent_progress on tasks;
create trigger trg_tasks_sync_parent_progress
after insert or update or delete on tasks
for each row execute function sync_parent_progress();

NOTIFY pgrst, 'reload schema';

-- 5. Chained tasks rebuild their own title from the project's EID, their own
--    task type, and the suffix carried down from the task that started the
--    chain: "EID <eid> – <task type> – <suffix>"
create or replace function spawn_next_chain_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  already_exists boolean;
  suffix text;
  proj_ident text;
  new_title text;
begin
  if new.status <> 'done' or old.status = 'done' then
    return new;
  end if;

  if new.deleted_at is not null or new.parent_task_id is not null then
    return new;
  end if;

  -- The user-entered part travels down the chain unchanged.
  suffix := nullif(trim(coalesce(new.title_suffix, '')), '');

  select coalesce(nullif(trim(p.eid), ''), p.name) into proj_ident
  from projects p where p.id = new.project_id;

  for rec in
    select c.to_type
    from task_type_chain c
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

    new_title := 'EID ' || coalesce(proj_ident, '') || ' – ' || rec.to_type;
    if suffix is not null then
      new_title := new_title || ' – ' || suffix;
    end if;

    insert into tasks (
      title, title_suffix, project_id, task_type, eid, site_name,
      assigned_to, assignee_ids, raised_by,
      status, priority, date_added, auto_generated_from
    ) values (
      new_title, suffix, new.project_id, rec.to_type, new.eid, new.site_name,
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
