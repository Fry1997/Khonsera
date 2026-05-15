-- Phase A reshape: visit-centric → itinerary-centric.
--
-- Pre-MVP cleanup. Drops the visit-related tables (CASCADE handles their
-- dependent rows) and replaces them with itineraries + stops + transitions.
-- Customers, sites, contacts, locations, calendar connections, audit_events,
-- jobs, workspaces, profiles, memberships — all untouched.
--
-- Run this against the live project in one transaction:
--   begin; \i 0010_reshape_itineraries.sql; commit;
--
-- After applying: regenerate src/lib/types/database.ts.

-- ============================================================================
-- 1. Drop legacy state-machine functions + the guard trigger
-- ============================================================================
drop function if exists public.visit_plan_transition(uuid, visit_status, uuid, jsonb) cascade;
drop function if exists public.saved_trip_transition(uuid, saved_trip_status, uuid, jsonb) cascade;
drop function if exists public.block_direct_status_update() cascade;

-- ============================================================================
-- 2. Drop legacy tables. visit_plans's CASCADE FKs do most of the work; we
--    drop the rest by name to be explicit.
-- ============================================================================
drop table if exists public.notification_rules cascade;
drop table if exists public.trip_progress cascade;
drop table if exists public.visit_checklist_items cascade;
drop table if exists public.mileage_expenses cascade;
drop table if exists public.expense_records cascade;
drop table if exists public.travel_bookings cascade;
drop table if exists public.booking_intents cascade;
drop table if exists public.calendar_event_links cascade;
drop table if exists public.journey_leg_alternatives cascade;
drop table if exists public.journey_legs cascade;
drop table if exists public.travel_options cascade;
drop table if exists public.planning_runs cascade;
drop table if exists public.saved_trips cascade;
drop table if exists public.visit_plans cascade;
drop table if exists public.visit_status_edges cascade;
drop table if exists public.saved_trip_edges cascade;

-- ============================================================================
-- 3. Drop unused enums (kept ones: leg_type, feasibility_status,
--    travel_option_mode, planning_run_status, calendar_provider,
--    calendar_event_type, booking_intent_status, ticket_status,
--    expense_type, reimbursement_status, notification_type,
--    notification_status, travel_mode_preference)
-- ============================================================================
drop type if exists public.visit_status;
drop type if exists public.saved_trip_status;
drop type if exists public.trip_progress_status;

-- ============================================================================
-- 4. New enums for the itinerary model
-- ============================================================================
create type itinerary_status as enum (
  'draft','planning','planned','in_progress','completed','cancelled'
);
create type stop_type as enum (
  'start','end','appointment','accommodation','event','meal',
  'transport_booked','transit_arrival','other'
);
create type transition_mode as enum (
  'walk','drive','taxi','bus','tube','train','flight','mixed'
);

-- ============================================================================
-- 5. itineraries — top-level day/trip container
-- ============================================================================
create table itineraries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  title text,
  date_start date not null,
  date_end date not null,
  status itinerary_status not null default 'draft',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (date_end >= date_start)
);
create index itineraries_workspace_idx on itineraries(workspace_id);
create index itineraries_user_idx on itineraries(user_id);
create index itineraries_date_idx on itineraries(date_start, date_end);
create index itineraries_status_idx on itineraries(status);
create trigger itineraries_updated_at before update on itineraries
  for each row execute function set_updated_at();

-- ============================================================================
-- 6. itinerary_status_edges + state-machine function + guard trigger
-- ============================================================================
create table itinerary_status_edges (
  from_status itinerary_status not null,
  to_status itinerary_status not null,
  primary key (from_status, to_status)
);
insert into itinerary_status_edges (from_status, to_status) values
  ('draft','planning'),       ('draft','cancelled'),
  ('planning','draft'),       ('planning','planned'),  ('planning','cancelled'),
  ('planned','planning'),     ('planned','in_progress'), ('planned','cancelled'),
  ('in_progress','completed'),('in_progress','cancelled'),
  ('cancelled','draft');

alter table itinerary_status_edges enable row level security;
create policy "itinerary_status_edges_read" on itinerary_status_edges
  for select using (true);

create or replace function block_direct_itinerary_status_update() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status is distinct from old.status
     and coalesce(current_setting('app.allow_status_update', true), '') <> 'on' then
    raise exception 'direct status update forbidden; use the transition function'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function itinerary_transition(
  p_itinerary_id uuid,
  p_to_status itinerary_status,
  p_actor_id uuid,
  p_metadata jsonb default null
) returns itineraries
language plpgsql security definer set search_path = public as $$
declare v_before itineraries; v_after itineraries;
begin
  select * into v_before from itineraries where id = p_itinerary_id for update;
  if not found then raise exception 'itinerary not found' using errcode = 'P0002'; end if;

  if not exists (select 1 from memberships m
    where m.workspace_id = v_before.workspace_id and m.user_id = p_actor_id and m.status = 'active')
  then raise exception 'actor not a member of workspace' using errcode = '42501'; end if;

  if v_before.status = p_to_status then return v_before; end if;

  if not exists (select 1 from itinerary_status_edges
    where from_status = v_before.status and to_status = p_to_status)
  then raise exception 'illegal transition % -> %', v_before.status, p_to_status
    using errcode = '22023'; end if;

  perform set_config('app.allow_status_update', 'on', true);
  update itineraries set status = p_to_status where id = p_itinerary_id returning * into v_after;
  perform set_config('app.allow_status_update', '', true);

  insert into audit_events (workspace_id, actor_id, entity_type, entity_id, action, before, after, metadata)
    values (v_after.workspace_id, p_actor_id, 'itinerary', v_after.id,
            'transition:' || p_to_status::text,
            jsonb_build_object('status', v_before.status),
            jsonb_build_object('status', v_after.status),
            p_metadata);
  return v_after;
end;
$$;

create trigger itineraries_block_direct_status
  before update on itineraries
  for each row execute function block_direct_itinerary_status_update();

revoke execute on function itinerary_transition(uuid, itinerary_status, uuid, jsonb) from public, anon;

-- ============================================================================
-- 7. stops — every fixed point in an itinerary
-- ============================================================================
create table stops (
  id uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null references itineraries(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  sequence integer not null,
  type stop_type not null,
  title text,
  start_time timestamptz,
  end_time timestamptz,
  duration_minutes integer,
  is_time_fixed boolean not null default true,
  location_id uuid references locations(id) on delete set null,
  customer_id uuid references customers(id) on delete set null,
  customer_site_id uuid references customer_sites(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  external_reference text,
  external_url text,
  metadata jsonb,
  notes text,
  receipt_file_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index stops_itinerary_idx on stops(itinerary_id, sequence);
create index stops_workspace_idx on stops(workspace_id);
create index stops_customer_idx on stops(customer_id);
create index stops_customer_site_idx on stops(customer_site_id);
create index stops_location_idx on stops(location_id);
create index stops_contact_idx on stops(contact_id);
create trigger stops_updated_at before update on stops
  for each row execute function set_updated_at();

-- ============================================================================
-- 8. transitions — movement between two adjacent stops
-- ============================================================================
create table transitions (
  id uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null references itineraries(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  from_stop_id uuid not null references stops(id) on delete cascade,
  to_stop_id uuid not null references stops(id) on delete cascade,
  mode transition_mode not null,
  start_time timestamptz,
  end_time timestamptz,
  computed_duration_minutes integer,
  distance_miles numeric(8,2),
  overview_polyline text,
  notes text,
  is_locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (from_stop_id, to_stop_id)
);
create index transitions_itinerary_idx on transitions(itinerary_id);
create index transitions_from_idx on transitions(from_stop_id);
create index transitions_to_idx on transitions(to_stop_id);
create trigger transitions_updated_at before update on transitions
  for each row execute function set_updated_at();

-- ============================================================================
-- 9. planning_runs (recreated; per-itinerary or detached for the booker)
-- ============================================================================
create table planning_runs (
  id uuid primary key default gen_random_uuid(),
  itinerary_id uuid references itineraries(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  requested_start_time timestamptz,
  requested_end_time timestamptz,
  generated_at timestamptz not null default now(),
  status planning_run_status not null default 'success',
  summary text,
  idempotency_key uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index planning_runs_itinerary_idx on planning_runs(itinerary_id);
create unique index planning_runs_idempotency
  on planning_runs(workspace_id, idempotency_key)
  where idempotency_key is not null;
create trigger planning_runs_updated_at before update on planning_runs
  for each row execute function set_updated_at();

-- ============================================================================
-- 10. travel_options (kept shape, parent of journey_legs alongside transitions)
-- ============================================================================
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
  currency text not null default 'GBP',
  overview_polyline text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index travel_options_run_idx on travel_options(planning_run_id);
create trigger travel_options_updated_at before update on travel_options
  for each row execute function set_updated_at();

-- ============================================================================
-- 11. journey_legs (now child of EITHER a transition OR a travel_option)
-- ============================================================================
create table journey_legs (
  id uuid primary key default gen_random_uuid(),
  transition_id uuid references transitions(id) on delete cascade,
  travel_option_id uuid references travel_options(id) on delete cascade,
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
  updated_at timestamptz not null default now(),
  check (
    (transition_id is not null and travel_option_id is null) or
    (transition_id is null and travel_option_id is not null)
  )
);
create index journey_legs_transition_idx on journey_legs(transition_id);
create index journey_legs_option_idx on journey_legs(travel_option_id);
create trigger journey_legs_updated_at before update on journey_legs
  for each row execute function set_updated_at();

-- ============================================================================
-- 12. calendar_event_links (per-stop OR per-transition; itinerary always set)
-- ============================================================================
create table calendar_event_links (
  id uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null references itineraries(id) on delete cascade,
  stop_id uuid references stops(id) on delete cascade,
  transition_id uuid references transitions(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  calendar_connection_id uuid references calendar_connections(id) on delete set null,
  provider calendar_provider not null,
  external_event_id text,
  event_type calendar_event_type not null,
  start_time timestamptz,
  end_time timestamptz,
  idempotency_key uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (stop_id is not null and transition_id is null) or
    (stop_id is null and transition_id is not null)
  )
);
create index calendar_event_links_itinerary_idx on calendar_event_links(itinerary_id);
create index calendar_event_links_stop_idx on calendar_event_links(stop_id);
create index calendar_event_links_transition_idx on calendar_event_links(transition_id);
create unique index calendar_event_links_idempotency
  on calendar_event_links(workspace_id, idempotency_key)
  where idempotency_key is not null;
create trigger calendar_event_links_updated_at before update on calendar_event_links
  for each row execute function set_updated_at();

-- ============================================================================
-- 13. booking_intents (per-stop, with optional itinerary back-ref)
-- ============================================================================
create table booking_intents (
  id uuid primary key default gen_random_uuid(),
  stop_id uuid not null references stops(id) on delete cascade,
  itinerary_id uuid references itineraries(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  provider text,
  status booking_intent_status not null default 'not_started',
  outbound_summary text,
  return_summary text,
  estimated_price numeric(10,2),
  currency text not null default 'GBP',
  partner_deep_link text,
  idempotency_key uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index booking_intents_stop_idx on booking_intents(stop_id);
create index booking_intents_itinerary_idx on booking_intents(itinerary_id);
create unique index booking_intents_idempotency
  on booking_intents(workspace_id, idempotency_key)
  where idempotency_key is not null;
create trigger booking_intents_updated_at before update on booking_intents
  for each row execute function set_updated_at();

-- ============================================================================
-- 14. travel_bookings
-- ============================================================================
create table travel_bookings (
  id uuid primary key default gen_random_uuid(),
  booking_intent_id uuid not null references booking_intents(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  provider text,
  booking_reference text,
  ticket_status ticket_status not null default 'unknown',
  actual_price numeric(10,2),
  currency text not null default 'GBP',
  receipt_file_path text,
  booked_at timestamptz,
  idempotency_key uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index travel_bookings_intent_idx on travel_bookings(booking_intent_id);
create unique index travel_bookings_idempotency
  on travel_bookings(workspace_id, idempotency_key)
  where idempotency_key is not null;
create trigger travel_bookings_updated_at before update on travel_bookings
  for each row execute function set_updated_at();

-- ============================================================================
-- 15. expense_records (per-itinerary, optional stop)
-- ============================================================================
create table expense_records (
  id uuid primary key default gen_random_uuid(),
  itinerary_id uuid references itineraries(id) on delete cascade,
  stop_id uuid references stops(id) on delete set null,
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
create index expense_records_itinerary_idx on expense_records(itinerary_id);
create index expense_records_stop_idx on expense_records(stop_id);
create index expense_records_workspace_idx on expense_records(workspace_id);
create index expense_records_user_idx on expense_records(user_id);
create trigger expense_records_updated_at before update on expense_records
  for each row execute function set_updated_at();

-- ============================================================================
-- 16. mileage_expenses (unchanged shape)
-- ============================================================================
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
-- 17. notification_rules (per-itinerary)
-- ============================================================================
create table notification_rules (
  id uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null references itineraries(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  type notification_type not null,
  trigger_time timestamptz not null,
  status notification_status not null default 'pending',
  payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notification_rules_itinerary_idx on notification_rules(itinerary_id);
create index notification_rules_trigger_idx on notification_rules(trigger_time) where status = 'pending';
create trigger notification_rules_updated_at before update on notification_rules
  for each row execute function set_updated_at();

-- ============================================================================
-- 18. RLS on every new + recreated table
-- ============================================================================
alter table itineraries          enable row level security;
alter table stops                enable row level security;
alter table transitions          enable row level security;
alter table planning_runs        enable row level security;
alter table travel_options       enable row level security;
alter table journey_legs         enable row level security;
alter table calendar_event_links enable row level security;
alter table booking_intents      enable row level security;
alter table travel_bookings      enable row level security;
alter table expense_records      enable row level security;
alter table mileage_expenses     enable row level security;
alter table notification_rules   enable row level security;

do $$
declare t text;
  tables text[] := array[
    'itineraries','stops','transitions','planning_runs','travel_options',
    'journey_legs','calendar_event_links','booking_intents','travel_bookings',
    'expense_records','mileage_expenses','notification_rules'
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
