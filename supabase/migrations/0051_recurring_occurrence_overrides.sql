-- When a recurring occurrence lands on a date you ALREADY have a plan, we don't
-- silently skip it — we OFFER to add the event to that day. This records your
-- decision per (rule, date) so the offer doesn't keep re-appearing: 'merged' (you
-- added it to the existing day) or 'skip' (not this one). Owner-only.
create table if not exists public.recurring_occurrence_overrides (
  id uuid primary key default gen_random_uuid(),
  recurring_event_id uuid not null references public.recurring_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  occurrence_date date not null,
  action text not null check (action in ('skip','merged')),
  itinerary_id uuid references public.itineraries(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (recurring_event_id, occurrence_date)
);
create index if not exists rec_overrides_user_idx on public.recurring_occurrence_overrides(user_id);
alter table public.recurring_occurrence_overrides enable row level security;
create policy rec_overrides_owner on public.recurring_occurrence_overrides for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
