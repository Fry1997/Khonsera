-- Layer 2.5 — cross-cutting primitives.
-- Lands before state machines (0003) because state-transition functions write
-- to audit_events. Order matters: any layer that mutates state from here on
-- assumes audit + idempotency + workspace_settings exist.

-- ============================================================================
-- workspace_settings — typed feature flags + per-workspace config
-- One row per workspace (1:1). Read through src/lib/flags/workspace-flags.ts.
-- ============================================================================
create table workspace_settings (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  flags jsonb not null default '{}'::jsonb,
  -- Display preferences. UTC always in DB; render in this TZ.
  timezone text not null default 'Europe/London',
  currency text not null default 'GBP',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger workspace_settings_updated_at before update on workspace_settings
  for each row execute function set_updated_at();

alter table workspace_settings enable row level security;
create policy "workspace_settings_member_select" on workspace_settings
  for select using (is_workspace_member(workspace_id));
create policy "workspace_settings_owner_write" on workspace_settings
  for all using (
    exists (
      select 1 from memberships m
      where m.workspace_id = workspace_settings.workspace_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
        and m.status = 'active'
    )
  ) with check (
    exists (
      select 1 from memberships m
      where m.workspace_id = workspace_settings.workspace_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
        and m.status = 'active'
    )
  );

-- Auto-create a row when a workspace is created so callers can always rely
-- on the 1:1 invariant. Existing workspaces are backfilled below.
create or replace function handle_new_workspace() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into workspace_settings (workspace_id) values (new.id);
  return new;
end;
$$;
create trigger on_workspace_created
  after insert on workspaces
  for each row execute function handle_new_workspace();

insert into workspace_settings (workspace_id)
  select id from workspaces
  on conflict (workspace_id) do nothing;

-- ============================================================================
-- audit_events — append-only audit log for every server-action mutation
-- Indexed by workspace + entity for fast per-entity history reads.
-- ============================================================================
create table audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  actor_id uuid references profiles(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  before jsonb,
  after jsonb,
  metadata jsonb,
  occurred_at timestamptz not null default now()
);
create index audit_events_workspace_idx on audit_events(workspace_id, occurred_at desc);
create index audit_events_entity_idx on audit_events(entity_type, entity_id, occurred_at desc);

alter table audit_events enable row level security;
-- Members can read their workspace's audit log; nobody writes via PostgREST
-- (server actions write through the service role / withAudit helper).
create policy "audit_events_member_select" on audit_events
  for select using (is_workspace_member(workspace_id));

-- ============================================================================
-- Idempotency keys on money-touching / external-handoff entities.
-- Cheap to add now (no data); painful once rows exist.
-- ============================================================================
alter table planning_runs       add column idempotency_key uuid;
alter table booking_intents     add column idempotency_key uuid;
alter table travel_bookings     add column idempotency_key uuid;
alter table calendar_event_links add column idempotency_key uuid;

create unique index planning_runs_idempotency_unique
  on planning_runs(workspace_id, idempotency_key)
  where idempotency_key is not null;
create unique index booking_intents_idempotency_unique
  on booking_intents(workspace_id, idempotency_key)
  where idempotency_key is not null;
create unique index travel_bookings_idempotency_unique
  on travel_bookings(workspace_id, idempotency_key)
  where idempotency_key is not null;
create unique index calendar_event_links_idempotency_unique
  on calendar_event_links(workspace_id, idempotency_key)
  where idempotency_key is not null;

-- ============================================================================
-- Money columns: keep numeric for now (NUMERIC(10,2) already in 0001), but
-- add a currency code per row where money lives so the TS Money type can
-- round-trip. Default to workspace currency at write time (enforced in code).
-- ============================================================================
alter table travel_options    add column currency text not null default 'GBP';
alter table booking_intents   add column currency text not null default 'GBP';
alter table travel_bookings   add column currency text not null default 'GBP';
-- expense_records already has currency from 0001.
-- journey_leg_alternatives.cost_estimate doesn't need one for v1 (display only).
