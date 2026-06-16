-- Recurring events (2026-06-16): a recurring COMMITMENT, not a recurring booking.
-- A rule generates the event only (its weekday/time/place); transport is added per
-- occurrence. Lazy materialisation creates real days ~8 weeks ahead. Owner-only.
create table if not exists public.recurring_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  location_id uuid references public.locations(id) on delete set null,
  weekday smallint not null check (weekday between 0 and 6), -- 0=Sun .. 6=Sat (JS getDay)
  start_time text not null default '09:00',                  -- HH:MM, local
  duration_minutes integer not null default 480,
  mode app_mode not null default 'work',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists recurring_events_user_idx on public.recurring_events(user_id);
alter table public.recurring_events enable row level security;
create policy recurring_events_owner on public.recurring_events for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.itineraries
  add column if not exists recurring_event_id uuid references public.recurring_events(id) on delete set null;
create index if not exists itineraries_recurring_idx on public.itineraries(recurring_event_id);
