-- Migration: chained tasks are now named "<originating task title> - <next
-- task type>", e.g. completing a Full Audit called "Audit Rochester ring"
-- creates "Audit Rochester ring - Stranded X-connects removal".
--
-- The name carried through is the ROOT task of the chain (the manually
-- created one), not the immediate predecessor — otherwise each step would
-- append to the last and titles would grow into "A - B - C - D".
--
-- Run this in Supabase SQL Editor. Safe to run more than once.

-- Walks up the auto_generated_from links to find the title of the manually
-- created task that started the chain.
create or replace function chain_root_title(start_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  cur_id uuid := start_id;
  cur_title text;
  cur_parent uuid;
  hops int := 0;
begin
  loop
    select title, auto_generated_from into cur_title, cur_parent
    from tasks where id = cur_id;

    exit when cur_parent is null;

    cur_id := cur_parent;
    hops := hops + 1;
    -- Defensive stop: a malformed loop in the data shouldn't hang the insert.
    exit when hops > 20;
  end loop;

  return cur_title;
end;
$$;

create or replace function spawn_next_chain_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_type text;
  already_exists boolean;
  root_title text;
  new_title text;
begin
  if new.status <> 'done' or old.status = 'done' then
    return new;
  end if;

  if new.deleted_at is not null then
    return new;
  end if;

  select c.to_type into next_type
  from task_type_chain c
  where lower(c.from_type) = lower(trim(coalesce(new.task_type, '')));

  if next_type is null then
    return new;
  end if;

  select exists (
    select 1 from tasks t
    where t.deleted_at is null
      and lower(coalesce(t.task_type, '')) = lower(next_type)
      and t.project_id is not distinct from new.project_id
      and t.auto_generated_from = new.id
  ) into already_exists;

  if already_exists then
    return new;
  end if;

  -- Name the new task after whichever task started this chain.
  root_title := chain_root_title(new.id);
  new_title := coalesce(nullif(trim(root_title), ''), new.title) || ' - ' || next_type;

  insert into tasks (
    title, project_id, task_type, eid, site_name,
    assigned_to, assignee_ids, raised_by,
    status, priority, date_added, auto_generated_from
  ) values (
    new_title,
    new.project_id,
    next_type,
    new.eid,
    new.site_name,
    new.assigned_to,
    coalesce(new.assignee_ids, '{}'::uuid[]),
    coalesce(current_actor_name(), 'System'),
    'todo',
    coalesce(new.priority, 'medium'),
    current_date,
    new.id
  );

  insert into task_comments (task_id, body, author)
  values (
    new.id,
    format('Auto-created next task: "%s"', new_title),
    current_actor_name()
  );

  return new;
end;
$$;

drop trigger if exists trg_tasks_spawn_next_chain on tasks;
create trigger trg_tasks_spawn_next_chain
after update on tasks
for each row execute function spawn_next_chain_task();

NOTIFY pgrst, 'reload schema';
