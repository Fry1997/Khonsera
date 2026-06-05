-- Phase 3: three-variable appointment model.
--
-- An appointment's timing is three variables — arrive, duration, leave — where
-- any two determine the third, and each carries a `kind` (precise/fuzzy/range/
-- by/maximise/derived) and a `source` (what committed it: user_set,
-- outbound_train, home_by, derived_*, …). The engine resolves these into the
-- canonical start_time/end_time/duration_minutes the time solver already reads;
-- these columns hold the richer intent layer the planning view renders from.
--
-- Stored as jsonb (one small object each), nullable — only appointment-shaped
-- stops use them, and existing stops are unaffected (null = fall back to the
-- legacy start/end/duration behaviour). Shapes mirror src/lib/planning/
-- appointment.ts:
--   arrive_value   { "time": iso|null,    "kind": ..., "source": ... }
--   duration_value { "minutes": int|null, "kind": ..., "source": ... }
--   leave_value    { "time": iso|null,    "kind": ..., "source": ... }
ALTER TABLE public.stops
  ADD COLUMN IF NOT EXISTS arrive_value jsonb,
  ADD COLUMN IF NOT EXISTS duration_value jsonb,
  ADD COLUMN IF NOT EXISTS leave_value jsonb;
