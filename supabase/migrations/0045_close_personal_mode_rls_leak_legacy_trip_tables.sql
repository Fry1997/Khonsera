-- SECURITY (continues 0043/0044): the legacy 0010 trip tables also leaked. They
-- carry no user_id/itinerary_id directly but link cleanly to an itinerary:
--   journey_legs.transition_id  → transitions.itinerary_id   (56/56 populated)
--   travel_bookings.booking_intent_id → booking_intents.itinerary_id (2/2)
-- Gate both via can_access_itinerary on the linked itinerary, mirroring the spine.

drop policy if exists journey_legs_member_select on public.journey_legs;
drop policy if exists journey_legs_member_insert on public.journey_legs;
drop policy if exists journey_legs_member_update on public.journey_legs;
drop policy if exists journey_legs_member_delete on public.journey_legs;
create policy journey_legs_access on public.journey_legs
  for all using (
    exists (select 1 from transitions t where t.id = journey_legs.transition_id and can_access_itinerary(t.itinerary_id))
  ) with check (
    exists (select 1 from transitions t where t.id = journey_legs.transition_id and can_access_itinerary(t.itinerary_id))
  );

drop policy if exists travel_bookings_member_select on public.travel_bookings;
drop policy if exists travel_bookings_member_insert on public.travel_bookings;
drop policy if exists travel_bookings_member_update on public.travel_bookings;
drop policy if exists travel_bookings_member_delete on public.travel_bookings;
create policy travel_bookings_access on public.travel_bookings
  for all using (
    exists (select 1 from booking_intents bi where bi.id = travel_bookings.booking_intent_id and can_access_itinerary(bi.itinerary_id))
  ) with check (
    exists (select 1 from booking_intents bi where bi.id = travel_bookings.booking_intent_id and can_access_itinerary(bi.itinerary_id))
  );
