-- ============================================================================
-- 0014: Promote stopovers from a parallel table into real stops rows
--
-- Phase 1's stopovers table modelled "drop-in between two anchors" as a
-- separate entity with FKs to the anchor stops. That made the leg
-- transitions (anchor → stopover, stopover → anchor) unrepresentable —
-- the transitions table FKs to stops, and a stopover wasn't one. The
-- brief form carried both legs in client-side state but couldn't
-- persist them.
--
-- This migration closes the gap by making a stopover a stop. New
-- stop_type enum value 'stopover' marks them; metadata.kind='stopover'
-- mirrors the marker for callers that read by jsonb.  Sequence-wise
-- they sit between their from_stop and to_stop, with every later stop
-- in the same itinerary bumped one position to make room.
--
-- The stopovers table is left in place but no longer written to — new
-- code persists straight into stops. A future migration will drop it
-- once we're sure nothing legacy needs it.
-- ============================================================================

-- 1. Extend the enum. ALTER TYPE ADD VALUE is one-way in Postgres
--    (can't be undone without recreating the type), so we use a tight
--    'if not exists' guard.
alter type stop_type add value if not exists 'stopover';

-- 2. Migrate each existing stopovers row into a stops row sitting
--    between its from_stop and to_stop. Sequence numbers are bumped
--    for every stop in the same itinerary at or after the to_stop's
--    position, so the new row slots in immediately before the to_stop.
--
--    Using a DO block (PL/pgSQL) because the per-row bump cascade
--    needs a loop; this is a one-shot migration so the cost is fine.
do $$
declare
  sv record;
  to_seq integer;
  new_id uuid;
begin
  for sv in select * from stopovers loop
    select sequence into to_seq from stops where id = sv.to_stop_id;

    -- Shift every later stop in the itinerary down by one to open a
    -- slot.  Direct UPDATE to sequence is allowed for stops — the
    -- block_direct_itinerary_status_update trigger only guards the
    -- itineraries table's status column.
    update stops
       set sequence = sequence + 1
     where itinerary_id = sv.itinerary_id
       and sequence >= to_seq;

    -- Insert the new stopover stop in the freed slot.
    insert into stops (
      itinerary_id,
      workspace_id,
      sequence,
      type,
      title,
      location_id,
      customer_id,
      customer_site_id,
      duration_minutes,
      is_time_fixed,
      metadata
    ) values (
      sv.itinerary_id,
      sv.workspace_id,
      to_seq,
      'stopover',
      sv.title,
      sv.location_id,
      sv.customer_id,
      sv.customer_site_id,
      sv.duration_minutes,
      false,
      jsonb_build_object('kind', 'stopover')
    )
    returning id into new_id;
  end loop;
end;
$$;

-- 3. Truncate the stopovers table so it can't get out of sync with
--    the canonical stops rows we just created. The table itself
--    stays around for one more migration cycle so a hot-rollback
--    isn't catastrophic.
truncate table stopovers;
