-- ============================================================================
-- 0018: Drop scoring-engine artefacts
--
-- The per-leg scoring engine (introduced in 0016) turned out to be the
-- wrong abstraction — the product call is to let the executive pick
-- the mode and have Khonsera flag options that won't work, rather
-- than rank-and-pick on their behalf.
--
-- This migration drops the columns that only existed to feed weights
-- and overrides into that scorer:
--   • itineraries.trip_purpose           (was → weights profile)
--   • transitions.user_mode_override     (was → recommended-vs-picked)
--   • transitions.override_locked        (was → live-system dismiss)
--   • the override index
--
-- Kept (re-purposable for feasibility checks downstream):
--   • travel_profiles.walking_threshold_minutes  ("won't walk longer than")
--   • travel_profiles.minimum_buffer_minutes     ("tight" threshold)
--   • travel_profiles.max_taxi_fare_pence
--   • travel_profiles.luggage_default
--   • itineraries.luggage_for_trip
--   • the 'walk' / 'taxi' / 'no_preference' enum values
-- ============================================================================

drop index if exists transitions_override_idx;

alter table transitions
  drop column if exists user_mode_override,
  drop column if exists override_locked;

alter table itineraries
  drop column if exists trip_purpose;
