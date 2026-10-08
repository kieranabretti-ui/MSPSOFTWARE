-- Tenant hardening.
--
-- Applies after 20261008000000_evidence_and_audit.sql. Safe to run twice.
--
-- 1. Tenant consistency. RLS checks a row's own workspace_id, but a foreign
--    key check does not go through RLS. Before this migration a member of
--    workspace A could insert a ticket with workspace_id = A that pointed at
--    workspace B's client: the policy passed (they belong to A) and the
--    foreign key passed (the client exists). B deleting that client would
--    then cascade into A's rows, and the error code told A whether any UUID
--    existed in another tenant. Every child -> parent reference is now a
--    composite foreign key on (workspace_id, <parent id>), so a reference can
--    only point inside the row's own workspace. workspace_id can't be changed
--    once a row exists, and stored file paths must sit in the row's own
--    workspace folder.
-- 2. Grants. The anon role (signed-out callers holding the public anon key)
--    gets nothing in the public schema. New tables, sequences and functions
--    no longer get default grants, so a table added later is closed until its
--    migration grants access on purpose.
-- 3. Server-written columns. findings.ai_explanation and findings.ai_meta can
--    only be written by the ai-review function (service role), so text shown
--    as AI-assisted really came from the model. When a finding's evidence or
--    values change, its AI explanation is cleared rather than left
--    describing old figures.
-- 4. Audit log. Members can't write events the server writes itself (AI
--    explanations, deletions), and the actor email comes from the account,
--    not from the browser.
-- 5. AI usage. ai_usage records every AI explanation request and
--    ai_take_quota() enforces a per-workspace daily cap and per-user limits
--    atomically. Only the service role can call it.
-- 6. Storage. The uploads bucket accepts PDF and plain text up to 20 MB,
--    whatever the browser does.
-- 7. One workspace per user (the product has no multi-workspace support), so
--    per-workspace limits can't be multiplied by creating workspaces.

-- ---------------------------------------------------------------- 1. tenant consistency

-- Parents expose (workspace_id, id) for composite references.
do $$
declare
  t text;
begin
  foreach t in array array['clients', 'uploads', 'analyses', 'findings'] loop
    if not exists (select 1 from pg_constraint where conname = t || '_ws_id_key' and conrelid = ('public.' || t)::regclass) then
      execute format('alter table public.%I add constraint %I unique (workspace_id, id)', t, t || '_ws_id_key');
    end if;
  end loop;
end $$;

-- Repair rows that already point across tenants. These can only have been
-- written on purpose through the API; the app never produces them. Required
-- references lose the row, optional ones are unlinked.
do $$
declare
  n int;
  t text;
begin
  foreach t in array array['contracts', 'tickets', 'time_entries', 'billing_items', 'assets', 'findings'] loop
    execute format(
      'delete from public.%I x using public.clients c where x.client_id = c.id and x.workspace_id <> c.workspace_id', t);
    get diagnostics n = row_count;
    if n > 0 then raise notice 'tenant_hardening: removed % cross-workspace rows from %', n, t; end if;
  end loop;

  update public.contracts x set upload_id = null from public.uploads u
    where x.upload_id = u.id and x.workspace_id <> u.workspace_id;
  update public.findings x set analysis_id = null from public.analyses a
    where x.analysis_id = a.id and x.workspace_id <> a.workspace_id;
  update public.reports x set analysis_id = null from public.analyses a
    where x.analysis_id = a.id and x.workspace_id <> a.workspace_id;
  update public.actions x set finding_id = null from public.findings f
    where x.finding_id = f.id and x.workspace_id <> f.workspace_id;
  update public.actions x set client_id = null from public.clients c
    where x.client_id = c.id and x.workspace_id <> c.workspace_id;
  update public.uploads set storage_path = null
    where storage_path is not null and storage_path not like workspace_id::text || '/%';
end $$;

-- Drop the single-column foreign keys (whatever they were named) ...
do $$
declare
  r record;
begin
  for r in
    select c.conrelid::regclass as tbl, c.conname
    from pg_constraint c
    where c.contype = 'f'
      and c.connamespace = 'public'::regnamespace
      and array_length(c.conkey, 1) = 1
      and ((select cl.relname::text from pg_class cl where cl.oid = c.conrelid), (select a.attname from pg_attribute a where a.attrelid = c.conrelid and a.attnum = c.conkey[1])::text) in (
        ('contracts', 'client_id'), ('contracts', 'upload_id'),
        ('tickets', 'client_id'), ('time_entries', 'client_id'), ('billing_items', 'client_id'), ('assets', 'client_id'),
        ('findings', 'client_id'), ('findings', 'analysis_id'),
        ('actions', 'finding_id'), ('actions', 'client_id'),
        ('reports', 'analysis_id')
      )
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;

-- ... and add composite ones. ON DELETE SET NULL (col) clears only the
-- reference, never workspace_id (Postgres 15+).
alter table public.contracts drop constraint if exists contracts_client_fk;
alter table public.contracts add constraint contracts_client_fk
  foreign key (workspace_id, client_id) references public.clients (workspace_id, id) on delete cascade;
alter table public.contracts drop constraint if exists contracts_upload_fk;
alter table public.contracts add constraint contracts_upload_fk
  foreign key (workspace_id, upload_id) references public.uploads (workspace_id, id) on delete set null (upload_id);

alter table public.tickets drop constraint if exists tickets_client_fk;
alter table public.tickets add constraint tickets_client_fk
  foreign key (workspace_id, client_id) references public.clients (workspace_id, id) on delete cascade;
alter table public.time_entries drop constraint if exists time_entries_client_fk;
alter table public.time_entries add constraint time_entries_client_fk
  foreign key (workspace_id, client_id) references public.clients (workspace_id, id) on delete cascade;
alter table public.billing_items drop constraint if exists billing_items_client_fk;
alter table public.billing_items add constraint billing_items_client_fk
  foreign key (workspace_id, client_id) references public.clients (workspace_id, id) on delete cascade;
alter table public.assets drop constraint if exists assets_client_fk;
alter table public.assets add constraint assets_client_fk
  foreign key (workspace_id, client_id) references public.clients (workspace_id, id) on delete cascade;

alter table public.findings drop constraint if exists findings_client_fk;
alter table public.findings add constraint findings_client_fk
  foreign key (workspace_id, client_id) references public.clients (workspace_id, id) on delete cascade;
alter table public.findings drop constraint if exists findings_analysis_fk;
alter table public.findings add constraint findings_analysis_fk
  foreign key (workspace_id, analysis_id) references public.analyses (workspace_id, id) on delete set null (analysis_id);

alter table public.actions drop constraint if exists actions_finding_fk;
alter table public.actions add constraint actions_finding_fk
  foreign key (workspace_id, finding_id) references public.findings (workspace_id, id) on delete set null (finding_id);
alter table public.actions drop constraint if exists actions_client_fk;
alter table public.actions add constraint actions_client_fk
  foreign key (workspace_id, client_id) references public.clients (workspace_id, id) on delete set null (client_id);

alter table public.reports drop constraint if exists reports_analysis_fk;
alter table public.reports add constraint reports_analysis_fk
  foreign key (workspace_id, analysis_id) references public.analyses (workspace_id, id) on delete set null (analysis_id);

-- Indexes for the cascades (a delete of a client scans these).
create index if not exists contracts_ws_client_idx on public.contracts (workspace_id, client_id);
create index if not exists billing_items_ws_client_idx on public.billing_items (workspace_id, client_id);
create index if not exists findings_ws_client_idx on public.findings (workspace_id, client_id);
create index if not exists findings_ws_analysis_idx on public.findings (workspace_id, analysis_id);
create index if not exists actions_ws_finding_idx on public.actions (workspace_id, finding_id);
create index if not exists reports_ws_analysis_idx on public.reports (workspace_id, analysis_id);

-- A stored file always sits in its own workspace's folder, so no path can
-- name another tenant's object.
alter table public.uploads drop constraint if exists uploads_storage_path_in_workspace;
alter table public.uploads add constraint uploads_storage_path_in_workspace
  check (storage_path is null or (storage_path like workspace_id::text || '/%' and storage_path not like '%..%'));

-- A row never moves between workspaces.
create or replace function public.keep_workspace_id()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.workspace_id is distinct from old.workspace_id then
    raise exception 'workspace_id cannot be changed' using errcode = '42501';
  end if;
  return new;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array['uploads', 'clients', 'contracts', 'tickets', 'time_entries', 'billing_items', 'assets', 'analyses', 'findings', 'actions', 'reports', 'audit_log'] loop
    execute format('drop trigger if exists %I_keep_workspace on public.%I', t, t);
    execute format('create trigger %I_keep_workspace before update of workspace_id on public.%I for each row execute function public.keep_workspace_id()', t, t);
  end loop;
end $$;

-- Size limits so one workspace can't store unbounded blobs through the API.
-- NOT VALID: they apply to new and changed rows; existing rows are left alone.
alter table public.contracts drop constraint if exists contracts_text_len;
alter table public.contracts add constraint contracts_text_len check (char_length(text) <= 1000000) not valid;
alter table public.findings drop constraint if exists findings_evidence_size;
alter table public.findings add constraint findings_evidence_size check (pg_column_size(evidence) < 262144) not valid;
alter table public.workspaces drop constraint if exists workspaces_settings_size;
alter table public.workspaces add constraint workspaces_settings_size check (pg_column_size(settings) < 16384) not valid;
alter table public.uploads drop constraint if exists uploads_file_name_len;
alter table public.uploads add constraint uploads_file_name_len check (char_length(file_name) <= 255) not valid;

-- ---------------------------------------------------------------- 2. grants

-- Signed-out callers get nothing in public.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from public, anon;

-- Nothing new is exposed by default: each future migration grants what it needs.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, authenticated;
-- PUBLIC's built-in EXECUTE on new functions can't be removed per schema, so
-- the end of this file revokes it from every function, and any new function
-- must revoke it itself (supabase/tests/rls.sql checks this).

-- What signed-in users may call (RLS policies call the first two).
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_owner(uuid) to authenticated;
grant execute on function public.create_workspace(text, jsonb, boolean) to authenticated;
grant execute on function public.delete_upload(uuid) to authenticated;
grant execute on function public.delete_analysis(uuid) to authenticated;
grant execute on function public.clear_workspace_data(uuid) to authenticated;
grant execute on function public.delete_workspace(uuid) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
-- Internal: trigger functions and helpers are never called through the API.
revoke execute on function public.write_audit(uuid, text, text, text, jsonb) from authenticated;
revoke execute on function public.set_updated_at() from authenticated;
revoke execute on function public.handle_new_user() from authenticated;
revoke execute on function public.audit_log_stamp() from authenticated;
revoke execute on function public.keep_workspace_id() from authenticated;

-- set_updated_at had a mutable search_path (Supabase linter 0011).
alter function public.set_updated_at() set search_path = '';

-- Workspaces are never deleted or inserted directly (delete_workspace and
-- create_workspace do that); memberships are never written directly.
revoke insert, delete on public.workspaces from authenticated;
revoke insert, update, delete on public.workspace_members from authenticated;

-- ---------------------------------------------------------------- 3. server-written AI columns

-- authenticated keeps INSERT and UPDATE on every findings column except the
-- two the ai-review function writes. Column grants are built from the live
-- column list, so a later migration adding a findings column must grant it.
do $$
declare
  cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'findings' and column_name not in ('ai_explanation', 'ai_meta');
  execute 'revoke insert, update on public.findings from authenticated';
  execute format('grant insert (%s), update (%s) on public.findings to authenticated', cols, cols);
end $$;
grant select, insert, update, delete on public.findings to service_role;

-- An explanation describes the evidence and values it was written for. If
-- the engine changes any of them, the old text is cleared rather than left
-- next to different figures.
create or replace function public.findings_clear_stale_ai()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.evidence is distinct from old.evidence
    or new.estimated_value is distinct from old.estimated_value
    or new.monthly_value is distinct from old.monthly_value
    or new.annual_value is distinct from old.annual_value
    or (new.meta -> 'calc') is distinct from (old.meta -> 'calc')
    or new.client_id is distinct from old.client_id then
    new.ai_explanation := null;
    new.ai_meta := null;
  end if;
  return new;
end $$;
revoke execute on function public.findings_clear_stale_ai() from authenticated;

drop trigger if exists findings_clear_stale_ai on public.findings;
create trigger findings_clear_stale_ai before update on public.findings
  for each row execute function public.findings_clear_stale_ai();

-- ---------------------------------------------------------------- 4. audit log

-- Events the server writes in the same transaction as the change. A member
-- can't add these by hand, so they can be trusted.
drop policy if exists "members append audit" on public.audit_log;
create policy "members append audit" on public.audit_log for insert to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and actor_id = auth.uid()
    and action not in ('ai.explained', 'upload.deleted', 'analysis.deleted', 'data.cleared', 'workspace.deleted', 'account.deleted')
  );

-- The actor's email comes from their account, not from the request.
create or replace function public.audit_log_actor_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.actor_id is not null then
    new.actor_email := (select u.email from auth.users u where u.id = new.actor_id);
  end if;
  return new;
end $$;
revoke execute on function public.audit_log_actor_email() from public, anon, authenticated;

-- Runs after audit_log_stamp (triggers fire in name order), so actor_id is final.
drop trigger if exists audit_log_x_actor_email on public.audit_log;
create trigger audit_log_x_actor_email before insert on public.audit_log
  for each row execute function public.audit_log_actor_email();

revoke update, delete, truncate on public.audit_log from authenticated;
grant select, insert on public.audit_log to service_role;

-- ---------------------------------------------------------------- 5. AI usage and rate limits

create table if not exists public.ai_usage (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  finding_id uuid,
  status text not null default 'started' check (status in ('started', 'ok', 'failed', 'rejected')),
  model text check (model is null or char_length(model) <= 100),
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_ws_created_idx on public.ai_usage (workspace_id, created_at desc);
create index if not exists ai_usage_user_created_idx on public.ai_usage (user_id, created_at desc);

alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;
-- Members can see their workspace's usage (for "n of m today"); only the
-- service role writes.
grant select on public.ai_usage to authenticated;
drop policy if exists "members read ai usage" on public.ai_usage;
create policy "members read ai usage" on public.ai_usage for select to authenticated
  using (public.is_workspace_member(workspace_id));
grant select, insert, update on public.ai_usage to service_role;
grant usage, select on sequence public.ai_usage_id_seq to service_role;

-- Reserves one AI call, or says why not. Serialised per workspace and per
-- user with advisory locks, so parallel requests can't overshoot the caps.
-- Every reserved call counts, including ones the model later fails, because
-- they can still cost money. Returns the usage row id, or null and a reason.
create or replace function public.ai_take_quota(
  p_workspace uuid,
  p_user uuid,
  p_finding uuid,
  p_workspace_daily int,
  p_user_hourly int,
  p_user_daily int
)
returns table (usage_id bigint, reason text)
language plpgsql security definer set search_path = '' as $$
declare
  n int;
  new_id bigint;
begin
  if not exists (select 1 from public.workspace_members m where m.workspace_id = p_workspace and m.user_id = p_user) then
    return query select null::bigint, 'not_member'::text;
    return;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('ai_usage:ws:' || p_workspace::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('ai_usage:user:' || p_user::text, 0));

  select count(*) into n from public.ai_usage u
    where u.workspace_id = p_workspace and u.created_at > now() - interval '1 day' and u.status <> 'rejected';
  if n >= p_workspace_daily then
    return query select null::bigint, 'workspace_daily'::text;
    return;
  end if;
  select count(*) into n from public.ai_usage u
    where u.user_id = p_user and u.created_at > now() - interval '1 hour' and u.status <> 'rejected';
  if n >= p_user_hourly then
    return query select null::bigint, 'user_hourly'::text;
    return;
  end if;
  select count(*) into n from public.ai_usage u
    where u.user_id = p_user and u.created_at > now() - interval '1 day' and u.status <> 'rejected';
  if n >= p_user_daily then
    return query select null::bigint, 'user_daily'::text;
    return;
  end if;

  insert into public.ai_usage (workspace_id, user_id, finding_id) values (p_workspace, p_user, p_finding)
  returning id into new_id;
  return query select new_id, null::text;
end $$;
revoke execute on function public.ai_take_quota(uuid, uuid, uuid, int, int, int) from public, anon, authenticated;
grant execute on function public.ai_take_quota(uuid, uuid, uuid, int, int, int) to service_role;

-- ---------------------------------------------------------------- 6. storage

-- Contract files only: PDF or plain text, 20 MB at most (the browser checks
-- the same, but a direct API call skips the browser).
update storage.buckets
set public = false,
    file_size_limit = 20971520,
    allowed_mime_types = array['application/pdf', 'text/plain']
where id = 'uploads';

-- Objects can't be overwritten (no UPDATE policy) and their name must be
-- <workspace uuid>/<file> with nothing that climbs out of the folder.
drop policy if exists "workspace files write" on storage.objects;
create policy "workspace files write" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'uploads'
    and name !~ '(^|/)\.\.(/|$)'
    and array_length(storage.foldername(name), 1) = 1
    and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
  );

-- ---------------------------------------------------------------- 7. one workspace per user

create or replace function public.create_workspace(ws_name text, ws_settings jsonb default '{}'::jsonb, ws_is_demo boolean default false)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  -- Serialise per user so a double-submitted form can't create two.
  perform pg_advisory_xact_lock(hashtextextended('create_workspace:' || auth.uid()::text, 0));
  if exists (select 1 from public.workspace_members m where m.user_id = auth.uid() and m.role = 'owner') then
    raise exception 'You already have a workspace' using errcode = '23505';
  end if;
  insert into public.workspaces (name, settings, is_demo) values (ws_name, coalesce(ws_settings, '{}'::jsonb), ws_is_demo)
  returning id into new_id;
  insert into public.workspace_members (workspace_id, user_id, role) values (new_id, auth.uid(), 'owner');
  return new_id;
end $$;
revoke execute on function public.create_workspace(text, jsonb, boolean) from public, anon;
grant execute on function public.create_workspace(text, jsonb, boolean) to authenticated;

-- is_workspace_member pinned to an empty search_path like the newer helpers.
create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid()
  )
$$;

-- ---------------------------------------------------------------- final sweep

-- Covers every function above: nothing in public is callable by signed-out
-- callers. Signed-in callers keep only what was granted explicitly.
revoke execute on all functions in schema public from public, anon;
