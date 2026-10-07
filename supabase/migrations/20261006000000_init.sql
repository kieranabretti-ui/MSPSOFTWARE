-- Headroom: initial schema.
-- Every business table carries workspace_id; Row Level Security restricts
-- all access to members of that workspace.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- helpers

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------- users & workspaces

-- Application profile for each Supabase auth user.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  settings jsonb not null default '{}'::jsonb,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_idx on public.workspace_members (user_id);

-- Security definer so policies can call it without recursing through RLS.
create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid()
  )
$$;

-- Creates a workspace and makes the caller its owner in one step.
create or replace function public.create_workspace(ws_name text, ws_settings jsonb default '{}'::jsonb, ws_is_demo boolean default false)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  insert into public.workspaces (name, settings, is_demo) values (ws_name, coalesce(ws_settings, '{}'::jsonb), ws_is_demo)
  returning id into new_id;
  insert into public.workspace_members (workspace_id, user_id, role) values (new_id, auth.uid(), 'owner');
  return new_id;
end $$;

-- Profile row for every new auth user.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- data tables

create table public.uploads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind text not null check (kind in ('clients', 'tickets', 'time_entries', 'assets', 'billing', 'contract')),
  file_name text not null,
  row_count integer not null default 0,
  status text not null default 'imported' check (status in ('imported', 'failed')),
  storage_path text,
  mapping jsonb,
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  monthly_recurring_revenue numeric(12, 2) not null default 0,
  contracted_users integer,
  contracted_devices integer,
  package text,
  contract_start date,
  contract_end date,
  included_hours numeric(8, 2),
  monthly_software_cost numeric(12, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  upload_id uuid references public.uploads (id) on delete set null,
  title text not null,
  text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  external_id text not null,
  date timestamp not null, -- local time as exported from the PSA
  technician text,
  subject text not null,
  description text,
  status text,
  time_spent_minutes numeric(10, 2) not null default 0,
  billable boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tickets_ws_client_idx on public.tickets (workspace_id, client_id);

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  ticket_external_id text,
  date timestamp not null,
  technician text,
  minutes numeric(10, 2) not null,
  billable boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index time_entries_ws_client_idx on public.time_entries (workspace_id, client_id);

create table public.billing_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  service text not null,
  quantity numeric(12, 2) not null default 0,
  unit_price numeric(12, 2) not null default 0,
  monthly_value numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Users and devices actually supported (from RMM / Microsoft 365 exports).
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  asset_type text not null check (asset_type in ('user', 'device')),
  name text not null,
  ownership text check (ownership in ('company', 'personal')),
  license text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  first_seen date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index assets_ws_client_idx on public.assets (workspace_id, client_id);

create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  summary jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index analyses_ws_created_idx on public.analyses (workspace_id, created_at desc);

create table public.findings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  analysis_id uuid references public.analyses (id) on delete set null,
  client_id uuid not null references public.clients (id) on delete cascade,
  finding_key text not null,
  category text not null check (category in ('OUT_OF_SCOPE', 'UNBILLED_TIME', 'AGREEMENT_DRIFT', 'MISSING_LICENSE', 'UNDERPRICED_CLIENT', 'EXCESSIVE_USAGE', 'RECURRING_CHARGE_MISMATCH', 'OTHER')),
  severity text not null check (severity in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  confidence integer not null check (confidence between 0 and 100),
  title text not null,
  description text not null,
  evidence jsonb not null default '[]'::jsonb,
  estimated_value numeric(12, 2) not null default 0,
  monthly_value numeric(12, 2) not null default 0,
  annual_value numeric(12, 2) not null default 0,
  recommended_action text not null,
  source_data jsonb not null default '[]'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'valid', 'dismissed', 'resolved')),
  ai_explanation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, finding_key)
);

create table public.actions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  finding_id uuid references public.findings (id) on delete set null,
  client_id uuid references public.clients (id) on delete set null,
  title text not null,
  notes text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'dismissed')),
  value numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  analysis_id uuid references public.analyses (id) on delete set null,
  title text not null,
  period_label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- triggers & RLS

do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'workspaces', 'uploads', 'clients', 'contracts', 'tickets', 'time_entries', 'billing_items', 'assets', 'analyses', 'findings', 'actions', 'reports'] loop
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
  foreach t in array array['uploads', 'clients', 'contracts', 'tickets', 'time_entries', 'billing_items', 'assets', 'analyses', 'findings', 'actions', 'reports'] loop
    execute format(
      'create policy "workspace members" on public.%I for all to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id))',
      t
    );
  end loop;
end $$;

alter table public.workspace_members enable row level security;

create policy "own profile" on public.profiles for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "members read workspace" on public.workspaces for select to authenticated using (public.is_workspace_member(id));
create policy "members update workspace" on public.workspaces for update to authenticated using (public.is_workspace_member(id)) with check (public.is_workspace_member(id));
-- Workspaces are created through create_workspace(), never inserted directly.

create policy "see own memberships" on public.workspace_members for select to authenticated using (user_id = auth.uid());

-- Explicit Data API grants (RLS above still decides which rows are visible).
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke insert, delete on public.workspaces from authenticated;
revoke insert, update, delete on public.workspace_members from authenticated;
grant execute on function public.create_workspace(text, jsonb, boolean) to authenticated;

-- ---------------------------------------------------------------- private file storage

insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', false)
on conflict (id) do nothing;

-- Files live under "<workspace_id>/<file>"; only members of that workspace can touch them.
create policy "workspace files read" on storage.objects for select to authenticated
  using (bucket_id = 'uploads' and public.is_workspace_member(((storage.foldername(name))[1])::uuid));
create policy "workspace files write" on storage.objects for insert to authenticated
  with check (bucket_id = 'uploads' and public.is_workspace_member(((storage.foldername(name))[1])::uuid));
create policy "workspace files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'uploads' and public.is_workspace_member(((storage.foldername(name))[1])::uuid));
