-- TRUE PER-EVENT PRIVACY (founder direction 2026-06-16). A day can hold both work
-- and personal events; the privacy boundary moves from the whole itinerary to the
-- individual stop. A workspace member sees ONLY work stops (and only legs that
-- don't touch a personal stop), and a day is visible to the workspace only if it
-- has work content. The OWNER always sees everything. Strictly TIGHTENING vs the
-- prior per-day rule — it can only reduce member visibility, never widen it.

-- 1) Per-stop mode (nullable + inherit-the-day trigger; an explicit setStopMode
--    overrides). NULL is treated as NOT work by the policies — fail closed.
alter table public.stops add column if not exists app_mode app_mode;
update public.stops s set app_mode = i.mode
  from public.itineraries i where i.id = s.itinerary_id and s.app_mode is null;

create or replace function public.stops_inherit_mode()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if NEW.app_mode is null then
    select i.mode into NEW.app_mode from public.itineraries i where i.id = NEW.itinerary_id;
  end if;
  return NEW;
end; $$;
drop trigger if exists stops_inherit_mode_trg on public.stops;
create trigger stops_inherit_mode_trg before insert on public.stops
  for each row execute function public.stops_inherit_mode();

-- 2) Owner helper.
create or replace function public.owns_itinerary(itin uuid)
returns boolean language sql stable security definer
set search_path to 'public' set row_security to 'off' as $$
  select exists (select 1 from itineraries i where i.id = itin and i.user_id = auth.uid());
$$;
revoke execute on function public.owns_itinerary(uuid) from anon;

-- 3) Day visible to a member iff it has a WORK stop. row_security off so its
--    internal reads compute the true answer (no nested-RLS surprises).
create or replace function public.can_access_itinerary(itin uuid)
returns boolean language sql stable security definer
set search_path to 'public' set row_security to 'off' as $$
  select exists (
    select 1 from itineraries i
    where i.id = itin
      and ( i.user_id = auth.uid()
            or ( is_workspace_member(i.workspace_id)
                 and exists (select 1 from stops s where s.itinerary_id = i.id and s.app_mode = 'work') ) )
  );
$$;

-- 4) Stops: owner sees all; a member sees ONLY work stops.
drop policy if exists stops_access on public.stops;
create policy stops_access on public.stops for all
  using ( owns_itinerary(itinerary_id) or (app_mode = 'work' and is_workspace_member(workspace_id)) )
  with check ( owns_itinerary(itinerary_id) or (app_mode = 'work' and is_workspace_member(workspace_id)) );

-- 5) Transitions: a member sees a leg only if NEITHER endpoint is a personal stop.
drop policy if exists transitions_access on public.transitions;
create policy transitions_access on public.transitions for all
  using ( owns_itinerary(itinerary_id)
          or ( is_workspace_member(workspace_id)
               and not exists (select 1 from stops s
                               where s.id in (transitions.from_stop_id, transitions.to_stop_id)
                                 and (s.app_mode is distinct from 'work')) ) )
  with check ( owns_itinerary(itinerary_id)
          or ( is_workspace_member(workspace_id)
               and not exists (select 1 from stops s
                               where s.id in (transitions.from_stop_id, transitions.to_stop_id)
                                 and (s.app_mode is distinct from 'work')) ) );

-- 6) Itinerary visibility flows through the redefined can_access_itinerary.
drop policy if exists itineraries_select on public.itineraries;
create policy itineraries_select on public.itineraries for select
  using ( can_access_itinerary(id) );
