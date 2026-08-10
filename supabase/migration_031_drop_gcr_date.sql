-- Migration: GCR tasks are now scheduled by Main Night / Backup Night, so the
-- separate GCR Date field is redundant and has been removed from the form.
--
-- The column is kept in the database (not dropped) so any dates already
-- captured aren't lost. To remove it permanently once you're satisfied
-- nothing needs it, uncomment the line below and run it.
--
-- alter table tasks drop column if exists gcr_date;

NOTIFY pgrst, 'reload schema';
