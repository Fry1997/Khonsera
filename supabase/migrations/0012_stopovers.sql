-- ============================================================================
-- 0012: Stopovers
--
-- A stopover is an *intent* to drop in somewhere between two real anchors
-- (e.g. "fit a 30-minute return to the hotel between the expo and dinner").
-- It is NOT a stop in its own right — it has no fixed time and no sequence;
-- those are computed at draft time once travel-time data is available.
--
-- The stopover anchors itself to a directional pair of stops (from_stop_id,
-- to_stop_id) and carries:
--   * The place to drop in (location_id / customer_id / customer_site_id +
--     title — mirrors how stops resolve place references).
--   * An ideal duration in minutes (default 30).
--   * Optional metadata jsonb for forward-compatible extensions (mode
--     preferences, "split-the-difference" hints, etc.).
-- ============================================================================

create table if not exists stopovers (
  id uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null references itineraries(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,

  -- The leg the stopover sits between. Both stops must exist in the same
  -- itinerary; that invariant is enforced at write time by the server
  -- action rather than as a check constraint (cross-row check is awkward).
  from_stop_id uuid not null references stops(id) on delete cascade,
  to_stop_id uuid not null references stops(id) on delete cascade,

  -- Place references — mirrors `stops`. Exactly one of (location_id,
  -- customer_site_id, customer_id) should be set, but the server action
  -- enforces that; we keep the schema permissive so future intent types
  -- (e.g. a generic "find a cafe near here") don't need a migration.
  location_id uuid references locations(id) on delete set null,
  customer_id uuid references customers(id) on delete set null,
  customer_site_id uuid references customer_sites(id) on delete set null,
  title text,

  -- Ideal duration the user wants to spend. The actual fitted duration is
  -- computed at draft time from neighbour anchors + travel times.
  duration_minutes integer not null default 30 check (duration_minutes > 0),

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One stopover per (leg, place) combo — prevents the user from
  -- accidentally adding the same hotel twice between two anchors.
  unique (from_stop_id, to_stop_id, location_id, customer_site_id, customer_id)
);

create index if not exists stopovers_itinerary_idx
  on stopovers(itinerary_id);
create index if not exists stopovers_workspace_idx
  on stopovers(workspace_id);
create index if not exists stopovers_from_stop_idx
  on stopovers(from_stop_id);
create index if not exists stopovers_to_stop_idx
  on stopovers(to_stop_id);
create index if not exists stopovers_location_idx
  on stopovers(location_id);

create trigger stopovers_updated_at
  before update on stopovers
  for each row execute function set_updated_at();

alter table stopovers enable row level security;

create policy stopovers_member_select on stopovers
  for select using (is_workspace_member(workspace_id));
create policy stopovers_member_insert on stopovers
  for insert with check (is_workspace_member(workspace_id));
create policy stopovers_member_update on stopovers
  for update using (is_workspace_member(workspace_id))
  with check (is_workspace_member(workspace_id));
create policy stopovers_member_delete on stopovers
  for delete using (is_workspace_member(workspace_id));
