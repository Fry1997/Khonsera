-- Add coordinate columns to transport_hubs so route previews can
-- compute travel durations between transport booking stops.
-- The hubs table (11k+ rail stations and airports) was originally
-- a name/code lookup only; routing needs lat/lng.

ALTER TABLE transport_hubs
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

-- Index for spatial queries (not a PostGIS index — just supports
-- IS NOT NULL checks so we can quickly find hubs with coords).
CREATE INDEX IF NOT EXISTS transport_hubs_has_coords_idx
  ON transport_hubs (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
