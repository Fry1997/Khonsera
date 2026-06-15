-- 0037 — Mileage trips (Phase 15). The traveller's PRIVATE mileage ledger: each
-- drive as a trip with its actual route, classified business/personal, valued at
-- the HMRC approved rate. Distinct from `mileage_expenses` (a one-off expense
-- line) — this is the claim-ready record with the GPS route + history.
--
-- PRIVATE to the traveller (owner-only RLS): a mileage ledger is the user's own
-- record; sharing/reimbursement to an employer is a later, explicit step (P17),
-- never an ambient exposure. Personal trips never leave the user at all.

create type mileage_class as enum ('business', 'personal', 'unset');
create type mileage_vehicle as enum ('car', 'motorcycle', 'bicycle');
create type mileage_source as enum ('gps', 'manual');

create table if not exists mileage_trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Set only for a work trip the user may later submit; null for personal.
  workspace_id uuid references workspaces(id) on delete set null,
  itinerary_id uuid references itineraries(id) on delete set null,

  started_at timestamptz not null,
  ended_at timestamptz,

  origin_label text,
  origin_lat double precision,
  origin_lng double precision,
  dest_label text,
  dest_lat double precision,
  dest_lng double precision,

  distance_meters double precision not null default 0,
  route_polyline text, -- encoded GPS track (precision 6), null for a manual entry

  classification mileage_class not null default 'unset',
  vehicle mileage_vehicle not null default 'car',
  source mileage_source not null default 'manual',
  purpose text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index mileage_trips_user_idx on mileage_trips(user_id, started_at desc);

create trigger mileage_trips_updated_at before update on mileage_trips
  for each row execute function set_updated_at();

alter table mileage_trips enable row level security;

create policy mileage_trips_select on mileage_trips for select using (user_id = auth.uid());
create policy mileage_trips_write on mileage_trips for all using (user_id = auth.uid()) with check (user_id = auth.uid());
