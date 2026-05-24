-- Gmail connections: separate from calendar_connections so users can
-- independently connect/disconnect Gmail vs Google Calendar. Same
-- OAuth client credentials, different scopes.

create table gmail_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  provider_account_email text,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  status text not null default 'active',
  last_scan_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, workspace_id)
);

alter table gmail_connections enable row level security;

create policy "gmail_connections_select" on gmail_connections
  for select using (is_workspace_member(workspace_id));

create policy "gmail_connections_insert" on gmail_connections
  for insert with check (
    user_id = auth.uid() and is_workspace_member(workspace_id)
  );

create policy "gmail_connections_update" on gmail_connections
  for update using (
    user_id = auth.uid() and is_workspace_member(workspace_id)
  );

create policy "gmail_connections_delete" on gmail_connections
  for delete using (
    user_id = auth.uid() and is_workspace_member(workspace_id)
  );

-- Track which emails have already been imported so we don't show duplicates.
create table gmail_imported_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  gmail_message_id text not null,
  booking_type text not null,
  travel_booking_id uuid references travel_bookings(id) on delete set null,
  imported_at timestamptz not null default now(),
  unique (workspace_id, user_id, gmail_message_id)
);

alter table gmail_imported_messages enable row level security;

create policy "gmail_imported_select" on gmail_imported_messages
  for select using (is_workspace_member(workspace_id));

create policy "gmail_imported_insert" on gmail_imported_messages
  for insert with check (
    user_id = auth.uid() and is_workspace_member(workspace_id)
  );
