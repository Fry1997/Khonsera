-- 0056 — Pastimes multiplayer foundation. Two layers:
--   (1) player_connections — link two people you KNOW (not matchmaking). You pair
--       once via a short shareable connect code; thereafter either can invite the
--       other to a game. (e.g. a couple connect, then play across the carriage.)
--   (2) game_rooms — a durable table for a 2-player game (Gin Rummy first). The
--       game STATE lives server-side (jsonb) so a dropped signal means rejoin-and-
--       resume, not a lost game. Clients READ their room (RLS → Realtime); all
--       state MUTATIONS go through validated server actions (the TS engine can't run
--       in Postgres), so the move rules can't be bypassed by a direct client write.

-- ── Connect code — a short, shareable handle so people you know can pair ──────
alter table profiles add column if not exists connect_code text;
update profiles set connect_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  where connect_code is null;
alter table profiles alter column connect_code set default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
create unique index if not exists profiles_connect_code_idx on profiles(connect_code);

-- ── Connections ──────────────────────────────────────────────────────────────
create table if not exists player_connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint player_connections_distinct check (requester_id <> addressee_id),
  constraint player_connections_pair unique (requester_id, addressee_id)
);
create index player_connections_addressee_idx on player_connections(addressee_id);
create index player_connections_requester_idx on player_connections(requester_id);

alter table player_connections enable row level security;
-- Either party can see + manage the connection; only the requester creates it.
create policy pc_select on player_connections for select
  using (requester_id = auth.uid() or addressee_id = auth.uid());
create policy pc_insert on player_connections for insert
  with check (requester_id = auth.uid());
create policy pc_update on player_connections for update
  using (requester_id = auth.uid() or addressee_id = auth.uid())
  with check (requester_id = auth.uid() or addressee_id = auth.uid());
create policy pc_delete on player_connections for delete
  using (requester_id = auth.uid() or addressee_id = auth.uid());

-- Pair by code, without exposing the profiles table. Creates a pending request
-- from the caller to the code's owner (idempotent if already linked either way).
create or replace function public.request_connection(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare target uuid; existing uuid;
begin
  select id into target from profiles where connect_code = upper(trim(p_code));
  if target is null then raise exception 'No one uses that code'; end if;
  if target = auth.uid() then raise exception 'That is your own code'; end if;
  select id into existing from player_connections
   where (requester_id = auth.uid() and addressee_id = target)
      or (requester_id = target and addressee_id = auth.uid());
  if existing is not null then return existing; end if;
  insert into player_connections (requester_id, addressee_id)
    values (auth.uid(), target) returning id into existing;
  return existing;
end; $$;
grant execute on function public.request_connection(text) to authenticated;

-- The caller's connections + the OTHER party's name (profiles is otherwise private).
-- Returns direction so the UI can show "accept" only on incoming pending requests.
create or replace function public.list_player_connections()
returns table(
  connection_id uuid, other_id uuid, other_name text, status text,
  incoming boolean, created_at timestamptz
) language sql security definer set search_path = public stable as $$
  select c.id,
         case when c.requester_id = auth.uid() then c.addressee_id else c.requester_id end,
         p.full_name,
         c.status,
         (c.addressee_id = auth.uid() and c.status = 'pending'),
         c.created_at
  from player_connections c
  join profiles p on p.id = (case when c.requester_id = auth.uid() then c.addressee_id else c.requester_id end)
  where c.requester_id = auth.uid() or c.addressee_id = auth.uid()
  order by c.created_at desc;
$$;
grant execute on function public.list_player_connections() to authenticated;

-- ── Game rooms ───────────────────────────────────────────────────────────────
create table if not exists game_rooms (
  id uuid primary key default gen_random_uuid(),
  game text not null default 'gin_rummy',
  host_id uuid not null references auth.users(id) on delete cascade,
  guest_id uuid references auth.users(id) on delete set null,
  status text not null default 'lobby' check (status in ('lobby', 'active', 'finished', 'abandoned')),
  state jsonb,            -- the serialised engine state (server-authoritative)
  turn_id uuid,           -- whose move it is (null off-turn states)
  seed text not null default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index game_rooms_host_idx on game_rooms(host_id);
create index game_rooms_guest_idx on game_rooms(guest_id);
create index game_rooms_guest_open_idx on game_rooms(guest_id, status);

alter table game_rooms enable row level security;
-- Only the two seated players can READ the room (this also gates Realtime).
create policy gr_select on game_rooms for select
  using (host_id = auth.uid() or guest_id = auth.uid());
-- A host opens a table and may only invite an ACCEPTED connection (or leave it open).
create policy gr_insert on game_rooms for insert with check (
  host_id = auth.uid() and (
    guest_id is null or exists (
      select 1 from player_connections c where c.status = 'accepted' and (
        (c.requester_id = auth.uid() and c.addressee_id = guest_id) or
        (c.requester_id = guest_id and c.addressee_id = auth.uid())
      )
    )
  )
);
-- Clients never write game state directly (that goes through validated server
-- actions using the service role). The only client-side update permitted is a
-- player abandoning the table (status -> abandoned); state/turn stay read-only here.
create policy gr_update on game_rooms for update
  using (host_id = auth.uid() or guest_id = auth.uid())
  with check (host_id = auth.uid() or guest_id = auth.uid());
create policy gr_delete on game_rooms for delete using (host_id = auth.uid());

-- Integrity guard: the game state is server-authoritative. A player's own client
-- (role 'authenticated', via RLS) may ONLY abandon the table; the deck, turn, seed,
-- seats and game are immutable to it. Validated server actions use the service role
-- (which runs the TS engine) and bypass this — so move legality can't be forged by a
-- crafted client write straight to Postgres.
create or replace function public.game_rooms_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'service_role' then return new; end if;
  if new.state is distinct from old.state
     or new.turn_id is distinct from old.turn_id
     or new.seed is distinct from old.seed
     or new.host_id is distinct from old.host_id
     or new.guest_id is distinct from old.guest_id
     or new.game is distinct from old.game then
    raise exception 'game state is server-authoritative';
  end if;
  if new.status is distinct from old.status and new.status <> 'abandoned' then
    raise exception 'players may only abandon the table';
  end if;
  return new;
end; $$;
create trigger game_rooms_guard_trg before update on game_rooms
  for each row execute function public.game_rooms_guard();

-- Realtime: both players subscribe to their room row for live move sync.
alter publication supabase_realtime add table game_rooms;
