-- Migration: GCR tasks are scheduled by Main Night / Backup Night rather than
-- start and due dates. Both appear on the calendar so the task shows on each
-- of the two nights.
-- Run this in Supabase SQL Editor. Safe to run more than once.

alter table tasks add column if not exists main_night date;
alter table tasks add column if not exists backup_night date;

NOTIFY pgrst, 'reload schema';
