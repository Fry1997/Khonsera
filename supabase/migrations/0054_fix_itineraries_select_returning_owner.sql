-- 0054 — Fix: new-day creation broken since 0048 (INSERT...RETURNING under RLS).
--
-- mig 0048 set itineraries_select USING to can_access_itinerary(id), a STABLE
-- SECURITY DEFINER function that re-queries the itineraries table. Every create
-- (createEvent / PlanCreate / recurring generation) does INSERT ... RETURNING id
-- via PostgREST .select(). The SELECT policy is applied to the returned row, but
-- the function's internal query cannot see the just-inserted, stop-less row
-- (same-statement snapshot), so the owner branch returns FALSE → RLS denies the
-- RETURNING → the whole insert fails. Net effect: NO new itinerary could be
-- created at all after 0048 (proven: zero itineraries created post-0048; the
-- recurring "0 Thursdays" report was the visible symptom).
--
-- Fix: evaluate the owner branch directly on the row's own user_id column (no
-- re-query, always visible to RETURNING), falling back to can_access_itinerary
-- for member/workspace access. Visibility is logically identical — owner could
-- already see their own day via can_access_itinerary's owner branch — but now the
-- owner check is row-direct so RETURNING passes. The personal-mode privacy
-- boundary (members gated by can_access_itinerary's work-stop check) is unchanged.
alter policy itineraries_select on itineraries
  using ((user_id = auth.uid()) or can_access_itinerary(id));
