-- 0030_foundation_modes_and_journey_model.sql
-- Foundation pass: Work/Personal Mode + the hard privacy boundary (RLS), and the
-- first-class journey entities the concierge model needs — Intention, Gap,
-- ResourceState — plus Task. ADDITIVE ONLY: nothing dropped, no data lost.

-- ============================================================================
-- 1. Mode enum + spec role additions
-- ============================================================================
create type app_mode as enum ('work', 'personal');

-- Spec roles (company_admin | team_manager | traveller). Added additively;
-- legacy values (owner/admin/member/viewer) retained for back-compat mapping.
alter type membership_role add value if not exists 'company_admin';
alter type membership_role add value if not exists 'team_manager';
alter type membership_role add value if not exists 'traveller';

-- ============================================================================
-- 2. Mode column on mode-scoped tables (backfilled, never null)
-- ============================================================================
alter table itineraries add column if not exists mode app_mode not null default 'personal';
update itineraries i set mode = 'work'
  from workspaces w
  where w.id = i.workspace_id and w.type = 'organisation';

alter table contacts        add column if not exists mode app_mode not null default 'personal';
alter table expense_records add column if not exists mode app_mode not null default 'personal';

-- ============================================================================
-- 3. Task (§4.9) — date-bearing tasks surface on that day's journey
-- ============================================================================
create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  workspace_id uuid references workspaces(id) on delete cascade,
  mode app_mode not null default 'personal',
  itinerary_id uuid references itineraries(id) on delete set null,
  title text not null,
  due_date date,
  due_time time,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_user_idx on tasks(user_id);
create index tasks_itinerary_idx on tasks(itinerary_id);
create trigger tasks_updated_at before update on tasks
  for each row execute function set_updated_at();

-- ============================================================================
-- 4. Intention (§4.4) — soft goal with a back-calculated leave-by
-- ============================================================================
create type intention_state as enum ('active', 'toggled_off');
create type intention_flexibility as enum ('soft', 'promoted_to_hard');

create table intentions (
  id uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null references itineraries(id) on delete cascade,
  description text not null,
  target text,                       -- e.g. "with customer by 09:00"
  target_time timestamptz,           -- resolved target if known
  buffer_minutes int,                -- e.g. 20 min freshen-up
  state intention_state not null default 'active',
  flexibility intention_flexibility not null default 'soft',
  leave_by timestamptz,              -- back-calculated by the engine
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index intentions_itinerary_idx on intentions(itinerary_id);
create trigger intentions_updated_at before update on intentions
  for each row execute function set_updated_at();

-- linkedAnchors: Intention <-> Anchor(stop), many-to-many
create table intention_anchors (
  intention_id uuid not null references intentions(id) on delete cascade,
  stop_id uuid not null references stops(id) on delete cascade,
  primary key (intention_id, stop_id)
);

-- ============================================================================
-- 5. Gap (§4.5) — computed space between consecutive anchors
-- ============================================================================
create type gap_type as enum ('transport_gap','accommodation_gap','unplanned_time','care_gap');
create type gap_state as enum ('open','watching','resolved','dismissed');

create table gaps (
  id uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null references itineraries(id) on delete cascade,
  type gap_type not null,
  from_stop_id uuid references stops(id) on delete cascade,
  to_stop_id uuid references stops(id) on delete cascade,
  state gap_state not null default 'open',
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index gaps_itinerary_idx on gaps(itinerary_id);
create trigger gaps_updated_at before update on gaps
  for each row execute function set_updated_at();

-- ============================================================================
-- 6. ResourceState (§4.7) — per-position availability of a travel mode
-- ============================================================================
create type resource_kind as enum ('own_car','own_bike','on_foot','taxi','scheduled_transport');

create table resource_states (
  id uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null references itineraries(id) on delete cascade,
  stop_id uuid references stops(id) on delete cascade,
  kind resource_kind not null,
  available boolean not null default true,
  note text,                         -- e.g. "car is parked at home"
  created_at timestamptz not null default now()
);
create index resource_states_itinerary_idx on resource_states(itinerary_id);

-- ============================================================================
-- 7. Hard privacy boundary — RLS on the journey core + new tables
--    §2: personal-mode data is NEVER visible to a workspace/manager/admin.
-- ============================================================================
-- Owner always; work-mode rows also visible to active workspace members.
-- security definer so the inner read bypasses RLS (no recursion).
create or replace function can_access_itinerary(itin uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from itineraries i
    where i.id = itin
      and ( i.user_id = auth.uid()
            or (i.mode = 'work' and is_workspace_member(i.workspace_id)) )
  );
$$;

alter table itineraries enable row level security;
create policy itineraries_select on itineraries for select
  using (user_id = auth.uid() or (mode = 'work' and is_workspace_member(workspace_id)));
create policy itineraries_insert on itineraries for insert
  with check (user_id = auth.uid());
create policy itineraries_update on itineraries for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy itineraries_delete on itineraries for delete
  using (user_id = auth.uid());

alter table stops enable row level security;
create policy stops_access on stops for all
  using (can_access_itinerary(itinerary_id))
  with check (can_access_itinerary(itinerary_id));

alter table transitions enable row level security;
create policy transitions_access on transitions for all
  using (can_access_itinerary(itinerary_id))
  with check (can_access_itinerary(itinerary_id));

alter table intentions enable row level security;
create policy intentions_access on intentions for all
  using (can_access_itinerary(itinerary_id))
  with check (can_access_itinerary(itinerary_id));

alter table intention_anchors enable row level security;
create policy intention_anchors_access on intention_anchors for all
  using (exists (select 1 from intentions i
                 where i.id = intention_id and can_access_itinerary(i.itinerary_id)))
  with check (exists (select 1 from intentions i
                 where i.id = intention_id and can_access_itinerary(i.itinerary_id)));

alter table gaps enable row level security;
create policy gaps_access on gaps for all
  using (can_access_itinerary(itinerary_id))
  with check (can_access_itinerary(itinerary_id));

alter table resource_states enable row level security;
create policy resource_states_access on resource_states for all
  using (can_access_itinerary(itinerary_id))
  with check (can_access_itinerary(itinerary_id));

alter table tasks enable row level security;
create policy tasks_select on tasks for select
  using (user_id = auth.uid()
         or (mode = 'work' and workspace_id is not null and is_workspace_member(workspace_id)));
create policy tasks_insert on tasks for insert with check (user_id = auth.uid());
create policy tasks_update on tasks for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy tasks_delete on tasks for delete using (user_id = auth.uid());
