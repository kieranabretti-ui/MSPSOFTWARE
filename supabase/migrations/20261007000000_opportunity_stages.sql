-- Opportunity stages: adds 'reviewing' to the finding status values.
--
-- The stored values predate the stage names the app shows, and map to them as:
--   open      = New
--   reviewing = Reviewing
--   valid     = Approved
--   resolved  = Actioned
--   dismissed = Dismissed
--
-- Existing rows keep their values, so no data changes. Safe to run twice.

alter table public.findings drop constraint if exists findings_status_check;
alter table public.findings add constraint findings_status_check check (status in ('open', 'reviewing', 'valid', 'dismissed', 'resolved'));
