-- Migration: auto-generated task chains.
--
-- Completing a task of a given type automatically creates the next task in
-- its workflow, in the same project and assigned to the same people:
--
--   Full Audit
--     -> Stranded X-connects removal
--     -> MRP Planning
--     -> Circuit Audit                 (chain ends)
--
--   Circuit/Ring Design and Planning
--     -> Config & MOP Generation
--     -> GCR Created and Invites Sent
--     -> GCR Support                   (chain ends)
--
-- Only the first task in each chain is created manually; the rest appear one
-- at a time as each predecessor is completed. Implemented as a trigger so it
-- fires no matter how a task is completed — the editor, dragging a card on
-- the board, or a CSV import.
--
-- Run this in Supabase SQL Editor. Safe to run more than once.

-- Which task type follows which. Editable later without touching app code:
-- just insert/update/delete rows here.
create table if not exists task_type_chain (
  from_type text primary key,
  to_type text not null,
  created_at timestamptz default now()
);

alter table task_type_chain enable row level security;

drop policy if exists "task_type_chain_select" on task_type_chain;
create policy "task_type_chain_select" on task_type_chain for select
  using (auth.role() = 'authenticated');

drop policy if exists "task_type_chain_admin" on task_type_chain;
create policy "task_type_chain_admin" on task_type_chain for all
  using (is_admin_or_super()) with check (is_admin_or_super());

insert into task_type_chain (from_type, to_type) values
  ('Full Audit',                       'Stranded X-connects removal'),
  ('Stranded X-connects removal',      'MRP Planning'),
  ('MRP Planning',                     'Circuit Audit'),
  ('Circuit/Ring Design and Planning', 'Config & MOP Generation'),
  ('Config & MOP Generation',          'GCR Created and Invites Sent'),
  ('GCR Created and Invites Sent',     'GCR Support')
on conflict (from_type) do update set to_type = excluded.to_type;

-- Flags a task that was created by this automation, so the UI can show it and
-- so we can tell auto-created work apart from manually-entered work.
alter table tasks add column if not exists auto_generated_from uuid references tasks(id) on delete set null;

create or replace function spawn_next_chain_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_type text;
  already_exists boolean;
  new_title text;
begin
  -- Only when a task actually transitions into 'done'.
  if new.status <> 'done' or old.status = 'done' then
    return new;
  end if;

  -- Review tasks and auto-generated chain steps still chain onward, but a
  -- deleted task shouldn't spawn anything.
  if new.deleted_at is not null then
    return new;
  end if;

  select c.to_type into next_type
  from task_type_chain c
  where lower(c.from_type) = lower(trim(coalesce(new.task_type, '')));

  if next_type is null then
    return new;
  end if;

  -- Don't create a duplicate if the next step already exists for this project
  -- (e.g. someone completed, reopened, and completed the task again).
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

  new_title := next_type;
  if next_type = 'GCR Support' then
    new_title := 'GCR Support – ' || coalesce(new.site_name, new.eid, 'task');
  end if;

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
