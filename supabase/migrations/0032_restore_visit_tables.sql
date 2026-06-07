-- 0032_restore_visit_tables.sql
-- Restore the lightweight-CRM 'visit' feature mistakenly dropped by 0031's
-- CASCADE (it also took the visit_status enum + visit_plan_transition fn).
-- Faithful re-creation from 0001/0003/0006. Schema + reference data restored;
-- row data in visit_plans/visit_checklist_items was lost in the drop (see
-- DECISIONS.md B1). customers/customer_sites were KEPT and are untouched.

-- 1. Enum (CASCADE-dropped) -------------------------------------------------
create type visit_status as enum ('draft', 'checking', 'proposed', 'confirmed', 'booked', 'in_progress', 'completed', 'cancelled');

-- 2. visit_plans -----------------------------------------------------------
create table visit_plans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  customer_site_id uuid references customer_sites(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  title text,
  status visit_status not null default 'draft',
  proposed_start_time timestamptz,
  proposed_end_time timestamptz,
  meeting_duration_minutes integer,
  desired_arrival_time timestamptz,
  latest_departure_from_site_time timestamptz,
  latest_return_time timestamptz,
  start_location_id uuid references locations(id) on delete set null,
  return_location_id uuid references locations(id) on delete set null,
  travel_mode_preference travel_mode_preference not null default 'compare',
  arrival_buffer_minutes integer not null default 15,
  return_buffer_minutes integer not null default 15,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index visit_plans_workspace_idx on visit_plans(workspace_id);
create index visit_plans_user_idx on visit_plans(user_id);
create index visit_plans_status_idx on visit_plans(status);
create trigger visit_plans_updated_at before update on visit_plans
  for each row execute function set_updated_at();

-- 3. visit_checklist_items -------------------------------------------------
create table visit_checklist_items (
  id uuid primary key default gen_random_uuid(),
  visit_plan_id uuid not null references visit_plans(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  label text not null,
  status checklist_status not null default 'incomplete',
  due_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index visit_checklist_visit_idx on visit_checklist_items(visit_plan_id);
create trigger visit_checklist_updated_at before update on visit_checklist_items
  for each row execute function set_updated_at();

-- 4. FK indexes (from 0006) ------------------------------------------------
create index visit_checklist_items_workspace_idx          on visit_checklist_items(workspace_id);
create index visit_plans_contact_idx                      on visit_plans(contact_id);
create index visit_plans_customer_idx                     on visit_plans(customer_id);
create index visit_plans_customer_site_idx                on visit_plans(customer_site_id);
create index visit_plans_return_location_idx              on visit_plans(return_location_id);
create index visit_plans_start_location_idx               on visit_plans(start_location_id);

-- 5. visit_status_edges + seed ---------------------------------------------
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
alter table visit_status_edges enable row level security;
create policy "visit_status_edges_read" on visit_status_edges for select using (true);

-- 6. visit_plan_transition() -----------------------------------------------
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

-- 7. RLS: enable + workspace-member policies --------------------------------
alter table visit_plans           enable row level security;
alter table visit_checklist_items enable row level security;
do $rls$
declare t text;
begin
  foreach t in array array['visit_plans','visit_checklist_items'] loop
    execute format($f$
      create policy "%1$s_member_select" on %1$s for select using (is_workspace_member(workspace_id));
      create policy "%1$s_member_insert" on %1$s for insert with check (is_workspace_member(workspace_id));
      create policy "%1$s_member_update" on %1$s for update using (is_workspace_member(workspace_id)) with check (is_workspace_member(workspace_id));
      create policy "%1$s_member_delete" on %1$s for delete using (is_workspace_member(workspace_id));
    $f$, t);
  end loop;
end$rls$;
