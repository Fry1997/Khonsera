-- Phase 2: trip-level travel strategy + paired rail bookings.

-- The JourneyMode chip's trip-level strategy (rail vs drive vs mixed). Null =
-- not yet chosen, so the engine recommends one; a value pins the user's
-- choice. Checked against the same vocabulary the ranker reasons about
-- (see src/lib/planning/strategy.ts). Existing itineraries default to null
-- (undecided) so nothing changes for them.
ALTER TABLE public.itineraries
  ADD COLUMN IF NOT EXISTS travel_strategy text
    CHECK (travel_strategy IS NULL OR travel_strategy IN ('rail', 'drive', 'mixed'));

-- Trains book as outbound + return PAIRS, not independent cards. This links
-- the two booking_intents so stepping/cancelling one knows about the other,
-- and the pair fare can be surfaced. Self-referential, nullable (a one-way
-- booking has no pair). ON DELETE SET NULL so dropping one leg doesn't cascade
-- away the other.
ALTER TABLE public.booking_intents
  ADD COLUMN IF NOT EXISTS paired_booking_id uuid
    REFERENCES public.booking_intents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS booking_intents_paired_idx
  ON public.booking_intents(paired_booking_id);
