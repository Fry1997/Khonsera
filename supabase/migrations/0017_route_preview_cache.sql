-- ============================================================================
-- 0017: Route preview cache
--
-- Routes API calls were re-firing on every page load for every leg ×
-- every mode (walk/drive/taxi), making the editor's per-mode pills
-- feel sluggish and racking up unnecessary Routes API spend. Cache
-- the results keyed on (from_stop_id, to_stop_id, mode). The
-- underlying geographic data is stable, so a long-lived cache is
-- safe; previewRoute reads from this table first and only hits the
-- Routes API on miss / stale rows.
--
-- Open RLS policies — these are just driving-time facts about pairs
-- of public coordinates, not user data, and the cache benefit only
-- materialises when reads/writes are cheap from any auth context.
-- ============================================================================

create table if not exists route_preview_cache (
  from_stop_id uuid not null references stops(id) on delete cascade,
  to_stop_id uuid not null references stops(id) on delete cascade,
  mode text not null check (mode in ('walk', 'drive', 'taxi')),
  duration_minutes integer,
  distance_miles double precision,
  computed_at timestamptz not null default now(),
  primary key (from_stop_id, to_stop_id, mode)
);

create index if not exists route_preview_cache_computed_idx
  on route_preview_cache(computed_at);

alter table route_preview_cache enable row level security;

create policy route_preview_cache_select on route_preview_cache
  for select using (true);
create policy route_preview_cache_insert on route_preview_cache
  for insert with check (true);
create policy route_preview_cache_update on route_preview_cache
  for update using (true) with check (true);
