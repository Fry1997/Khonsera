-- ============================================================================
-- 0013: Drop the 'draft' status from the itinerary lifecycle
--
-- The 'brief' form already does the work that 'draft' represented — by
-- the time a user clicks "Build my day" they're past the napkin stage.
-- Landing them on status='draft' afterwards reads as a regression to
-- the user. We collapse it: brief submits straight to 'planning'.
--
-- The enum value 'draft' itself stays on the type (Postgres can't drop
-- one enum value cleanly without recreating the whole type, and the
-- table_status references would have to be rewritten). It just becomes
-- unreachable — no edges in/out via the state machine, no default, and
-- any existing rows are migrated forward.
-- ============================================================================

-- 1. Forward-migrate any existing draft itineraries to planning. The
--    block_direct_itinerary_status_update trigger from 0010 forbids
--    plain UPDATEs to status; the same bypass setting it checks for is
--    used here so a one-off DDL migration can move rows without
--    inserting an audit_event for each.
set local app.allow_status_update = 'on';
update itineraries set status = 'planning' where status = 'draft';
reset app.allow_status_update;

-- 2. Drop edges in/out of draft, and add the recovery edges that took
--    over its role:
--    * cancelled -> planning replaces the old cancelled -> draft loop
--      (you reactivate a cancelled trip back into planning now).
--    * planning -> planning is a no-op already handled by the state
--      machine's same-status fast path; no edge needed.
delete from itinerary_status_edges
  where from_status = 'draft' or to_status = 'draft';

insert into itinerary_status_edges (from_status, to_status) values
  ('cancelled', 'planning')
  on conflict do nothing;

-- 3. New default for fresh inserts. createItineraryFromBrief sets it
--    explicitly too, but the column default catches any other path.
alter table itineraries alter column status set default 'planning';
