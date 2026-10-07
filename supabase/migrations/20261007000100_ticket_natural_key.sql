-- One row per ticket: a client's ticket number is unique within a workspace.
--
-- Imports reuse the existing row's id when the same ticket arrives again, so a
-- re-uploaded export updates tickets instead of duplicating them. This index
-- makes the database hold to that. Duplicates from earlier imports are removed
-- first, keeping the row with the lowest id. Safe to run twice.

delete from public.tickets t
using public.tickets keep
where t.workspace_id = keep.workspace_id
  and t.client_id = keep.client_id
  and t.external_id = keep.external_id
  and t.id > keep.id;

create unique index if not exists tickets_ws_client_external_uidx on public.tickets (workspace_id, client_id, external_id);
