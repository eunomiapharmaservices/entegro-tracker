-- Migration: gate registration to specific pre-approved emails, not just a
-- domain. Run this in Supabase SQL Editor if you already had the tracker
-- deployed before this update. Safe to run more than once.

create table if not exists allowed_emails (
  email text primary key,
  note text,
  created_at timestamptz default now()
);

alter table allowed_emails enable row level security;

drop policy if exists "authenticated_all_allowed_emails" on allowed_emails;
create policy "authenticated_all_allowed_emails" on allowed_emails for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create or replace function is_email_allowed(check_email text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from allowed_emails where lower(email) = lower(check_email)
  );
$$;

grant execute on function is_email_allowed(text) to anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- After running this, add at least one allowed email before anyone new can
-- register — either through the app's "Manage access" link (bottom of the
-- sidebar, once you're signed in) or directly here, e.g.:
-- insert into allowed_emails (email, note) values ('you@lumen.com', 'First admin');
