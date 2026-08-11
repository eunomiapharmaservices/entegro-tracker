-- Migration: workflow definition from Task_Form.xlsx
--
--   1. A task type can now trigger MORE THAN ONE dependent task (Audit
--      spawns both MRP Planning and Stranded X-connects removal), which the
--      old single-successor chain table couldn't express.
--   2. Each task type carries a checklist of subtasks, created automatically
--      with the task.
--   3. A task can't be completed until all of its subtasks are done.
--
-- Run this in Supabase SQL Editor. Safe to run more than once.

-- ---------------------------------------------------------------------------
-- 1. Chains: allow several successors per task type
-- ---------------------------------------------------------------------------
alter table task_type_chain drop constraint if exists task_type_chain_pkey;
alter table task_type_chain add column if not exists id uuid default gen_random_uuid();
update task_type_chain set id = gen_random_uuid() where id is null;
alter table task_type_chain alter column id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'task_type_chain_pkey'
  ) then
    alter table task_type_chain add constraint task_type_chain_pkey primary key (id);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'task_type_chain_pair_key'
  ) then
    alter table task_type_chain add constraint task_type_chain_pair_key unique (from_type, to_type);
  end if;
end $$;

delete from task_type_chain;

insert into task_type_chain (from_type, to_type) values
  ('Audit',                            'MRP Planning'),
  ('Audit',                            'Stranded X-connects removal'),
  ('Circuit/Ring Design and Planning', 'Pre Wires / TPC'),
  ('Circuit/Ring Design and Planning', 'Config & MOP Generation'),
  ('Pre Wires / TPC',                  'GCR creation and invites'),
  ('GCR creation and invites',         'GCR Support'),
  ('GCR Support',                      'Config Removal')
on conflict (from_type, to_type) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Subtask templates per task type
-- ---------------------------------------------------------------------------
create table if not exists task_type_subtask (
  id uuid primary key default gen_random_uuid(),
  task_type text not null,
  title text not null,
  position int not null default 0,
  created_at timestamptz default now(),
  unique (task_type, title)
);

alter table task_type_subtask enable row level security;

drop policy if exists "task_type_subtask_select" on task_type_subtask;
create policy "task_type_subtask_select" on task_type_subtask for select
  using (auth.role() = 'authenticated');

drop policy if exists "task_type_subtask_admin" on task_type_subtask;
create policy "task_type_subtask_admin" on task_type_subtask for all
  using (is_admin_or_super()) with check (is_admin_or_super());

delete from task_type_subtask;

insert into task_type_subtask (task_type, title, position) values
  ('Audit', 'Gather data into audit sheet', 1),
  ('Audit', 'Complete dispositions', 2),
  ('Audit', 'Review the Audit', 3),
  ('Audit', 'Upload results to ISV Tracker', 4),
  ('Audit', 'Upload results to deliverable file', 5),

  ('MRP Planning', 'Complete MRP', 1),
  ('MRP Planning', 'Update NAT', 2),

  ('Stranded X-connects removal', 'Stranded X-connects removal', 1),

  ('Circuit/Ring Design and Planning', 'Complete design', 1),
  ('Circuit/Ring Design and Planning', 'Reserve ports', 2),
  ('Circuit/Ring Design and Planning', 'Submit site survey (If Required)', 3),
  ('Circuit/Ring Design and Planning', 'Submit Netbuild', 4),
  ('Circuit/Ring Design and Planning', 'Order SFPs', 5),
  ('Circuit/Ring Design and Planning', 'Order prewires/TPC', 6),

  ('Pre Wires / TPC', 'Verify SFPs', 1),
  ('Pre Wires / TPC', 'Verify prewires', 2),
  ('Pre Wires / TPC', 'Confirm TPC support and orders', 3),

  ('Config & MOP Generation', 'Generate configuration', 1),
  ('Config & MOP Generation', 'Generate MOP', 2),
  ('Config & MOP Generation', 'Apply drop configuration on devices', 3),

  ('GCR creation and invites', 'Create GCR', 1),
  ('GCR creation and invites', 'Send meeting invite to all parties', 2),

  ('GCR Support', 'Verify GCR invites', 1),
  ('GCR Support', 'Validate all configurations', 2),
  ('GCR Support', 'Confirm SFPs', 3),
  ('GCR Support', 'Validate field/TPC support', 4),
  ('GCR Support', 'Ensure Netbuild accepted with no blockers', 5),
  ('GCR Support', 'FlightDeck Tasks upto date for NB and GCR', 6),
  ('GCR Support', 'GCR status in Scheduled', 7),
  ('GCR Support', 'GCR Completed', 8),
  ('GCR Support', 'Netbuild update saying GCR completed', 9),
  ('GCR Support', 'FlightDeck tasks closed after GCR completed', 10)
on conflict (task_type, title) do update set position = excluded.position;

-- ---------------------------------------------------------------------------
-- 3. Create the checklist automatically with the task
-- ---------------------------------------------------------------------------
create or replace function spawn_task_subtasks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only top-level tasks get a checklist (a subtask never spawns its own).
  if new.parent_task_id is not null or new.task_type is null then
    return new;
  end if;

  insert into tasks (title, parent_task_id, project_id, status, priority, position, date_added)
  select s.title, new.id, new.project_id, 'todo', 'medium', s.position, current_date
  from task_type_subtask s
  where lower(s.task_type) = lower(trim(new.task_type))
  order by s.position;

  return new;
end;
$$;

drop trigger if exists trg_tasks_spawn_subtasks on tasks;
create trigger trg_tasks_spawn_subtasks
after insert on tasks
for each row execute function spawn_task_subtasks();

-- ---------------------------------------------------------------------------
-- 4. Block completion while subtasks are outstanding
-- ---------------------------------------------------------------------------
create or replace function enforce_subtasks_complete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  outstanding int;
begin
  if new.status <> 'done' or old.status = 'done' then
    return new;
  end if;

  select count(*) into outstanding
  from tasks c
  where c.parent_task_id = new.id
    and c.deleted_at is null
    and c.status <> 'done';

  if outstanding > 0 then
    raise exception 'Complete all % subtask(s) before marking this task done', outstanding
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_tasks_enforce_subtasks on tasks;
create trigger trg_tasks_enforce_subtasks
before update on tasks
for each row execute function enforce_subtasks_complete();

-- ---------------------------------------------------------------------------
-- 5. Chain trigger: handle several successors per completed task
-- ---------------------------------------------------------------------------
create or replace function spawn_next_chain_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  already_exists boolean;
  root_title text;
  new_title text;
begin
  if new.status <> 'done' or old.status = 'done' then
    return new;
  end if;

  if new.deleted_at is not null or new.parent_task_id is not null then
    return new;
  end if;

  root_title := chain_root_title(new.id);

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

    new_title := coalesce(nullif(trim(root_title), ''), new.title) || ' - ' || rec.to_type;

    insert into tasks (
      title, project_id, task_type, eid, site_name,
      assigned_to, assignee_ids, raised_by,
      status, priority, date_added, auto_generated_from
    ) values (
      new_title, new.project_id, rec.to_type, new.eid, new.site_name,
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

drop trigger if exists trg_tasks_spawn_next_chain on tasks;
create trigger trg_tasks_spawn_next_chain
after update on tasks
for each row execute function spawn_next_chain_task();

NOTIFY pgrst, 'reload schema';
