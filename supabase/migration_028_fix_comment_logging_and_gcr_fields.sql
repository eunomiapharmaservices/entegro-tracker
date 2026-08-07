-- Migration:
--   1. Fixes comment logging. task_comments INSERT required can_edit(),
--      which needs a row in `profiles`. Any user without one (registered
--      before the profiles backfill, or missed by it) had every comment
--      insert silently rejected by RLS — so nothing was logged. Backfills
--      missing profiles, and relaxes the insert policy to any signed-in
--      user so the audit trail can never be silently dropped. Who can
--      actually post a comment is still gated in the UI (View Only users
--      get a read-only editor).
--   2. Adds the GCR-specific task fields.
-- Run this in Supabase SQL Editor. Safe to run more than once.

-- 1a. Backfill any auth user missing a profile row
insert into profiles (id, email, role)
select u.id, u.email, coalesce(ae.role, 'normal')
from auth.users u
left join allowed_emails ae on lower(ae.email) = lower(u.email)
where not exists (select 1 from profiles p where p.id = u.id)
on conflict (id) do nothing;

-- 1b. Never let RLS silently swallow a log entry
drop policy if exists "task_comments_insert_editors" on task_comments;
drop policy if exists "task_comments_insert_authenticated" on task_comments;
create policy "task_comments_insert_authenticated" on task_comments for insert
  with check (auth.role() = 'authenticated');

-- 2. GCR-specific fields, shown (and required) only when task type is GCR
alter table tasks add column if not exists netbuild_id text;
alter table tasks add column if not exists site_survey_id text;
alter table tasks add column if not exists gcr_id text;
alter table tasks add column if not exists gcr_date date;

NOTIFY pgrst, 'reload schema';
