-- Migration: only Super Users can change roles/privileges; add a helper so
-- any signed-in user can check View Only status without needing broad
-- profile access (used to hide View Only people from workload views).
-- Run this in Supabase SQL Editor after migration_008_view_only_role.sql.
-- Safe to run more than once.

-- 1. Profiles: role changes are now Super-only (Admins keep everything else
--    in Manage Users — inviting, deleting accounts — just not role changes).
drop policy if exists "profiles_update_admin" on profiles;
drop policy if exists "profiles_update_super" on profiles;
create policy "profiles_update_super" on profiles for update
  using (is_super()) with check (is_super());

-- 2. Allowed emails: Admins can still invite/view/remove, but can only set
--    role = 'normal' — only Super can invite/edit someone straight into
--    Admin/Super/View Only.
drop policy if exists "authenticated_all_allowed_emails" on allowed_emails;
drop policy if exists "admin_all_allowed_emails" on allowed_emails;
drop policy if exists "allowed_emails_select" on allowed_emails;
drop policy if exists "allowed_emails_insert" on allowed_emails;
drop policy if exists "allowed_emails_update" on allowed_emails;
drop policy if exists "allowed_emails_delete" on allowed_emails;
create policy "allowed_emails_select" on allowed_emails for select
  using (is_admin_or_super());
create policy "allowed_emails_insert" on allowed_emails for insert
  with check (is_super() or (is_admin_or_super() and role = 'normal'));
create policy "allowed_emails_update" on allowed_emails for update
  using (is_admin_or_super())
  with check (is_super() or (is_admin_or_super() and role = 'normal'));
create policy "allowed_emails_delete" on allowed_emails for delete
  using (is_admin_or_super());

-- 3. Helper: any signed-in user can check whether an email is View Only,
--    without needing SELECT access to profiles/allowed_emails directly.
create or replace function view_only_emails()
returns setof text
language sql
security definer
set search_path = public
as $$
  select email from profiles where role = 'view'
  union
  select email from allowed_emails ae
    where ae.role = 'view'
    and lower(ae.email) not in (select lower(email) from profiles);
$$;

grant execute on function view_only_emails() to authenticated;

NOTIFY pgrst, 'reload schema';
