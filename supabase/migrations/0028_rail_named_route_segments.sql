CREATE TABLE rail_named_route_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  osm_relation_id bigint NOT NULL,
  route_name text,
  operator text,
  from_station_name text NOT NULL,
  to_station_name text NOT NULL,
  from_station_code text,
  to_station_code text,
  encoded_polyline text NOT NULL,
  point_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (from_station_code, to_station_code)
);
