-- User-authored prep items (2026-06-16): the readiness list was 100% auto-derived;
-- you couldn't add your own "remember the charger". Owner-only (prep is personal).
create table if not exists public.readiness_items (
  id uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null references public.itineraries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  label text not null,
  status readiness_status not null default 'open',
  created_at timestamptz not null default now()
);
create index if not exists readiness_items_itin_idx on public.readiness_items(itinerary_id);
alter table public.readiness_items enable row level security;
create policy readiness_items_owner on public.readiness_items for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
