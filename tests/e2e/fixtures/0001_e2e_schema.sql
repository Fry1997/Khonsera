-- Minimal, intentionally isolated database contract for authenticated browser E2E.
--
-- This is NOT a replacement for Khonsera's production migration history. The
-- production Supabase project predates a fully reproducible migration directory
-- and currently contains schema changes missing from git. CI uses this fixture so
-- browser authentication/authorisation tests remain deterministic while that
-- migration drift is repaired separately.
--
-- Scope: real Supabase Auth + provisioning trigger + RLS + the read surfaces used
-- by /today (staff demo mode) and an empty /plan page. No production data is used.

create extension if not exists "pgcrypto";

create type workspace_type as enum ('personal', 'organisation');
create type membership_role as enum (
  'owner', 'admin', 'member', 'viewer', 'company_admin', 'team_manager', 'traveller'
);
create type membership_status as enum ('active', 'invited', 'suspended');
create type app_mode as enum ('work', 'personal');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  is_staff boolean not null default false,
  is_admin boolean not null default false,
  default_workspace_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type workspace_type not null default 'personal',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add constraint profiles_default_workspace_fk
  foreign key (default_workspace_id) references public.workspaces(id) on delete set null;

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role membership_role not null default 'member',
  status membership_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.memberships
    where workspace_id = ws
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  type text not null default 'other',
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.travel_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  default_drive_origin_location_id uuid references public.locations(id) on delete set null,
  default_rail_origin_location_id uuid references public.locations(id) on delete set null,
  default_return_location_id uuid references public.locations(id) on delete set null,
  default_rail_origin_transport_hub_id uuid,
  default_flight_origin_transport_hub_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, workspace_id)
);

create table public.itineraries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  mode app_mode not null default 'personal',
  date_start date not null default current_date,
  date_end date not null default current_date,
  status text not null default 'planning',
  recurring_event_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stops (
  id uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null references public.itineraries(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.transitions (
  id uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null references public.itineraries(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  from_stop_id uuid references public.stops(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.recurring_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  location_id uuid references public.locations(id) on delete set null,
  weekday smallint not null check (weekday between 0 and 6),
  start_time text not null default '09:00',
  duration_minutes integer not null default 60,
  mode app_mode not null default 'work',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recurring_occurrence_overrides (
  id uuid primary key default gen_random_uuid(),
  recurring_event_id uuid not null references public.recurring_events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  occurrence_date date not null,
  action text not null check (action in ('skip', 'merged')),
  itinerary_id uuid references public.itineraries(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (recurring_event_id, occurrence_date)
);

create table public.intents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null,
  status text not null default 'open',
  surface_after date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table public.gmail_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.customer_sites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  name text,
  address text,
  created_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger workspaces_updated_at before update on public.workspaces
  for each row execute function public.set_updated_at();
create trigger memberships_updated_at before update on public.memberships
  for each row execute function public.set_updated_at();
create trigger travel_profiles_updated_at before update on public.travel_profiles
  for each row execute function public.set_updated_at();
create trigger itineraries_updated_at before update on public.itineraries
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ws_id uuid;
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  );

  insert into public.workspaces (name, type, created_by)
  values (coalesce(new.raw_user_meta_data->>'full_name', 'Personal'), 'personal', new.id)
  returning id into ws_id;

  insert into public.memberships (workspace_id, user_id, role, status)
  values (ws_id, new.id, 'owner', 'active');

  update public.profiles set default_workspace_id = ws_id where id = new.id;

  insert into public.travel_profiles (user_id, workspace_id)
  values (new.id, ws_id);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS mirrors the important production boundaries for the surfaces under test.
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.memberships enable row level security;
alter table public.locations enable row level security;
alter table public.travel_profiles enable row level security;
alter table public.itineraries enable row level security;
alter table public.stops enable row level security;
alter table public.transitions enable row level security;
alter table public.recurring_events enable row level security;
alter table public.recurring_occurrence_overrides enable row level security;
alter table public.intents enable row level security;
alter table public.calendar_connections enable row level security;
alter table public.gmail_connections enable row level security;
alter table public.customers enable row level security;
alter table public.customer_sites enable row level security;

create policy profiles_self_select on public.profiles for select using (id = auth.uid());
create policy profiles_self_update on public.profiles for update using (id = auth.uid());
create policy workspaces_member_select on public.workspaces for select using (public.is_workspace_member(id));
create policy memberships_self_select on public.memberships for select using (user_id = auth.uid());
create policy locations_member_select on public.locations for select using (public.is_workspace_member(workspace_id));
create policy travel_profiles_owner_select on public.travel_profiles for select using (user_id = auth.uid());
create policy itineraries_owner_select on public.itineraries for select using (user_id = auth.uid());
create policy stops_owner_select on public.stops for select using (
  exists (select 1 from public.itineraries i where i.id = itinerary_id and i.user_id = auth.uid())
);
create policy transitions_owner_select on public.transitions for select using (
  exists (select 1 from public.itineraries i where i.id = itinerary_id and i.user_id = auth.uid())
);
create policy recurring_events_owner_select on public.recurring_events for select using (user_id = auth.uid());
create policy recurring_occurrence_overrides_owner_select on public.recurring_occurrence_overrides for select using (user_id = auth.uid());
create policy intents_owner_select on public.intents for select using (user_id = auth.uid());
create policy calendar_connections_owner_select on public.calendar_connections for select using (user_id = auth.uid());
create policy gmail_connections_owner_select on public.gmail_connections for select using (user_id = auth.uid());
create policy customers_member_select on public.customers for select using (public.is_workspace_member(workspace_id));
create policy customer_sites_member_select on public.customer_sites for select using (public.is_workspace_member(workspace_id));

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant select on all tables in schema public to anon;
grant execute on function public.is_workspace_member(uuid) to authenticated, service_role;
