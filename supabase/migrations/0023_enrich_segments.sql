-- Enrich travel_booking_segments with fields from Gmail parser.
-- The Trainline PDF parser extracts operator, ticket type, route restriction,
-- station codes, coach/seat, and Aztec barcode data — but the segments table
-- had no columns for them. This migration adds them.
ALTER TABLE travel_booking_segments
  ADD COLUMN IF NOT EXISTS from_station_code text,
  ADD COLUMN IF NOT EXISTS to_station_code text,
  ADD COLUMN IF NOT EXISTS operator text,
  ADD COLUMN IF NOT EXISTS ticket_type text,
  ADD COLUMN IF NOT EXISTS route_restriction text,
  ADD COLUMN IF NOT EXISTS coach text,
  ADD COLUMN IF NOT EXISTS seat text,
  ADD COLUMN IF NOT EXISTS barcode_ref text,
  ADD COLUMN IF NOT EXISTS barcode_data text;
