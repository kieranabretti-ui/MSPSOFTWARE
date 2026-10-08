-- Tenant isolation checks.
--
-- What it proves: a signed-in member of workspace A can't read, change,
-- delete or reference anything in workspace B, through tables, foreign keys,
-- RPCs or Storage; server-written columns and audit events can't be forged;
-- signed-out (anon) callers get nothing; every public table has RLS on.
--
-- How to run: paste the whole file into the Supabase SQL editor (or
-- `psql "$DB_URL" -f supabase/tests/rls.sql`) on a project with every
-- migration applied. It creates two throwaway test users and their
-- workspaces inside one transaction and ROLLS BACK at the end, so nothing is
-- left behind. Each check prints "PASS ..." as a NOTICE; the first failure
-- raises "FAIL ..." and aborts. Run it on a staging project first: it inserts
-- into auth.users inside the transaction.
--
-- Users are simulated the way PostgREST does it: SET ROLE authenticated plus
-- the JWT claims setting that auth.uid() reads.

begin;

-- ------------------------------------------------------------ helpers

-- Runs a statement and passes only if it fails with one of the given SQLSTATEs.
create function pg_temp.expect_error(stmt text, codes text[], label text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if sqlstate = any (codes) then
      raise notice 'PASS %: refused (%)', label, sqlstate;
      return;
    end if;
    raise exception 'FAIL %: expected % but got % (%)', label, codes, sqlstate, sqlerrm;
  end;
  raise exception 'FAIL %: statement succeeded but should have been refused', label;
end $$;

-- Runs a statement and passes only if it touched exactly n rows.
create function pg_temp.expect_rows(stmt text, n int, label text) returns void language plpgsql as $$
declare
  got int;
begin
  execute stmt;
  get diagnostics got = row_count;
  if got <> n then
    raise exception 'FAIL %: expected % rows, got %', label, n, got;
  end if;
  raise notice 'PASS %: % rows', label, got;
end $$;

-- Runs a query returning one number and passes if it equals n.
create function pg_temp.expect_value(query text, n bigint, label text) returns void language plpgsql as $$
declare
  got bigint;
begin
  execute query into got;
  if got is distinct from n then
    raise exception 'FAIL %: expected %, got %', label, n, got;
  end if;
  raise notice 'PASS %: %', label, got;
end $$;

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
end $$;

-- ------------------------------------------------------------ fixtures (as the database owner)

-- User A owns workspace A; user B owns workspace B.
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'rls-test-a@example.invalid'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'rls-test-b@example.invalid');

insert into public.workspaces (id, name) values
  ('aaaaaaaa-0000-4000-8000-0000000000aa', 'RLS test A'),
  ('bbbbbbbb-0000-4000-8000-0000000000bb', 'RLS test B');
insert into public.workspace_members (workspace_id, user_id, role) values
  ('aaaaaaaa-0000-4000-8000-0000000000aa', 'aaaaaaaa-0000-4000-8000-000000000001', 'owner'),
  ('bbbbbbbb-0000-4000-8000-0000000000bb', 'bbbbbbbb-0000-4000-8000-000000000001', 'owner');

insert into public.clients (id, workspace_id, name) values
  ('aaaaaaaa-0000-4000-8000-0000000000c1', 'aaaaaaaa-0000-4000-8000-0000000000aa', 'Client of A'),
  ('bbbbbbbb-0000-4000-8000-0000000000c1', 'bbbbbbbb-0000-4000-8000-0000000000bb', 'Client of B');
insert into public.uploads (id, workspace_id, kind, file_name, storage_path) values
  ('bbbbbbbb-0000-4000-8000-0000000000f1', 'bbbbbbbb-0000-4000-8000-0000000000bb', 'contract', 'b.pdf', 'bbbbbbbb-0000-4000-8000-0000000000bb/x-b.pdf');
insert into public.analyses (id, workspace_id, period_start, period_end, summary) values
  ('aaaaaaaa-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-0000000000aa', '2026-01-01', '2026-06-30', '{}'),
  ('bbbbbbbb-0000-4000-8000-0000000000a1', 'bbbbbbbb-0000-4000-8000-0000000000bb', '2026-01-01', '2026-06-30', '{}');
insert into public.findings (id, workspace_id, analysis_id, client_id, finding_key, category, severity, confidence, title, description, recommended_action, evidence, ai_explanation) values
  ('aaaaaaaa-0000-4000-8000-0000000000e1', 'aaaaaaaa-0000-4000-8000-0000000000aa', 'aaaaaaaa-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-0000000000c1', 'k-a', 'OTHER', 'LOW', 50, 't', 'd', 'r', '[{"kind":"x","label":"l","text":"t"}]', 'Written by the AI function'),
  ('bbbbbbbb-0000-4000-8000-0000000000e1', 'bbbbbbbb-0000-4000-8000-0000000000bb', 'bbbbbbbb-0000-4000-8000-0000000000a1', 'bbbbbbbb-0000-4000-8000-0000000000c1', 'k-b', 'OTHER', 'LOW', 50, 't', 'd', 'r', '[]', null);
insert into public.audit_log (workspace_id, actor_id, action) values
  ('bbbbbbbb-0000-4000-8000-0000000000bb', 'bbbbbbbb-0000-4000-8000-000000000001', 'analysis.run');
insert into storage.objects (bucket_id, name) values ('uploads', 'bbbbbbbb-0000-4000-8000-0000000000bb/x-b.pdf');

-- ------------------------------------------------------------ structure

-- Every table in public has RLS switched on.
select pg_temp.expect_value($q$
  select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
$q$, 0, 'every public table has RLS enabled');

-- anon holds no privilege on any public table or function.
select pg_temp.expect_value($q$
  select count(*) from information_schema.role_table_grants
  where table_schema = 'public' and grantee in ('anon', 'PUBLIC')
$q$, 0, 'anon has no table privileges');
select pg_temp.expect_value($q$
  select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
$q$, 0, 'anon can execute no public function');

-- Every child -> parent reference is composite (workspace_id, id).
select pg_temp.expect_value($q$
  select count(*) from pg_constraint c
  where c.contype = 'f' and c.connamespace = 'public'::regnamespace
    and c.confrelid in ('public.clients'::regclass, 'public.uploads'::regclass, 'public.analyses'::regclass, 'public.findings'::regclass)
    and array_length(c.conkey, 1) = 1
$q$, 0, 'no single-column references to tenant parents');

-- The uploads bucket is private and limited.
select pg_temp.expect_value($q$
  select count(*) from storage.buckets
  where id = 'uploads' and not public and file_size_limit = 20971520 and allowed_mime_types = array['application/pdf', 'text/plain']
$q$, 1, 'uploads bucket private, 20 MB, PDF/text only');

-- ------------------------------------------------------------ signed out

set local role anon;
select pg_temp.expect_error('select * from public.clients', array['42501'], 'anon reads clients');
select pg_temp.expect_error('select * from public.findings', array['42501'], 'anon reads findings');
select pg_temp.expect_error($s$select public.create_workspace('x')$s$, array['42501'], 'anon creates a workspace');
reset role;

-- ------------------------------------------------------------ as user A

select pg_temp.act_as('aaaaaaaa-0000-4000-8000-000000000001');
set local role authenticated;

-- Reads: nothing of B's is visible.
select pg_temp.expect_value($q$select count(*) from public.workspaces where id = 'bbbbbbbb-0000-4000-8000-0000000000bb'$q$, 0, 'A cannot see workspace B');
select pg_temp.expect_value($q$select count(*) from public.workspace_members where workspace_id = 'bbbbbbbb-0000-4000-8000-0000000000bb'$q$, 0, 'A cannot see B memberships');
select pg_temp.expect_value($q$
  select (select count(*) from public.clients where workspace_id <> 'aaaaaaaa-0000-4000-8000-0000000000aa')
       + (select count(*) from public.uploads where workspace_id <> 'aaaaaaaa-0000-4000-8000-0000000000aa')
       + (select count(*) from public.analyses where workspace_id <> 'aaaaaaaa-0000-4000-8000-0000000000aa')
       + (select count(*) from public.findings where workspace_id <> 'aaaaaaaa-0000-4000-8000-0000000000aa')
       + (select count(*) from public.audit_log where workspace_id <> 'aaaaaaaa-0000-4000-8000-0000000000aa')
$q$, 0, 'A sees no rows from another workspace');
select pg_temp.expect_value($q$select count(*) from storage.objects where bucket_id = 'uploads'$q$, 0, 'A sees no stored files of B');

-- Writes into B's workspace are refused by RLS.
select pg_temp.expect_error($s$insert into public.clients (workspace_id, name) values ('bbbbbbbb-0000-4000-8000-0000000000bb', 'x')$s$, array['42501'], 'A inserts a client into B');
select pg_temp.expect_rows($s$update public.clients set name = 'x' where workspace_id = 'bbbbbbbb-0000-4000-8000-0000000000bb'$s$, 0, 'A updates B clients');
select pg_temp.expect_rows($s$delete from public.findings where workspace_id = 'bbbbbbbb-0000-4000-8000-0000000000bb'$s$, 0, 'A deletes B findings');
select pg_temp.expect_error($s$update public.clients set workspace_id = 'bbbbbbbb-0000-4000-8000-0000000000bb' where id = 'aaaaaaaa-0000-4000-8000-0000000000c1'$s$, array['42501'], 'A moves a client into B');

-- Rows in A's workspace can't reference B's parents (composite foreign keys).
select pg_temp.expect_error($s$insert into public.tickets (workspace_id, client_id, external_id, date, subject) values ('aaaaaaaa-0000-4000-8000-0000000000aa', 'bbbbbbbb-0000-4000-8000-0000000000c1', 'T1', now(), 's')$s$, array['23503'], 'A ticket -> B client');
select pg_temp.expect_error($s$insert into public.contracts (workspace_id, client_id, upload_id, title, text) values ('aaaaaaaa-0000-4000-8000-0000000000aa', 'aaaaaaaa-0000-4000-8000-0000000000c1', 'bbbbbbbb-0000-4000-8000-0000000000f1', 't', 'x')$s$, array['23503'], 'A contract -> B upload');
select pg_temp.expect_error($s$insert into public.findings (workspace_id, analysis_id, client_id, finding_key, category, severity, confidence, title, description, recommended_action) values ('aaaaaaaa-0000-4000-8000-0000000000aa', 'bbbbbbbb-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-0000000000c1', 'k2', 'OTHER', 'LOW', 50, 't', 'd', 'r')$s$, array['23503'], 'A finding -> B analysis');
select pg_temp.expect_error($s$insert into public.actions (workspace_id, finding_id, title) values ('aaaaaaaa-0000-4000-8000-0000000000aa', 'bbbbbbbb-0000-4000-8000-0000000000e1', 't')$s$, array['23503'], 'A action -> B finding');
select pg_temp.expect_error($s$insert into public.reports (workspace_id, analysis_id, title, period_label) values ('aaaaaaaa-0000-4000-8000-0000000000aa', 'bbbbbbbb-0000-4000-8000-0000000000a1', 't', 'p')$s$, array['23503'], 'A report -> B analysis');
select pg_temp.expect_error($s$insert into public.uploads (workspace_id, kind, file_name, storage_path) values ('aaaaaaaa-0000-4000-8000-0000000000aa', 'contract', 'x.pdf', 'bbbbbbbb-0000-4000-8000-0000000000bb/x-b.pdf')$s$, array['23514'], 'A upload row naming a file in B''s folder');

-- RPCs refuse B's ids.
select pg_temp.expect_error($s$select public.delete_upload('bbbbbbbb-0000-4000-8000-0000000000f1')$s$, array['P0002'], 'A delete_upload on B');
select pg_temp.expect_error($s$select public.delete_analysis('bbbbbbbb-0000-4000-8000-0000000000a1')$s$, array['P0002'], 'A delete_analysis on B');
select pg_temp.expect_error($s$select public.clear_workspace_data('bbbbbbbb-0000-4000-8000-0000000000bb')$s$, array['P0002'], 'A clear_workspace_data on B');
select pg_temp.expect_error($s$select public.delete_workspace('bbbbbbbb-0000-4000-8000-0000000000bb')$s$, array['42501'], 'A delete_workspace on B');
select pg_temp.expect_error($s$select public.create_workspace('Second')$s$, array['23505'], 'A creates a second workspace');
select pg_temp.expect_error($s$select public.write_audit('bbbbbbbb-0000-4000-8000-0000000000bb', 'analysis.run', null, null, '{}')$s$, array['42501'], 'A calls the internal audit writer');
select pg_temp.expect_error($s$select * from public.ai_take_quota('aaaaaaaa-0000-4000-8000-0000000000aa', 'aaaaaaaa-0000-4000-8000-000000000001', null, 1000, 1000, 1000)$s$, array['42501'], 'A takes AI quota directly');

-- Storage: no uploads into B's folder or outside a workspace folder.
select pg_temp.expect_error($s$insert into storage.objects (bucket_id, name) values ('uploads', 'bbbbbbbb-0000-4000-8000-0000000000bb/evil.pdf')$s$, array['42501'], 'A uploads into B''s folder');
select pg_temp.expect_error($s$insert into storage.objects (bucket_id, name) values ('uploads', 'aaaaaaaa-0000-4000-8000-0000000000aa/../bbbbbbbb-0000-4000-8000-0000000000bb/evil.pdf')$s$, array['42501', '22P02'], 'A climbs out of its folder');
select pg_temp.expect_rows($s$delete from storage.objects where bucket_id = 'uploads' and name like 'bbbbbbbb%'$s$, 0, 'A deletes B''s stored file');

-- Server-written columns: AI text and metadata come from the ai-review function only.
select pg_temp.expect_error($s$update public.findings set ai_explanation = 'forged' where id = 'aaaaaaaa-0000-4000-8000-0000000000e1'$s$, array['42501'], 'A writes ai_explanation');
select pg_temp.expect_error($s$update public.findings set ai_meta = '{"model":"x"}' where id = 'aaaaaaaa-0000-4000-8000-0000000000e1'$s$, array['42501'], 'A writes ai_meta');
select pg_temp.expect_error($s$insert into public.findings (workspace_id, client_id, finding_key, category, severity, confidence, title, description, recommended_action, ai_explanation) values ('aaaaaaaa-0000-4000-8000-0000000000aa', 'aaaaaaaa-0000-4000-8000-0000000000c1', 'k3', 'OTHER', 'LOW', 50, 't', 'd', 'r', 'forged')$s$, array['42501'], 'A inserts a finding with AI text');
select pg_temp.expect_rows($s$update public.findings set status = 'reviewing' where id = 'aaaaaaaa-0000-4000-8000-0000000000e1'$s$, 1, 'A changes the stage of its own finding');
select pg_temp.expect_value($q$select count(*) from public.findings where id = 'aaaaaaaa-0000-4000-8000-0000000000e1' and ai_explanation is not null$q$, 1, 'a stage change keeps the AI explanation');
select pg_temp.expect_rows($s$update public.findings set evidence = '[{"kind":"x","label":"l","text":"changed"}]' where id = 'aaaaaaaa-0000-4000-8000-0000000000e1'$s$, 1, 'A re-analysis changes the evidence');
select pg_temp.expect_value($q$select count(*) from public.findings where id = 'aaaaaaaa-0000-4000-8000-0000000000e1' and ai_explanation is null and ai_meta is null$q$, 1, 'changed evidence clears the stale AI explanation');

-- Audit log: append-only, own workspace, no server-only events, no forged actor.
select pg_temp.expect_error($s$insert into public.audit_log (workspace_id, actor_id, action) values ('bbbbbbbb-0000-4000-8000-0000000000bb', 'aaaaaaaa-0000-4000-8000-000000000001', 'analysis.run')$s$, array['42501'], 'A writes to B''s audit log');
select pg_temp.expect_error($s$insert into public.audit_log (workspace_id, actor_id, action) values ('aaaaaaaa-0000-4000-8000-0000000000aa', 'aaaaaaaa-0000-4000-8000-000000000001', 'ai.explained')$s$, array['42501'], 'A forges a server-only event');
select pg_temp.expect_rows($s$insert into public.audit_log (workspace_id, actor_id, actor_email, action) values ('aaaaaaaa-0000-4000-8000-0000000000aa', 'aaaaaaaa-0000-4000-8000-000000000001', 'someone-else@example.invalid', 'export.csv')$s$, 1, 'A appends an ordinary event');
select pg_temp.expect_value($q$select count(*) from public.audit_log where workspace_id = 'aaaaaaaa-0000-4000-8000-0000000000aa' and actor_email = 'rls-test-a@example.invalid'$q$, 1, 'actor email comes from the account, not the request');
select pg_temp.expect_error($s$update public.audit_log set action = 'export.pdf'$s$, array['42501'], 'A edits the audit log');
select pg_temp.expect_error($s$delete from public.audit_log$s$, array['42501'], 'A deletes from the audit log');
select pg_temp.expect_error($s$insert into public.ai_usage (workspace_id, user_id) values ('aaaaaaaa-0000-4000-8000-0000000000aa', 'aaaaaaaa-0000-4000-8000-000000000001')$s$, array['42501'], 'A writes AI usage');

reset role;

-- ------------------------------------------------------------ AI quota (as the service role, like the ai-review function)

set local role service_role;
select pg_temp.expect_value($q$select count(*) from public.ai_take_quota('aaaaaaaa-0000-4000-8000-0000000000aa', 'aaaaaaaa-0000-4000-8000-000000000001', null, 2, 10, 10) where usage_id is not null$q$, 1, 'quota: first call allowed');
select pg_temp.expect_value($q$select count(*) from public.ai_take_quota('aaaaaaaa-0000-4000-8000-0000000000aa', 'aaaaaaaa-0000-4000-8000-000000000001', null, 2, 10, 10) where usage_id is not null$q$, 1, 'quota: second call allowed');
select pg_temp.expect_value($q$select count(*) from public.ai_take_quota('aaaaaaaa-0000-4000-8000-0000000000aa', 'aaaaaaaa-0000-4000-8000-000000000001', null, 2, 10, 10) where reason = 'workspace_daily'$q$, 1, 'quota: workspace daily cap reached');
select pg_temp.expect_value($q$select count(*) from public.ai_take_quota('bbbbbbbb-0000-4000-8000-0000000000bb', 'aaaaaaaa-0000-4000-8000-000000000001', null, 100, 100, 100) where reason = 'not_member'$q$, 1, 'quota: refused for a workspace the user is not in');
reset role;

select 'All isolation checks passed' as result;

rollback;
