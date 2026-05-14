-- Layer 2 — state machines.
-- VisitPlan and SavedTrip have legal status transitions enforced in the DB.
-- All status changes MUST go through the transition functions; direct UPDATEs
-- to .status are blocked by a trigger so the UI/server-actions can't bypass.
--
-- Legal edges (kept identical to src/lib/state/*.ts):
--
-- VisitPlan:
--   draft        → checking | cancelled
--   checking     → draft | proposed | not_possible | cancelled       (*)
--   proposed     → checking | confirmed | cancelled
--   confirmed    → booked | in_progress | cancelled
--   booked       → in_progress | cancelled
--   in_progress  → completed | cancelled
--   completed    → (terminal)
--   cancelled    → draft
--
-- SavedTrip:
--   upcoming     → ready | cancelled
--   ready        → in_progress | cancelled
--   in_progress  → completed | cancelled
--   completed    → (terminal)
--   cancelled    → (terminal)
--
-- (*) `not_possible` is represented in the planning verdict, not as a
-- VisitPlan status. The status enum from 0001 doesn't include it, so we don't
-- transition into it here. Visit stays in `checking` with the failing
-- PlanningRun attached.

-- ============================================================================
-- Edge tables — declarative source of truth, easy to audit and test.
-- ============================================================================
create table visit_status_edges (
  from_status visit_status not null,
  to_status   visit_status not null,
  primary key (from_status, to_status)
);
insert into visit_status_edges (from_status, to_status) values
  ('draft','checking'),       ('draft','cancelled'),
  ('checking','draft'),       ('checking','proposed'),     ('checking','cancelled'),
  ('proposed','checking'),    ('proposed','confirmed'),    ('proposed','cancelled'),
  ('confirmed','booked'),     ('confirmed','in_progress'), ('confirmed','cancelled'),
  ('booked','in_progress'),   ('booked','cancelled'),
  ('in_progress','completed'),('in_progress','cancelled'),
  ('cancelled','draft');

create table saved_trip_edges (
  from_status saved_trip_status not null,
  to_status   saved_trip_status not null,
  primary key (from_status, to_status)
);
insert into saved_trip_edges (from_status, to_status) values
  ('upcoming','ready'),       ('upcoming','cancelled'),
  ('ready','in_progress'),    ('ready','cancelled'),
  ('in_progress','completed'),('in_progress','cancelled');

-- Edge tables are reference data — read-only to all clients.
alter table visit_status_edges enable row level security;
alter table saved_trip_edges   enable row level security;
create policy "visit_status_edges_read" on visit_status_edges for select using (true);
create policy "saved_trip_edges_read"   on saved_trip_edges   for select using (true);

-- ============================================================================
-- Transition functions. SECURITY DEFINER so they can write to audit_events
-- regardless of caller's RLS posture. They still check workspace membership
-- explicitly before mutating.
-- ============================================================================
create or replace function visit_plan_transition(
  p_visit_id uuid,
  p_to_status visit_status,
  p_actor_id uuid,
  p_metadata jsonb default null
) returns visit_plans
language plpgsql security definer set search_path = public as $$
declare
  v_before visit_plans;
  v_after  visit_plans;
begin
  select * into v_before from visit_plans where id = p_visit_id for update;
  if not found then
    raise exception 'visit not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from memberships m
    where m.workspace_id = v_before.workspace_id
      and m.user_id = p_actor_id
      and m.status = 'active'
  ) then
    raise exception 'actor not a member of workspace' using errcode = '42501';
  end if;

  if v_before.status = p_to_status then
    return v_before;  -- idempotent no-op
  end if;

  if not exists (
    select 1 from visit_status_edges
    where from_status = v_before.status and to_status = p_to_status
  ) then
    raise exception 'illegal transition % -> %', v_before.status, p_to_status
      using errcode = '22023';
  end if;

  update visit_plans set status = p_to_status where id = p_visit_id
    returning * into v_after;

  insert into audit_events (workspace_id, actor_id, entity_type, entity_id, action, before, after, metadata)
    values (v_after.workspace_id, p_actor_id, 'visit_plan', v_after.id,
            'transition:' || p_to_status::text,
            jsonb_build_object('status', v_before.status),
            jsonb_build_object('status', v_after.status),
            p_metadata);

  return v_after;
end;
$$;

create or replace function saved_trip_transition(
  p_trip_id uuid,
  p_to_status saved_trip_status,
  p_actor_id uuid,
  p_metadata jsonb default null
) returns saved_trips
language plpgsql security definer set search_path = public as $$
declare
  v_before saved_trips;
  v_after  saved_trips;
begin
  select * into v_before from saved_trips where id = p_trip_id for update;
  if not found then
    raise exception 'trip not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from memberships m
    where m.workspace_id = v_before.workspace_id
      and m.user_id = p_actor_id
      and m.status = 'active'
  ) then
    raise exception 'actor not a member of workspace' using errcode = '42501';
  end if;

  if v_before.status = p_to_status then
    return v_before;
  end if;

  if not exists (
    select 1 from saved_trip_edges
    where from_status = v_before.status and to_status = p_to_status
  ) then
    raise exception 'illegal transition % -> %', v_before.status, p_to_status
      using errcode = '22023';
  end if;

  update saved_trips set status = p_to_status,
    travel_day_started_at = case when p_to_status = 'in_progress' and travel_day_started_at is null then now() else travel_day_started_at end,
    completed_at = case when p_to_status = 'completed' then now() else completed_at end
    where id = p_trip_id
    returning * into v_after;

  insert into audit_events (workspace_id, actor_id, entity_type, entity_id, action, before, after, metadata)
    values (v_after.workspace_id, p_actor_id, 'saved_trip', v_after.id,
            'transition:' || p_to_status::text,
            jsonb_build_object('status', v_before.status),
            jsonb_build_object('status', v_after.status),
            p_metadata);

  return v_after;
end;
$$;

-- ============================================================================
-- Guard trigger: forbid direct UPDATEs to .status. Forces all callers through
-- the transition functions. Exception: SECURITY DEFINER functions above run
-- with session_replication_role = 'replica' is NOT what we want here (that
-- disables all triggers). Instead, we set a session flag inside the function
-- and the trigger checks for it.
-- ============================================================================
create or replace function block_direct_status_update() returns trigger
language plpgsql as $$
begin
  if new.status is distinct from old.status
     and coalesce(current_setting('app.allow_status_update', true), '') <> 'on' then
    raise exception 'direct status update forbidden; use the transition function'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Wrap transition functions to set the flag for the duration of the UPDATE.
create or replace function visit_plan_transition(
  p_visit_id uuid,
  p_to_status visit_status,
  p_actor_id uuid,
  p_metadata jsonb default null
) returns visit_plans
language plpgsql security definer set search_path = public as $$
declare
  v_before visit_plans;
  v_after  visit_plans;
begin
  select * into v_before from visit_plans where id = p_visit_id for update;
  if not found then raise exception 'visit not found' using errcode = 'P0002'; end if;

  if not exists (
    select 1 from memberships m
    where m.workspace_id = v_before.workspace_id
      and m.user_id = p_actor_id and m.status = 'active'
  ) then raise exception 'actor not a member of workspace' using errcode = '42501'; end if;

  if v_before.status = p_to_status then return v_before; end if;

  if not exists (
    select 1 from visit_status_edges
    where from_status = v_before.status and to_status = p_to_status
  ) then raise exception 'illegal transition % -> %', v_before.status, p_to_status using errcode = '22023'; end if;

  perform set_config('app.allow_status_update', 'on', true);
  update visit_plans set status = p_to_status where id = p_visit_id returning * into v_after;
  perform set_config('app.allow_status_update', '', true);

  insert into audit_events (workspace_id, actor_id, entity_type, entity_id, action, before, after, metadata)
    values (v_after.workspace_id, p_actor_id, 'visit_plan', v_after.id,
            'transition:' || p_to_status::text,
            jsonb_build_object('status', v_before.status),
            jsonb_build_object('status', v_after.status),
            p_metadata);
  return v_after;
end;
$$;

create or replace function saved_trip_transition(
  p_trip_id uuid,
  p_to_status saved_trip_status,
  p_actor_id uuid,
  p_metadata jsonb default null
) returns saved_trips
language plpgsql security definer set search_path = public as $$
declare
  v_before saved_trips;
  v_after  saved_trips;
begin
  select * into v_before from saved_trips where id = p_trip_id for update;
  if not found then raise exception 'trip not found' using errcode = 'P0002'; end if;

  if not exists (
    select 1 from memberships m
    where m.workspace_id = v_before.workspace_id
      and m.user_id = p_actor_id and m.status = 'active'
  ) then raise exception 'actor not a member of workspace' using errcode = '42501'; end if;

  if v_before.status = p_to_status then return v_before; end if;

  if not exists (
    select 1 from saved_trip_edges
    where from_status = v_before.status and to_status = p_to_status
  ) then raise exception 'illegal transition % -> %', v_before.status, p_to_status using errcode = '22023'; end if;

  perform set_config('app.allow_status_update', 'on', true);
  update saved_trips set status = p_to_status,
    travel_day_started_at = case when p_to_status = 'in_progress' and travel_day_started_at is null then now() else travel_day_started_at end,
    completed_at = case when p_to_status = 'completed' then now() else completed_at end
    where id = p_trip_id returning * into v_after;
  perform set_config('app.allow_status_update', '', true);

  insert into audit_events (workspace_id, actor_id, entity_type, entity_id, action, before, after, metadata)
    values (v_after.workspace_id, p_actor_id, 'saved_trip', v_after.id,
            'transition:' || p_to_status::text,
            jsonb_build_object('status', v_before.status),
            jsonb_build_object('status', v_after.status),
            p_metadata);
  return v_after;
end;
$$;

create trigger visit_plans_block_direct_status
  before update on visit_plans
  for each row execute function block_direct_status_update();

create trigger saved_trips_block_direct_status
  before update on saved_trips
  for each row execute function block_direct_status_update();
