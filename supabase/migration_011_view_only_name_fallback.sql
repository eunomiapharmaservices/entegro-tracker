-- Migration: add a name-guess fallback for View Only matching, for People
-- entries that don't have an email linked yet (view_only_emails() alone
-- can't catch those, since matching is email-based).
-- Run this in Supabase SQL Editor. Safe to run more than once.

create or replace function view_only_people()
returns table(email text, name_guess text)
language sql
security definer
set search_path = public
as $$
  select email, initcap(split_part(split_part(email, '@', 1), '.', 1)) as name_guess
  from profiles where role = 'view'
  union
  select ae.email, initcap(split_part(split_part(ae.email, '@', 1), '.', 1))
  from allowed_emails ae
    where ae.role = 'view'
    and lower(ae.email) not in (select lower(email) from profiles);
$$;

grant execute on function view_only_people() to authenticated;

NOTIFY pgrst, 'reload schema';
