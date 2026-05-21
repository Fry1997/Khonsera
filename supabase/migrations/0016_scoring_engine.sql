-- ============================================================================
-- 0016: Scoring engine — schema for the chip-face redesign
--
-- Adds the columns the per-leg scoring engine reads (travel profile
-- + trip purpose + per-leg override) so the editor can resolve a
-- recommended mode instead of saying "Khonsera picks the mode".
-- The engine itself is pure (src/lib/scoring); this migration only
-- carries the data it needs.
--
-- Reuses the existing travel_mode_preference enum: 'rail',
-- 'compare', 'mixed' are migrated to 'no_preference'; 'walk', 'taxi',
-- 'no_preference' are added. Old values stay on the enum (Postgres
-- can't drop one cleanly without recreating the type) but become
-- unreachable via the data migration below.
--
-- MCP is offline so this file is queued — apply via the Supabase
-- dashboard SQL runner or `supabase db push`.
-- ============================================================================

-- 1. Extend the travel_mode_preference enum.
alter type travel_mode_preference add value if not exists 'walk';
alter type travel_mode_preference add value if not exists 'taxi';
alter type travel_mode_preference add value if not exists 'no_preference';

-- 2. Migrate existing rows. 'rail'/'compare'/'mixed' become
--    'no_preference'; 'drive' stays.
update travel_profiles
   set preferred_mode = 'no_preference'
 where preferred_mode in ('rail', 'compare', 'mixed');

-- 3. New travel_profiles columns. Defaults match the engine spec.
alter table travel_profiles
  add column if not exists walking_threshold_minutes integer
    not null
    default 15
    check (walking_threshold_minutes between 0 and 60),
  add column if not exists minimum_buffer_minutes integer
    not null
    default 10
    check (minimum_buffer_minutes between 0 and 60),
  add column if not exists max_taxi_fare_pence integer
    not null
    default 1500
    check (max_taxi_fare_pence between 0 and 10000),
  add column if not exists luggage_default text
    not null
    default 'none'
    check (luggage_default in ('none', 'light', 'heavy'));

-- 4. New itineraries columns: trip_purpose + per-trip luggage
--    override. trip_purpose maps to a weights profile in the engine.
alter table itineraries
  add column if not exists trip_purpose text
    not null
    default 'balanced'
    check (trip_purpose in ('maximise_meetings', 'budget_conscious', 'balanced')),
  add column if not exists luggage_for_trip text
    check (luggage_for_trip is null
           or luggage_for_trip in ('none', 'light', 'heavy'));

-- 5. New transitions columns: user_mode_override + override_locked.
--    The override is a strict subset of transition_mode (walk /
--    drive / taxi only — trains and flights are pre-booked legs, not
--    scoreable candidates), enforced by check constraint.
alter table transitions
  add column if not exists user_mode_override transition_mode
    check (user_mode_override is null
           or user_mode_override in ('walk', 'drive', 'taxi')),
  add column if not exists override_locked boolean
    not null
    default false;

create index if not exists transitions_override_idx
  on transitions(user_mode_override)
  where user_mode_override is not null;
