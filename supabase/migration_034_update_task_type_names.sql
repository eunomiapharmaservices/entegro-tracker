-- Migration: updates the auto-generated task chains to use the revised task
-- type names.
--
-- Renamed types:
--   "Full Audit"                   -> "Audit"
--   "GCR Created and Invites Sent" -> "GCR creation and invites"
--
-- Removed types: "Circuit Audit" no longer exists as a separate type (it's
-- covered by "Audit"), so the first chain now ends at MRP Planning rather
-- than continuing to Circuit Audit.
--
-- Resulting chains:
--   Audit -> Stranded X-connects removal -> MRP Planning   (ends)
--   Circuit/Ring Design and Planning -> Config & MOP Generation
--     -> GCR creation and invites -> GCR Support           (ends)
--
-- Run this in Supabase SQL Editor. Safe to run more than once.

-- Clear the old rules so renamed/removed types don't linger
delete from task_type_chain;

insert into task_type_chain (from_type, to_type) values
  ('Audit',                            'Stranded X-connects removal'),
  ('Stranded X-connects removal',      'MRP Planning'),
  ('Circuit/Ring Design and Planning', 'Config & MOP Generation'),
  ('Config & MOP Generation',          'GCR creation and invites'),
  ('GCR creation and invites',         'GCR Support')
on conflict (from_type) do update set to_type = excluded.to_type;

-- Optional: bring existing tasks onto the new naming so their chains still
-- fire. Review before running — this rewrites task_type on live rows.
--
-- update tasks set task_type = 'Audit'
--   where task_type in ('Full Audit', 'Circuit Audit');
-- update tasks set task_type = 'GCR creation and invites'
--   where task_type = 'GCR Created and Invites Sent';
-- update tasks set task_type = 'Data Cleanse' where task_type = 'Data-cleanse';
-- update tasks set task_type = 'Pre Wires / TPC' where task_type = 'Pre-wire';
-- update tasks set task_type = 'GCR Support' where task_type in ('GCR', 'GCR_Support');

NOTIFY pgrst, 'reload schema';
