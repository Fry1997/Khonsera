-- ============================================================================
-- 0011: Train bookings
--
-- Extends travel_bookings with booked-train-specific fields (departure /
-- arrival station + clock time, seat reservation) and adds a
-- travel_booking_segments table for changeovers / platforms.
--
-- A booked train is modelled as:
--   * a `transit_arrival` stop at the arrival station
--   * a single `transitions` row between the booking's origin stop and the
--     new arrival stop, with mode='train' and is_locked=true
--   * a booking_intent (status='booked') + travel_booking record carrying the
--     ticket data, with one row per segment in travel_booking_segments
-- ============================================================================

alter table travel_bookings
  add column if not exists departure_location_id uuid
    references locations(id) on delete set null,
  add column if not exists arrival_location_id uuid
    references locations(id) on delete set null,
  add column if not exists departure_at timestamptz,
  add column if not exists arrival_at timestamptz,
  add column if not exists seat_reservation text;

create index if not exists travel_bookings_departure_loc_idx
  on travel_bookings(departure_location_id);
create index if not exists travel_bookings_arrival_loc_idx
  on travel_bookings(arrival_location_id);

create table if not exists travel_booking_segments (
  id uuid primary key default gen_random_uuid(),
  travel_booking_id uuid not null references travel_bookings(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  sequence integer not null,
  from_location_name text not null,
  to_location_name text not null,
  departure_at timestamptz not null,
  arrival_at timestamptz not null,
  train_number text,
  platform_dep text,
  platform_arr text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (travel_booking_id, sequence)
);
create index if not exists travel_booking_segments_booking_idx
  on travel_booking_segments(travel_booking_id);
create index if not exists travel_booking_segments_workspace_idx
  on travel_booking_segments(workspace_id);

create trigger travel_booking_segments_updated_at
  before update on travel_booking_segments
  for each row execute function set_updated_at();

alter table travel_booking_segments enable row level security;

create policy travel_booking_segments_member_select on travel_booking_segments
  for select using (is_workspace_member(workspace_id));
create policy travel_booking_segments_member_insert on travel_booking_segments
  for insert with check (is_workspace_member(workspace_id));
create policy travel_booking_segments_member_update on travel_booking_segments
  for update using (is_workspace_member(workspace_id))
  with check (is_workspace_member(workspace_id));
create policy travel_booking_segments_member_delete on travel_booking_segments
  for delete using (is_workspace_member(workspace_id));
