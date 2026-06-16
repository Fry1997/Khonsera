-- FK checks on recurring_event_id do an RLS-subject read of recurring_events in
-- the RI trigger context, which can't see the owner's own row there — so inserting
-- a generated day (or an override) failed with a foreign-key violation, even
-- though the rule exists and the user owns it. recurring_event_id is only a tag
-- (idempotency + collision offers), not integrity-critical, so make it a SOFT
-- reference: drop the FK. Deleting a rule simply leaves a harmless dangling tag
-- (handled in deleteRecurringEvent), never a broken insert.
alter table public.itineraries
  drop constraint if exists itineraries_recurring_event_id_fkey;
alter table public.recurring_occurrence_overrides
  drop constraint if exists recurring_occurrence_overrides_recurring_event_id_fkey;
