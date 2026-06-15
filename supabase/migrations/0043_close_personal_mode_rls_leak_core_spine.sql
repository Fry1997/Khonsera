-- SECURITY: close the personal-mode privacy leak on the core itinerary spine.
-- Migration 0010 (pre-Mode) created broad `*_member_*` policies keyed only on
-- is_workspace_member(workspace_id) — no owner, no mode guard. Migration 0030
-- introduced the correct mode-aware policies (itineraries_select via mode='work',
-- stops_access / transitions_access via can_access_itinerary) but never dropped
-- the 0010 policies. Because RLS policies are PERMISSIVE (OR'd), the broad ones
-- win: any workspace member could read/modify a colleague's PERSONAL-mode
-- itinerary, stops and transitions. Personal rows DO carry workspace_id
-- (confirmed: 5 itineraries / 29 stops / 25 transitions), so the leak is live.
-- The correct companion policies remain and fully cover legitimate access:
--   itineraries: itineraries_select/insert/update/delete
--   stops:       stops_access (ALL, can_access_itinerary)
--   transitions: transitions_access (ALL, can_access_itinerary)

drop policy if exists itineraries_member_select on public.itineraries;
drop policy if exists itineraries_member_insert on public.itineraries;
drop policy if exists itineraries_member_update on public.itineraries;
drop policy if exists itineraries_member_delete on public.itineraries;

drop policy if exists stops_member_select on public.stops;
drop policy if exists stops_member_insert on public.stops;
drop policy if exists stops_member_update on public.stops;
drop policy if exists stops_member_delete on public.stops;

drop policy if exists transitions_member_select on public.transitions;
drop policy if exists transitions_member_insert on public.transitions;
drop policy if exists transitions_member_update on public.transitions;
drop policy if exists transitions_member_delete on public.transitions;
