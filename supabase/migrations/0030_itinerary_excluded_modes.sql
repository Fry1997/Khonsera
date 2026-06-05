-- Journey-level mode exclusions (P1.4). The travel_profile holds account-wide
-- exclusions (won't-walk-over, taxi-fare cap, preferred mode). This is the
-- per-journey override: "not the tube on this trip", "no driving today (the
-- car's in the garage)". The planning ranker filters candidate modes against
-- this list before ranking — see src/lib/planning/exclusions.ts.
--
-- text[] of mode IDs (matching the transition mode vocabulary:
-- walk/drive/taxi/bus/tube/train/flight). Empty array = nothing excluded,
-- which is the default so all existing itineraries are unaffected.
ALTER TABLE public.itineraries
  ADD COLUMN IF NOT EXISTS excluded_modes text[] NOT NULL DEFAULT '{}';
