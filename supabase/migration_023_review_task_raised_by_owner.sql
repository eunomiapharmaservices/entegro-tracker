-- Migration: the auto-generated review task's "Raised by" is now set to
-- whoever owned the main task when it entered review (its assignee at that
-- moment), falling back to "System" if it was unassigned.
-- Run this in Supabase SQL Editor. Safe to run more than once.

create or replace function spawn_review_task()
returns trigger as $$
declare
  new_review_id uuid;
  reviewer_resource_id uuid;
  previous_owner_name text;
begin
  if new.status = 'review'
     and (old.status is distinct from 'review')
     and not coalesce(old.is_review_task, false) then

    reviewer_resource_id := new.reviewer_id;
    if reviewer_resource_id is null and new.raised_by is not null then
      select id into reviewer_resource_id
      from resources
      where lower(name) = lower(trim(new.raised_by))
      limit 1;
    end if;

    select name into previous_owner_name from resources where id = new.assigned_to;
    previous_owner_name := coalesce(previous_owner_name, 'System');

    insert into tasks (
      title, project_id, task_type, eid, site_name, assigned_to, assignee_ids,
      status, priority, is_review_task, review_of_task_id, date_added, raised_by
    ) values (
      new.title || ' Review',
      new.project_id, new.task_type, new.eid, new.site_name,
      reviewer_resource_id,
      case when reviewer_resource_id is not null then array[reviewer_resource_id] else '{}'::uuid[] end,
      'todo', new.priority, true, new.id, current_date, previous_owner_name
    )
    returning id into new_review_id;

    new.depends_on_task_id := new_review_id;
  end if;

  return new;
end;
$$ language plpgsql;

NOTIFY pgrst, 'reload schema';
