-- Re-introduce the uncommitted-draft concept for the new "New itinerary" flow.
--
-- createDraftItinerary makes a trip with status='draft' (hidden from every trip
-- list) and promotes it to 'planning' on the user's first content change. That
-- promotion goes through the itinerary_transition RPC (direct status writes are
-- blocked by the 0010 trigger), which checks itinerary_status_edges.
--
-- Migration 0013 retired 'draft' and deleted its edges, so draft->planning is
-- currently rejected as an illegal transition. Restore the promotion edges.
-- The 'draft' enum value still exists; only the edges were missing. Mirrors the
-- original 0010 seed (draft -> planning | cancelled).
INSERT INTO public.itinerary_status_edges (from_status, to_status) VALUES
  ('draft', 'planning'),
  ('draft', 'cancelled')
ON CONFLICT DO NOTHING;
