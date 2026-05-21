-- ============================================================================
-- 0015: Default flight-origin transport hub on the travel profile
--
-- travel_profiles already carries a default_rail_origin_transport_hub_id
-- so the brief / editor can auto-stamp a transit_departure stop when
-- the user picks a train mode. Mirror that for flights: a separate
-- default lets a user have "Wellingborough" as their rail station
-- and "Heathrow" as their airport without one overwriting the
-- other.
--
-- Nothing on the data path uses this column yet — the brief writer's
-- auto-insertion logic that consumes it ships in the same code
-- commit as this migration.
-- ============================================================================

alter table travel_profiles
  add column if not exists default_flight_origin_transport_hub_id uuid
    references transport_hubs(id) on delete set null;

create index if not exists travel_profiles_default_flight_hub_idx
  on travel_profiles(default_flight_origin_transport_hub_id);
