-- 0041 — Two-tier sharing (Phase 18). LIVE LOCATION is a PERSONAL gift only: opt-in,
-- to a named recipient, time-bounded, revocable. The employer tier never gets
-- location (only status + ETA, via the existing work-itinerary RLS) — there is no
-- path here that shares coordinates to a workspace.
--
-- The share table is OWNER-ONLY (the traveller manages their shares). The recipient
-- views via a secret token on a PUBLIC page, through a SECURITY DEFINER function that
-- returns ONLY the position + label, and ONLY while the share is active. No other
-- row, no PII beyond the chosen recipient label + the live point.

create table if not exists location_shares (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  user_id uuid not null references auth.users(id) on delete cascade,
  itinerary_id uuid references itineraries(id) on delete set null,
  recipient_label text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_lat double precision,
  last_lng double precision,
  last_at timestamptz,
  created_at timestamptz not null default now()
);
create index location_shares_user_idx on location_shares(user_id);

alter table location_shares enable row level security;
-- Owner-only management. The recipient does NOT read the table directly.
create policy location_shares_owner on location_shares for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- The only public surface: position + label, ONLY while active. Anon-callable.
create or replace function public.share_position(p_token text)
returns table(recipient_label text, lat double precision, lng double precision, at timestamptz, active boolean)
language sql security definer set search_path = public stable as $$
  select s.recipient_label,
         case when s.revoked_at is null and s.expires_at > now() then s.last_lat end,
         case when s.revoked_at is null and s.expires_at > now() then s.last_lng end,
         case when s.revoked_at is null and s.expires_at > now() then s.last_at end,
         (s.revoked_at is null and s.expires_at > now()) as active
  from location_shares s where s.token = p_token;
$$;
grant execute on function public.share_position(text) to anon, authenticated;
