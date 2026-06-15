-- 0040 — Per-CATEGORY expense caps (P16 refinement). Real T&E policy caps by type
-- (a food/meal cap, a hotel cap…), often per-day (per-diem). A workspace travel
-- policy: managers set it once, it applies to every work trip's budget.
create type cap_period as enum ('per_day', 'per_trip');

create table if not exists expense_caps (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  expense_type expense_type not null,
  period cap_period not null default 'per_trip',
  amount numeric(10,2) not null,
  currency text not null default 'GBP',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, expense_type)
);
create index expense_caps_ws_idx on expense_caps(workspace_id);
create trigger expense_caps_updated_at before update on expense_caps for each row execute function set_updated_at();

alter table expense_caps enable row level security;
-- Workspace members read the policy; writes happen via a manager-gated server action.
create policy expense_caps_member_select on expense_caps for select using (is_workspace_member(workspace_id));
create policy expense_caps_member_write on expense_caps for all using (is_workspace_member(workspace_id)) with check (is_workspace_member(workspace_id));
