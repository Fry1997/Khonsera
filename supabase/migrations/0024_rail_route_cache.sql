-- Cache of railway track geometry fetched from OpenStreetMap Overpass API.
-- Keyed by station CRS code pair (e.g., "WEL" → "LEI"). The encoded
-- polyline follows Google's algorithm and can be passed directly to
-- Static Maps path=enc:... or decoded for vector rendering.
--
-- One row per directed pair. WEL→LEI and LEI→WEL are separate entries
-- because the track geometry may differ (different platforms, junctions).

create table if not exists rail_route_cache (
  from_station_code text not null,
  to_station_code text not null,
  encoded_polyline text not null,
  point_count integer not null default 0,
  fetched_at timestamptz not null default now(),
  primary key (from_station_code, to_station_code)
);

comment on table rail_route_cache is
  'Cached railway track polylines from OpenStreetMap, keyed by UK CRS station codes.';
