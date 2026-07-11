-- Migration: let Admins change someone's role to Normal or View Only
-- (routine day-to-day access management) — granting Admin or Super itself
-- remains Super-only, so privilege escalation always needs a Super's say-so.
-- Run this in Supabase SQL Editor. Safe to run more than once.

drop policy if exists "profiles_update_admin" on profiles;
drop policy if exists "profiles_update_super" on profiles;
drop policy if exists "profiles_update_role" on profiles;
create policy "profiles_update_role" on profiles for update
  using (is_admin_or_super())
  with check (is_super() or (is_admin_or_super() and role in ('normal', 'view')));

drop policy if exists "authenticated_all_allowed_emails" on allowed_emails;
drop policy if exists "admin_all_allowed_emails" on allowed_emails;
drop policy if exists "allowed_emails_select" on allowed_emails;
drop policy if exists "allowed_emails_insert" on allowed_emails;
drop policy if exists "allowed_emails_update" on allowed_emails;
drop policy if exists "allowed_emails_delete" on allowed_emails;
create policy "allowed_emails_select" on allowed_emails for select
  using (is_admin_or_super());
create policy "allowed_emails_insert" on allowed_emails for insert
  with check (is_super() or (is_admin_or_super() and role in ('normal', 'view')));
create policy "allowed_emails_update" on allowed_emails for update
  using (is_admin_or_super())
  with check (is_super() or (is_admin_or_super() and role in ('normal', 'view')));
create policy "allowed_emails_delete" on allowed_emails for delete
  using (is_admin_or_super());

NOTIFY pgrst, 'reload schema';
