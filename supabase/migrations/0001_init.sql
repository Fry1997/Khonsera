-- Journies: initial schema
-- All entities for the architecture spine. Designed for multi-user/multi-workspace
-- (orgs) from day one. Every workspace-scoped table is guarded by RLS via
-- is_workspace_member().

-- ============================================================================
-- Extensions
-- ============================================================================
create extension if not exists "pgcrypto";

-- ============================================================================
-- Enums
-- ============================================================================
create type workspace_type as enum ('personal', 'organisation');
create type membership_role as enum ('owner', 'admin', 'member', 'viewer');
create type membership_status as enum ('active', 'invited', 'suspended');
create type location_type as enum ('home', 'office', 'station', 'hotel', 'customer_site', 'parking', 'other');
create type travel_mode_preference as enum ('rail', 'drive', 'compare', 'mixed');
create type visit_status as enum ('draft', 'checking', 'proposed', 'confirmed', 'booked', 'in_progress', 'completed', 'cancelled');
create type planning_run_status as enum ('success', 'partial', 'failed');
create type travel_option_mode as enum ('rail', 'drive', 'mixed');
create type feasibility_status as enum ('recommended', 'tight', 'not_recommended', 'not_possible');
create type leg_type as enum ('walk', 'drive', 'train', 'bus', 'taxi', 'wait', 'meeting', 'buffer');
create type calendar_provider as enum ('google', 'microsoft');
create type calendar_event_type as enum ('appointment', 'outbound_travel', 'return_travel', 'prep', 'buffer');
create type booking_intent_status as enum ('not_started', 'opened_partner', 'booked', 'failed', 'abandoned');
create type ticket_status as enum ('booked', 'changed', 'cancelled', 'refunded', 'unknown');
create type expense_type as enum ('rail_ticket', 'mileage', 'parking', 'taxi', 'hotel', 'food', 'other');
create type reimbursement_status as enum ('draft', 'submitted', 'approved', 'rejected', 'reimbursed');
create type saved_trip_status as enum ('upcoming', 'ready', 'in_progress', 'completed', 'cancelled');
create type checklist_status as enum ('incomplete', 'complete');
create type notification_type as enum ('leave_soon', 'leave_now', 'train_delay', 'platform_update', 'return_reminder', 'receipt_missing', 'booking_not_done');
create type notification_status as enum ('pending', 'sent', 'cancelled', 'failed');
create type trip_progress_status as enum ('not_started', 'on_track', 'tight', 'delayed', 'missed_connection', 'completed');

-- ============================================================================
-- updated_at trigger
-- ============================================================================
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================================
-- Profiles (mirror auth.users) + staff flag for demo mode
-- ============================================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  is_staff boolean not null default false,
  default_workspace_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

-- ============================================================================
-- Workspaces + memberships
-- ============================================================================
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type workspace_type not null default 'personal',
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger workspaces_updated_at before update on workspaces
  for each row execute function set_updated_at();

create table memberships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role membership_role not null default 'member',
  status membership_status not null default 'active',
  invited_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);
create index memberships_user_idx on memberships(user_id);
create index memberships_workspace_idx on memberships(workspace_id);
create trigger memberships_updated_at before update on memberships
  for each row execute function set_updated_at();

-- FK from profiles.default_workspace_id (added after workspaces exists)
alter table profiles
  add constraint profiles_default_workspace_fk
  foreign key (default_workspace_id) references workspaces(id) on delete set null;

-- ============================================================================
-- Helper: is_workspace_member (used everywhere in RLS)
-- ============================================================================
create or replace function is_workspace_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships
    where workspace_id = ws
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

-- ============================================================================
-- Locations + travel profiles
-- ============================================================================
create table locations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  name text not null,
  type location_type not null default 'other',
  address text,
  postcode text,
  latitude double precision,
  longitude double precision,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index locations_workspace_idx on locations(workspace_id);
create trigger locations_updated_at before update on locations
  for each row execute function set_updated_at();

create table travel_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  default_drive_origin_location_id uuid references locations(id) on delete set null,
  default_rail_origin_location_id uuid references locations(id) on delete set null,
  default_return_location_id uuid references locations(id) on delete set null,
  preferred_mode travel_mode_preference not null default 'compare',
  default_arrival_buffer_minutes integer not null default 15,
  default_return_buffer_minutes integer not null default 15,
  mileage_rate numeric(8,4) not null default 0.45,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, workspace_id)
);
create trigger travel_profiles_updated_at before update on travel_profiles
  for each row execute function set_updated_at();

-- ============================================================================
-- Customers, sites, contacts
-- ============================================================================
create table customers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customers_workspace_idx on customers(workspace_id);
create trigger customers_updated_at before update on customers
  for each row execute function set_updated_at();

create table customer_sites (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text,
  address text,
  postcode text,
  latitude double precision,
  longitude double precision,
  parking_notes text,
  nearest_station_notes text,
  access_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customer_sites_customer_idx on customer_sites(customer_id);
create index customer_sites_workspace_idx on customer_sites(workspace_id);
create trigger customer_sites_updated_at before update on customer_sites
  for each row execute function set_updated_at();

create table contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  role text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index contacts_customer_idx on contacts(customer_id);
create index contacts_workspace_idx on contacts(workspace_id);
create trigger contacts_updated_at before update on contacts
  for each row execute function set_updated_at();

-- ============================================================================
-- Calendar
-- ============================================================================
create table calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  provider calendar_provider not null,
  provider_account_email text,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index calendar_connections_user_idx on calendar_connections(user_id);
create trigger calendar_connections_updated_at before update on calendar_connections
  for each row execute function set_updated_at();

-- ============================================================================
-- Visit plans (the spine)
-- ============================================================================
create table visit_plans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  customer_site_id uuid references customer_sites(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  title text,
  status visit_status not null default 'draft',
  proposed_start_time timestamptz,
  proposed_end_time timestamptz,
  meeting_duration_minutes integer,
  desired_arrival_time timestamptz,
  latest_departure_from_site_time timestamptz,
  latest_return_time timestamptz,
  start_location_id uuid references locations(id) on delete set null,
  return_location_id uuid references locations(id) on delete set null,
  travel_mode_preference travel_mode_preference not null default 'compare',
  arrival_buffer_minutes integer not null default 15,
  return_buffer_minutes integer not null default 15,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index visit_plans_workspace_idx on visit_plans(workspace_id);
create index visit_plans_user_idx on visit_plans(user_id);
create index visit_plans_status_idx on visit_plans(status);
create trigger visit_plans_updated_at before update on visit_plans
  for each row execute function set_updated_at();

-- ============================================================================
-- Planning runs and travel options
-- ============================================================================
create table planning_runs (
  id uuid primary key default gen_random_uuid(),
  visit_plan_id uuid not null references visit_plans(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  requested_start_time timestamptz,
  requested_end_time timestamptz,
  requested_latest_return_time timestamptz,
  generated_at timestamptz not null default now(),
  status planning_run_status not null default 'success',
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index planning_runs_visit_idx on planning_runs(visit_plan_id);
create trigger planning_runs_updated_at before update on planning_runs
  for each row execute function set_updated_at();

create table travel_options (
  id uuid primary key default gen_random_uuid(),
  planning_run_id uuid not null references planning_runs(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  mode travel_option_mode not null,
  feasibility_status feasibility_status not null,
  confidence_score numeric(5,2),
  leave_origin_at timestamptz,
  arrive_site_at timestamptz,
  meeting_start_at timestamptz,
  meeting_end_at timestamptz,
  leave_site_at timestamptz,
  arrive_return_location_at timestamptz,
  total_duration_minutes integer,
  total_cost_estimate numeric(10,2),
  travel_time_minutes integer,
  buffer_minutes integer,
  risk_summary text,
  recommendation_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index travel_options_run_idx on travel_options(planning_run_id);
create trigger travel_options_updated_at before update on travel_options
  for each row execute function set_updated_at();

create table journey_legs (
  id uuid primary key default gen_random_uuid(),
  travel_option_id uuid not null references travel_options(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  sequence integer not null,
  leg_type leg_type not null,
  start_location_name text,
  end_location_name text,
  start_time timestamptz,
  end_time timestamptz,
  duration_minutes integer,
  distance_miles numeric(8,2),
  provider text,
  service_number text,
  platform text,
  booking_required boolean not null default false,
  instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index journey_legs_option_idx on journey_legs(travel_option_id);
create trigger journey_legs_updated_at before update on journey_legs
  for each row execute function set_updated_at();

create table journey_leg_alternatives (
  id uuid primary key default gen_random_uuid(),
  journey_leg_id uuid not null references journey_legs(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  leg_type leg_type not null,
  duration_minutes integer,
  cost_estimate numeric(10,2),
  instructions text,
  selected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index journey_leg_alts_leg_idx on journey_leg_alternatives(journey_leg_id);
create trigger journey_leg_alts_updated_at before update on journey_leg_alternatives
  for each row execute function set_updated_at();

-- ============================================================================
-- Calendar event links (back-reference visit_plans -> calendar)
-- ============================================================================
create table calendar_event_links (
  id uuid primary key default gen_random_uuid(),
  visit_plan_id uuid not null references visit_plans(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  calendar_connection_id uuid references calendar_connections(id) on delete set null,
  provider calendar_provider not null,
  external_event_id text,
  event_type calendar_event_type not null,
  start_time timestamptz,
  end_time timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index calendar_event_links_visit_idx on calendar_event_links(visit_plan_id);
create trigger calendar_event_links_updated_at before update on calendar_event_links
  for each row execute function set_updated_at();

-- ============================================================================
-- Booking
-- ============================================================================
create table booking_intents (
  id uuid primary key default gen_random_uuid(),
  visit_plan_id uuid not null references visit_plans(id) on delete cascade,
  travel_option_id uuid references travel_options(id) on delete set null,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  provider text,
  status booking_intent_status not null default 'not_started',
  outbound_summary text,
  return_summary text,
  estimated_price numeric(10,2),
  partner_deep_link text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index booking_intents_visit_idx on booking_intents(visit_plan_id);
create trigger booking_intents_updated_at before update on booking_intents
  for each row execute function set_updated_at();

create table travel_bookings (
  id uuid primary key default gen_random_uuid(),
  booking_intent_id uuid not null references booking_intents(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  provider text,
  booking_reference text,
  ticket_status ticket_status not null default 'unknown',
  actual_price numeric(10,2),
  receipt_file_path text,
  booked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index travel_bookings_intent_idx on travel_bookings(booking_intent_id);
create trigger travel_bookings_updated_at before update on travel_bookings
  for each row execute function set_updated_at();

-- ============================================================================
-- Saved trip (post-confirmation projection)
-- ============================================================================
create table saved_trips (
  id uuid primary key default gen_random_uuid(),
  visit_plan_id uuid not null unique references visit_plans(id) on delete cascade,
  selected_travel_option_id uuid references travel_options(id) on delete set null,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  status saved_trip_status not null default 'upcoming',
  travel_day_started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index saved_trips_workspace_idx on saved_trips(workspace_id);
create trigger saved_trips_updated_at before update on saved_trips
  for each row execute function set_updated_at();

-- ============================================================================
-- Expenses
-- ============================================================================
create table expense_records (
  id uuid primary key default gen_random_uuid(),
  visit_plan_id uuid references visit_plans(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  type expense_type not null,
  amount numeric(10,2),
  currency text not null default 'GBP',
  receipt_file_path text,
  reimbursement_status reimbursement_status not null default 'draft',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index expense_records_visit_idx on expense_records(visit_plan_id);
create index expense_records_workspace_idx on expense_records(workspace_id);
create trigger expense_records_updated_at before update on expense_records
  for each row execute function set_updated_at();

create table mileage_expenses (
  id uuid primary key default gen_random_uuid(),
  expense_record_id uuid not null unique references expense_records(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  distance_miles numeric(8,2) not null,
  mileage_rate numeric(8,4) not null,
  calculated_amount numeric(10,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger mileage_expenses_updated_at before update on mileage_expenses
  for each row execute function set_updated_at();

-- ============================================================================
-- Checklist + notifications + trip progress
-- ============================================================================
create table visit_checklist_items (
  id uuid primary key default gen_random_uuid(),
  visit_plan_id uuid not null references visit_plans(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  label text not null,
  status checklist_status not null default 'incomplete',
  due_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index visit_checklist_visit_idx on visit_checklist_items(visit_plan_id);
create trigger visit_checklist_updated_at before update on visit_checklist_items
  for each row execute function set_updated_at();

create table notification_rules (
  id uuid primary key default gen_random_uuid(),
  visit_plan_id uuid not null references visit_plans(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  type notification_type not null,
  trigger_time timestamptz not null,
  status notification_status not null default 'pending',
  payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notification_rules_visit_idx on notification_rules(visit_plan_id);
create index notification_rules_trigger_idx on notification_rules(trigger_time) where status = 'pending';
create trigger notification_rules_updated_at before update on notification_rules
  for each row execute function set_updated_at();

create table trip_progress (
  id uuid primary key default gen_random_uuid(),
  saved_trip_id uuid not null unique references saved_trips(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  current_leg_id uuid references journey_legs(id) on delete set null,
  status trip_progress_status not null default 'not_started',
  last_known_latitude double precision,
  last_known_longitude double precision,
  last_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trip_progress_updated_at before update on trip_progress
  for each row execute function set_updated_at();

-- ============================================================================
-- RLS — enable everywhere
-- ============================================================================
alter table profiles                  enable row level security;
alter table workspaces                enable row level security;
alter table memberships               enable row level security;
alter table locations                 enable row level security;
alter table travel_profiles           enable row level security;
alter table customers                 enable row level security;
alter table customer_sites            enable row level security;
alter table contacts                  enable row level security;
alter table calendar_connections      enable row level security;
alter table visit_plans               enable row level security;
alter table planning_runs             enable row level security;
alter table travel_options            enable row level security;
alter table journey_legs              enable row level security;
alter table journey_leg_alternatives  enable row level security;
alter table calendar_event_links      enable row level security;
alter table booking_intents           enable row level security;
alter table travel_bookings           enable row level security;
alter table saved_trips               enable row level security;
alter table expense_records           enable row level security;
alter table mileage_expenses          enable row level security;
alter table visit_checklist_items     enable row level security;
alter table notification_rules        enable row level security;
alter table trip_progress             enable row level security;

-- ============================================================================
-- RLS policies
-- Profile: a user can see/update their own row.
-- Workspaces: members can see. Owner can update.
-- Memberships: members can see memberships of their workspaces. Owners/admins manage.
-- Everything else: gated by is_workspace_member(workspace_id).
-- ============================================================================

-- Profiles
create policy "profiles_self_select" on profiles for select using (id = auth.uid());
create policy "profiles_self_update" on profiles for update using (id = auth.uid());

-- Workspaces
create policy "workspaces_member_select" on workspaces
  for select using (is_workspace_member(id));
create policy "workspaces_insert_own" on workspaces
  for insert with check (created_by = auth.uid());
create policy "workspaces_owner_update" on workspaces
  for update using (
    exists (
      select 1 from memberships m
      where m.workspace_id = workspaces.id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
        and m.status = 'active'
    )
  );

-- Memberships
create policy "memberships_member_select" on memberships
  for select using (is_workspace_member(workspace_id) or user_id = auth.uid());
create policy "memberships_owner_write" on memberships
  for all using (
    exists (
      select 1 from memberships m
      where m.workspace_id = memberships.workspace_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
        and m.status = 'active'
    )
  ) with check (
    exists (
      select 1 from memberships m
      where m.workspace_id = memberships.workspace_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
        and m.status = 'active'
    )
  );

-- Generic workspace-scoped policies: SELECT/INSERT/UPDATE/DELETE for members.
-- For simplicity, "active member" can read+write workspace data. Tighten later
-- with role-based granularity (viewer = read-only) if/when needed.
do $$
declare
  t text;
  tables text[] := array[
    'locations','travel_profiles','customers','customer_sites','contacts',
    'calendar_connections','visit_plans','planning_runs','travel_options',
    'journey_legs','journey_leg_alternatives','calendar_event_links',
    'booking_intents','travel_bookings','saved_trips','expense_records',
    'mileage_expenses','visit_checklist_items','notification_rules','trip_progress'
  ];
begin
  foreach t in array tables loop
    execute format($f$
      create policy "%1$s_member_select" on %1$s
        for select using (is_workspace_member(workspace_id));
      create policy "%1$s_member_insert" on %1$s
        for insert with check (is_workspace_member(workspace_id));
      create policy "%1$s_member_update" on %1$s
        for update using (is_workspace_member(workspace_id))
        with check (is_workspace_member(workspace_id));
      create policy "%1$s_member_delete" on %1$s
        for delete using (is_workspace_member(workspace_id));
    $f$, t);
  end loop;
end$$;

-- ============================================================================
-- Auto-provision: on new auth.users row, create profile + personal workspace
-- ============================================================================
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ws_id uuid;
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email));

  insert into workspaces (name, type, created_by)
  values (coalesce(new.raw_user_meta_data->>'full_name', 'Personal'), 'personal', new.id)
  returning id into ws_id;

  insert into memberships (workspace_id, user_id, role, status)
  values (ws_id, new.id, 'owner', 'active');

  update profiles set default_workspace_id = ws_id where id = new.id;

  insert into travel_profiles (user_id, workspace_id)
  values (new.id, ws_id);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
