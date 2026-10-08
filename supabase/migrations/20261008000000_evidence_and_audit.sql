-- Evidence, decisions, audit log and deletion controls.
--
-- 1. Provenance: every imported row records the upload (file) and row it was
--    read from, in a nullable `source jsonb` column:
--      {"upload_id": "<uuid>", "file_name": "tickets.csv", "row": 31}
-- 2. Findings keep the MSP's decision (dismiss reason, note, owner, when) and
--    the evidence model (claims, classification, AI metadata). A finding a
--    person decided on is marked stale, not deleted, when a later analysis no
--    longer reproduces it.
-- 3. audit_log: an append-only record of key actions. It holds ids, counts and
--    stage names only, never client data values. Members can read and append;
--    nobody can update or delete rows through the Data API.
-- 4. Deletion RPCs: delete one upload and the rows it produced, delete an
--    analysis, clear a workspace's data, delete a workspace, delete the
--    caller's account. Stored files are removed by the client (Supabase
--    Storage objects can't be deleted from SQL); each RPC returns the paths.
--
-- Applies on top of 20261006000000_init.sql, 20261007000000 and 20261007000100.

-- ---------------------------------------------------------------- provenance

alter table public.clients add column if not exists source jsonb;
alter table public.tickets add column if not exists source jsonb;
alter table public.time_entries add column if not exists source jsonb;
alter table public.billing_items add column if not exists source jsonb;
alter table public.assets add column if not exists source jsonb;

-- Lookups by upload for delete_upload().
create index if not exists clients_source_upload_idx on public.clients (workspace_id, (source ->> 'upload_id'));
create index if not exists tickets_source_upload_idx on public.tickets (workspace_id, (source ->> 'upload_id'));
create index if not exists time_entries_source_upload_idx on public.time_entries (workspace_id, (source ->> 'upload_id'));
create index if not exists billing_items_source_upload_idx on public.billing_items (workspace_id, (source ->> 'upload_id'));
create index if not exists assets_source_upload_idx on public.assets (workspace_id, (source ->> 'upload_id'));

-- ---------------------------------------------------------------- findings: evidence and decisions

alter table public.findings add column if not exists claims jsonb not null default '[]'::jsonb;
alter table public.findings add column if not exists classification text;
alter table public.findings add column if not exists ai_meta jsonb;
alter table public.findings add column if not exists dismiss_reason text;
alter table public.findings add column if not exists decision_note text;
alter table public.findings add column if not exists owner text;
alter table public.findings add column if not exists decided_at timestamptz;
alter table public.findings add column if not exists first_viewed_at timestamptz;
alter table public.findings add column if not exists stale boolean not null default false;

alter table public.findings drop constraint if exists findings_classification_check;
alter table public.findings add constraint findings_classification_check
  check (classification is null or classification in ('confirmed', 'potential', 'investigate'));
alter table public.findings drop constraint if exists findings_dismiss_reason_check;
alter table public.findings add constraint findings_dismiss_reason_check
  check (dismiss_reason is null or dismiss_reason in ('goodwill', 'already_billed', 'data_wrong', 'contract_allows', 'relationship', 'other'));
alter table public.findings drop constraint if exists findings_decision_note_len;
alter table public.findings add constraint findings_decision_note_len check (decision_note is null or char_length(decision_note) <= 2000);
alter table public.findings drop constraint if exists findings_owner_len;
alter table public.findings add constraint findings_owner_len check (owner is null or char_length(owner) <= 200);
-- A dismissal always carries a reason, so a false positive can be told apart
-- from "valid, but not pursuing". Older dismissed rows get 'other'.
update public.findings set dismiss_reason = 'other' where status = 'dismissed' and dismiss_reason is null;
alter table public.findings drop constraint if exists findings_dismiss_needs_reason;
alter table public.findings add constraint findings_dismiss_needs_reason check (status <> 'dismissed' or dismiss_reason is not null);

-- ---------------------------------------------------------------- audit log

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  actor_id uuid default auth.uid(),
  actor_email text check (actor_email is null or char_length(actor_email) <= 320),
  action text not null check (action in (
    'upload.created', 'upload.deleted',
    'analysis.run', 'analysis.deleted',
    'finding.created', 'finding.viewed', 'finding.stage_changed', 'finding.dismissed', 'finding.reopened', 'finding.note', 'finding.owner',
    'ai.explained',
    'export.pdf', 'export.csv',
    'settings.changed', 'data.cleared', 'workspace.deleted', 'account.deleted'
  )),
  target_type text check (target_type is null or char_length(target_type) <= 40),
  target_id text check (target_id is null or char_length(target_id) <= 64),
  detail jsonb not null default '{}'::jsonb check (jsonb_typeof(detail) = 'object' and pg_column_size(detail) < 4096),
  created_at timestamptz not null default now()
);
create index if not exists audit_log_ws_created_idx on public.audit_log (workspace_id, created_at desc);

-- The server decides who and when: a client can't backdate an event or write
-- one in someone else's name.
create or replace function public.audit_log_stamp()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.created_at := now();
  if auth.uid() is not null then
    new.actor_id := auth.uid();
  end if;
  return new;
end $$;

drop trigger if exists audit_log_stamp on public.audit_log;
create trigger audit_log_stamp before insert on public.audit_log
  for each row execute function public.audit_log_stamp();

alter table public.audit_log enable row level security;

drop policy if exists "members read audit" on public.audit_log;
create policy "members read audit" on public.audit_log for select to authenticated
  using (public.is_workspace_member(workspace_id));
drop policy if exists "members append audit" on public.audit_log;
create policy "members append audit" on public.audit_log for insert to authenticated
  with check (public.is_workspace_member(workspace_id) and actor_id = auth.uid());

-- Append-only: init.sql's grant was a one-off over the tables that existed
-- then, so grant exactly what's needed and nothing else.
revoke all on public.audit_log from anon, authenticated;
grant select, insert on public.audit_log to authenticated;

-- Internal helper for the RPCs below (not callable through the API).
create or replace function public.write_audit(ws uuid, act text, t_type text, t_id text, det jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_log (workspace_id, actor_id, actor_email, action, target_type, target_id, detail)
  values (ws, auth.uid(), (select u.email from auth.users u where u.id = auth.uid()), act, t_type, t_id, coalesce(det, '{}'::jsonb));
$$;
revoke all on function public.write_audit(uuid, text, text, text, jsonb) from public, anon, authenticated;

-- Owner of a workspace (as opposed to any member).
create or replace function public.is_workspace_owner(ws uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid() and m.role = 'owner'
  )
$$;

-- ---------------------------------------------------------------- deletion RPCs

-- Deletes one upload and the rows it produced (rows whose source names it).
-- A row belongs to the last file that wrote it: a re-upload re-stamps rows.
-- Clients are only removed when nothing else of theirs remains; otherwise
-- their provenance is cleared and they stay. Returns the stored file path (or
-- null) so the client can remove the object from Storage.
create or replace function public.delete_upload(p_upload_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  ws uuid;
  k text;
  path text;
  u_key text := p_upload_id::text;
  n_tickets int; n_time int; n_billing int; n_assets int; n_contracts int; n_clients int; n_kept int;
begin
  select u.workspace_id, u.kind, u.storage_path into ws, k, path from public.uploads u where u.id = p_upload_id;
  if ws is null or not public.is_workspace_member(ws) then
    raise exception 'Upload not found' using errcode = 'P0002';
  end if;

  delete from public.tickets where workspace_id = ws and source ->> 'upload_id' = u_key;
  get diagnostics n_tickets = row_count;
  delete from public.time_entries where workspace_id = ws and source ->> 'upload_id' = u_key;
  get diagnostics n_time = row_count;
  delete from public.billing_items where workspace_id = ws and source ->> 'upload_id' = u_key;
  get diagnostics n_billing = row_count;
  delete from public.assets where workspace_id = ws and source ->> 'upload_id' = u_key;
  get diagnostics n_assets = row_count;
  delete from public.contracts where workspace_id = ws and upload_id = p_upload_id;
  get diagnostics n_contracts = row_count;

  delete from public.clients c
  where c.workspace_id = ws and c.source ->> 'upload_id' = u_key
    and not exists (select 1 from public.tickets x where x.client_id = c.id)
    and not exists (select 1 from public.time_entries x where x.client_id = c.id)
    and not exists (select 1 from public.billing_items x where x.client_id = c.id)
    and not exists (select 1 from public.assets x where x.client_id = c.id)
    and not exists (select 1 from public.contracts x where x.client_id = c.id);
  get diagnostics n_clients = row_count;
  update public.clients set source = null where workspace_id = ws and source ->> 'upload_id' = u_key;
  get diagnostics n_kept = row_count;

  delete from public.uploads where id = p_upload_id;

  perform public.write_audit(ws, 'upload.deleted', 'upload', u_key, jsonb_build_object(
    'kind', k, 'tickets', n_tickets, 'time_entries', n_time, 'billing_items', n_billing, 'assets', n_assets,
    'contracts', n_contracts, 'clients', n_clients, 'clients_kept', n_kept, 'file_stored', path is not null));
  return path;
end $$;

-- Deletes one analysis, the findings it produced and the reports made from
-- it. Tasks on those findings stay, unlinked. Source data is untouched.
create or replace function public.delete_analysis(p_analysis_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  ws uuid;
  n_findings int; n_reports int;
begin
  select a.workspace_id into ws from public.analyses a where a.id = p_analysis_id;
  if ws is null or not public.is_workspace_member(ws) then
    raise exception 'Analysis not found' using errcode = 'P0002';
  end if;
  delete from public.findings where workspace_id = ws and analysis_id = p_analysis_id;
  get diagnostics n_findings = row_count;
  delete from public.reports where workspace_id = ws and analysis_id = p_analysis_id;
  get diagnostics n_reports = row_count;
  delete from public.analyses where id = p_analysis_id;
  perform public.write_audit(ws, 'analysis.deleted', 'analysis', p_analysis_id::text,
    jsonb_build_object('findings', n_findings, 'reports', n_reports));
end $$;

-- Removes every data row in a workspace in one transaction, keeping the
-- workspace, its settings and the audit log. Returns the stored file paths.
create or replace function public.clear_workspace_data(ws uuid)
returns text[] language plpgsql security definer set search_path = '' as $$
declare
  paths text[];
  n_uploads int;
begin
  if ws is null or not public.is_workspace_member(ws) then
    raise exception 'Workspace not found' using errcode = 'P0002';
  end if;
  select coalesce(array_agg(storage_path), '{}') into paths from public.uploads where workspace_id = ws and storage_path is not null;
  delete from public.actions where workspace_id = ws;
  delete from public.findings where workspace_id = ws;
  delete from public.reports where workspace_id = ws;
  delete from public.analyses where workspace_id = ws;
  delete from public.contracts where workspace_id = ws;
  delete from public.tickets where workspace_id = ws;
  delete from public.time_entries where workspace_id = ws;
  delete from public.billing_items where workspace_id = ws;
  delete from public.assets where workspace_id = ws;
  delete from public.uploads where workspace_id = ws;
  get diagnostics n_uploads = row_count;
  delete from public.clients where workspace_id = ws;
  perform public.write_audit(ws, 'data.cleared', 'workspace', ws::text, jsonb_build_object('uploads', n_uploads));
  return paths;
end $$;

-- Deletes a workspace and everything in it (owner only). Every table,
-- audit_log included, cascades from workspaces. Remove the workspace's stored
-- files first: Storage objects aren't covered by the cascade.
create or replace function public.delete_workspace(ws uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if ws is null or not public.is_workspace_owner(ws) then
    raise exception 'Only the workspace owner can delete it' using errcode = '42501';
  end if;
  delete from public.workspaces where id = ws;
end $$;

-- Deletes the caller's account: every workspace they own (cascading all
-- data), then their auth user (profile and memberships cascade). The client
-- removes stored files and signs out.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  delete from public.workspaces w
  where exists (select 1 from public.workspace_members m where m.workspace_id = w.id and m.user_id = uid and m.role = 'owner');
  delete from auth.users where id = uid;
end $$;

revoke all on function public.delete_upload(uuid) from public, anon;
revoke all on function public.delete_analysis(uuid) from public, anon;
revoke all on function public.clear_workspace_data(uuid) from public, anon;
revoke all on function public.delete_workspace(uuid) from public, anon;
revoke all on function public.delete_my_account() from public, anon;
revoke all on function public.is_workspace_owner(uuid) from public, anon;
grant execute on function public.delete_upload(uuid) to authenticated;
grant execute on function public.delete_analysis(uuid) to authenticated;
grant execute on function public.clear_workspace_data(uuid) to authenticated;
grant execute on function public.delete_workspace(uuid) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.is_workspace_owner(uuid) to authenticated;
