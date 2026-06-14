-- 0036 — Contextual nudge state (Phase 12). Nudges are DERIVED every load by the
-- context rule engine from live signals (weather, buffer-thinness) against the
-- day — never stored, always current. This table persists only the traveller's
-- verdict per nudge (accepted / dismissed) so a confirmed action sticks and a
-- dismissed one never pesters again. `action` keeps the accepted proposal's
-- payload (e.g. the mock fast-track voucher) for display.
--
-- Like readiness, a nudge is the traveller's in-the-moment prompt: owner-only,
-- never visible upward to a workspace manager.

create type nudge_verdict as enum ('accepted', 'dismissed');

create table if not exists nudge_states (
  id uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null references itineraries(id) on delete cascade,
  nudge_key text not null,
  verdict nudge_verdict not null,
  action jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (itinerary_id, nudge_key)
);
create index nudge_states_itin_idx on nudge_states(itinerary_id);
create trigger nudge_states_updated_at before update on nudge_states
  for each row execute function set_updated_at();

alter table nudge_states enable row level security;

-- Owner-only (read + write): a nudge verdict is private to the traveller.
create policy nudge_states_select on nudge_states for select using (
  exists (select 1 from itineraries i where i.id = nudge_states.itinerary_id and i.user_id = auth.uid())
);
create policy nudge_states_write on nudge_states for all using (
  exists (select 1 from itineraries i where i.id = nudge_states.itinerary_id and i.user_id = auth.uid())
) with check (
  exists (select 1 from itineraries i where i.id = nudge_states.itinerary_id and i.user_id = auth.uid())
);
