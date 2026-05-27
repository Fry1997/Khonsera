-- Add calling_points to travel_booking_segments.
-- Stores intermediate station stops parsed from Trainline PDF itineraries.
-- Format: [{station, station_code, time}]
ALTER TABLE travel_booking_segments
  ADD COLUMN IF NOT EXISTS calling_points jsonb;
