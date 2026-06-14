-- 0035 — Readiness state (Phase 4). The readiness checklist is DERIVED from the
-- day-object by a rules engine on every load (always correct, no stale state);
-- this table persists only the user's verdict per item (tick / dismiss / snooze).
-- Readiness is the traveller's PRIVATE prep — owner-only, even to a workspace
-- manager (who sees work outcomes, never the person's preparation).

create type readiness_status as enum ('open', 'done', 'dismissed', 'snoozed');

create table if not exists readiness_state (
  id uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null references itineraries(id) on delete cascade,
  item_key text not null,
  status readiness_status not null default 'open',
  snooze_until timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (itinerary_id, item_key)
);
create index readiness_state_itin_idx on readiness_state(itinerary_id);
create trigger readiness_state_updated_at before update on readiness_state
  for each row execute function set_updated_at();

alter table readiness_state enable row level security;

-- Owner-only (read + write): readiness is private prep, never visible upward.
create policy readiness_state_select on readiness_state for select using (
  exists (select 1 from itineraries i where i.id = readiness_state.itinerary_id and i.user_id = auth.uid())
);
create policy readiness_state_write on readiness_state for all using (
  exists (select 1 from itineraries i where i.id = readiness_state.itinerary_id and i.user_id = auth.uid())
) with check (
  exists (select 1 from itineraries i where i.id = readiness_state.itinerary_id and i.user_id = auth.uid())
);
