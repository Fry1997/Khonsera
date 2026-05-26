-- Simplified UK rail network graph stored as directional edges.
-- Seeded once from the user's browser (Overpass blocks cloud IPs)
-- then used server-side for BFS rail route lookups.

CREATE TABLE IF NOT EXISTS rail_network_edges (
  id bigserial PRIMARY KEY,
  from_lat double precision NOT NULL,
  from_lng double precision NOT NULL,
  to_lat double precision NOT NULL,
  to_lng double precision NOT NULL
);

CREATE INDEX idx_rail_edges_from ON rail_network_edges (from_lat, from_lng);
CREATE INDEX idx_rail_edges_to ON rail_network_edges (to_lat, to_lng);

COMMENT ON TABLE rail_network_edges IS
  'UK rail network graph edges from OpenStreetMap. Seeded client-side, queried server-side for BFS routing.';
