-- 0033_waitlist.sql
-- Public landing-page waitlist (landing+waitlist brief §4). A lightweight
-- interest-capture list — NOT an account, NOT identity. No link to profiles
-- or workspaces; a logged-out visitor (anon role) can insert their email.
--
-- Privacy posture: anyone may INSERT (the public signup), but NOBODY may
-- SELECT via the API (the list is private). Duplicate detection therefore
-- relies on the unique index surfacing a 23505 conflict to the server action,
-- never a read.

create table if not exists public.waitlist (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  name        text,
  source      text,            -- optional referral / UTM source string
  created_at  timestamptz not null default now()
);

-- Case-insensitive uniqueness: "Me@x.com" and "me@x.com" are one signup.
create unique index if not exists waitlist_email_lower_idx
  on public.waitlist (lower(email));

alter table public.waitlist enable row level security;

-- Anyone (anon or authenticated) may join the list.
drop policy if exists "waitlist insert (public)" on public.waitlist;
create policy "waitlist insert (public)"
  on public.waitlist
  for insert
  to anon, authenticated
  with check (true);

-- No SELECT / UPDATE / DELETE policies: the list is not readable through the
-- API. Administration happens via the service role / dashboard only.
