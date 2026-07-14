-- Migration: allow a task to have multiple assignees. `assigned_to` stays
-- as the primary assignee (existing filters, board avatars, and assignment
-- emails still key off it) — `assignee_ids` holds the full set.
-- Run this in Supabase SQL Editor. Safe to run more than once.

alter table tasks add column if not exists assignee_ids uuid[] default '{}';

-- Backfill: anyone already assigned via the old single-assignee field
-- becomes their own one-person assignee_ids list.
update tasks
set assignee_ids = array[assigned_to]
where assigned_to is not null and (assignee_ids is null or assignee_ids = '{}');

NOTIFY pgrst, 'reload schema';
