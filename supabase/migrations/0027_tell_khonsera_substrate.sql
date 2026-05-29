-- Tell Khonsera — capture substrate (additive, non-destructive).
-- Adds the place the natural-language capture feature writes drafts (captured_inputs),
-- provenance + lifecycle metadata on facts, and two new context tables
-- (standing_facts, intents). Existing tables, data, read paths, and the structured-form
-- trip creation flow are untouched. Defaults preserve all existing behaviour.

-- ============================================================================
-- Enums
-- ============================================================================
create type captured_input_status as enum (
  'pending_review',   -- parser produced a draft; user hasn't confirmed
  'confirmed',        -- user confirmed; downstream records created
  'corrected',        -- user edited the draft before confirming
  'rejected',         -- user dismissed the draft
  'expired'           -- old pending drafts cleaned up
);

create type fact_confidence as enum ('high', 'medium', 'low');

create type fact_source as enum (
  'manual',           -- user filled a form
  'captured',         -- Tell Khonsera capture
  'parsed_email',     -- Gmail parser extracted from a confirmation
  'calendar',         -- pulled from a calendar connection
  'partner_api',      -- returned by a booking partner
  'inferred',         -- derived from another fact (e.g. return-leg origin)
  'system'            -- system-generated (refresh, default value)
);

create type fact_commitment_state as enum (
  'raw',        -- just captured, not yet sorted
  'sorted',     -- identified what kind of thing it is, not committed
  'planned',    -- committed to happening, not booked
  'booked',     -- booking made, ticket/confirmation in hand
  'live',       -- currently happening
  'done',       -- completed
  'cancelled'   -- explicitly cancelled
);

create type intent_status as enum (
  'open',         -- active, may resurface
  'in_progress',  -- user is acting on it
  'fulfilled',    -- done
  'abandoned',    -- explicitly dropped
  'snoozed'       -- hidden until a later date
);

-- ============================================================================
-- captured_inputs — raw user input + parser draft, before it becomes records
-- ============================================================================
create table captured_inputs (
  id                     uuid primary key default gen_random_uuid(),
  workspace_id           uuid not null references workspaces(id) on delete cascade,
  user_id                uuid not null references profiles(id) on delete cascade,

  -- the raw input
  original_text          text not null,
  input_source           text not null default 'tell_khonsera',

  -- the parser's interpretation
  parser_version         text not null,
  parsed_payload         jsonb not null default '{}'::jsonb,

  -- lifecycle
  status                 captured_input_status not null default 'pending_review',
  reviewed_at            timestamptz,
  expires_at             timestamptz,

  -- pointers to whatever was created on confirmation
  created_itinerary_id   uuid references itineraries(id) on delete set null,
  created_stop_ids       uuid[] not null default array[]::uuid[],
  created_transition_ids uuid[] not null default array[]::uuid[],
  created_booking_ids    uuid[] not null default array[]::uuid[],

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index idx_captured_inputs_workspace_status
  on captured_inputs(workspace_id, status, created_at desc);
create index idx_captured_inputs_user_pending
  on captured_inputs(user_id, status)
  where status = 'pending_review';

create trigger captured_inputs_updated_at before update on captured_inputs
  for each row execute function set_updated_at();

-- ============================================================================
-- Provenance metadata on stops, transitions, travel_bookings
-- Defaults (high/manual) are accurate for every existing hand-entered row,
-- so no backfill is required.
-- ============================================================================
alter table stops
  add column confidence fact_confidence not null default 'high',
  add column source fact_source not null default 'manual',
  add column captured_input_id uuid references captured_inputs(id) on delete set null;

alter table transitions
  add column confidence fact_confidence not null default 'high',
  add column source fact_source not null default 'manual',
  add column captured_input_id uuid references captured_inputs(id) on delete set null;

alter table travel_bookings
  add column confidence fact_confidence not null default 'high',
  add column source fact_source not null default 'manual',
  add column captured_input_id uuid references captured_inputs(id) on delete set null;

create index idx_stops_low_confidence on stops(workspace_id, confidence)
  where confidence <> 'high';
create index idx_transitions_low_confidence on transitions(workspace_id, confidence)
  where confidence <> 'high';

-- ============================================================================
-- commitment_state lifecycle on stops, transitions, travel_bookings
-- Note: stops already has a `commitment` text column (solver hardness:
-- preferred/required). `commitment_state` is the distinct raw->done lifecycle.
-- ============================================================================
alter table stops
  add column commitment_state fact_commitment_state not null default 'planned';
alter table transitions
  add column commitment_state fact_commitment_state not null default 'planned';
alter table travel_bookings
  add column commitment_state fact_commitment_state not null default 'booked';

comment on column stops.commitment_state is
  'Raw->done lifecycle of this fact. Distinct from `commitment` (solver hardness: preferred/required).';
comment on column transitions.commitment_state is
  'Raw->done lifecycle of this transition.';

create index idx_stops_commitment_state on stops(workspace_id, commitment_state);
create index idx_transitions_commitment_state on transitions(workspace_id, commitment_state);

-- Backfill: completed/cancelled itineraries imply done/cancelled facts.
update stops s set commitment_state = 'done'
  from itineraries i where s.itinerary_id = i.id and i.status = 'completed';
update transitions t set commitment_state = 'done'
  from itineraries i where t.itinerary_id = i.id and i.status = 'completed';
update stops s set commitment_state = 'cancelled'
  from itineraries i where s.itinerary_id = i.id and i.status = 'cancelled';
update transitions t set commitment_state = 'cancelled'
  from itineraries i where t.itinerary_id = i.id and i.status = 'cancelled';

-- ============================================================================
-- standing_facts — persistent personal context (not a place/contact/trip)
-- ============================================================================
create table standing_facts (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id      uuid not null references profiles(id) on delete cascade,

  label        text not null,        -- human-readable summary
  fact_kind    text not null,        -- open vocab: recurring_availability, shared_resource, ...
  details      jsonb not null default '{}'::jsonb,

  active       boolean not null default true,
  valid_from   date,
  valid_to     date,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_standing_facts_workspace_active
  on standing_facts(workspace_id, active)
  where active = true;

create trigger standing_facts_updated_at before update on standing_facts
  for each row execute function set_updated_at();

-- ============================================================================
-- intents — held wishes without a date anchor (resurfaced periodically)
-- ============================================================================
create table intents (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references workspaces(id) on delete cascade,
  user_id           uuid not null references profiles(id) on delete cascade,
  captured_input_id uuid references captured_inputs(id) on delete set null,

  label             text not null,   -- the user's exact words (verbatim hold)
  details           jsonb not null default '{}'::jsonb,

  status            intent_status not null default 'open',
  surface_after     date,
  last_surfaced_at  timestamptz,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_intents_workspace_open
  on intents(workspace_id, status, surface_after)
  where status in ('open', 'snoozed');

create trigger intents_updated_at before update on intents
  for each row execute function set_updated_at();

-- ============================================================================
-- RLS — workspace-membership scoping, matching the existing is_workspace_member pattern
-- ============================================================================
alter table captured_inputs enable row level security;
alter table standing_facts  enable row level security;
alter table intents         enable row level security;

do $$
declare t text;
  tables text[] := array['captured_inputs', 'standing_facts', 'intents'];
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
-- Rollback (reference only — repo migrations are forward-only):
--   drop table if exists intents;
--   drop table if exists standing_facts;
--   alter table stops drop column if exists commitment_state, drop column if exists confidence,
--     drop column if exists source, drop column if exists captured_input_id;
--   alter table transitions drop column if exists commitment_state, drop column if exists confidence,
--     drop column if exists source, drop column if exists captured_input_id;
--   alter table travel_bookings drop column if exists commitment_state, drop column if exists confidence,
--     drop column if exists source, drop column if exists captured_input_id;
--   drop table if exists captured_inputs;
--   drop type if exists intent_status; drop type if exists fact_commitment_state;
--   drop type if exists fact_source; drop type if exists fact_confidence;
--   drop type if exists captured_input_status;
-- ============================================================================
