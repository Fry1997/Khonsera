-- 0034 — Notes as a first-class entity (Edition III C13/B1, Phase 3).
-- Prep + outcome notes bound to a commitment (stop) or a day (itinerary).
-- ORG-REVIEW BOUNDARY: a workspace member may read a note ONLY when it is
-- work + outcome + org_reviewable. Personal notes and ALL prep notes are
-- owner-only. Mirrors can_access_itinerary (migration 0030) — enforced in the
-- data layer, not app code, so getting it wrong can't leak personal thinking.
-- Attachments + voice are designed in now, shipped later (no re-migration).

create type note_kind as enum ('prep', 'outcome');
create type note_visibility as enum ('private', 'org_reviewable');
create type note_source as enum ('manual', 'voice', 'template');
create type note_attachment_kind as enum ('document', 'photo', 'link');

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  mode app_mode not null default 'personal',
  itinerary_id uuid references itineraries(id) on delete cascade,
  stop_id uuid references stops(id) on delete cascade,
  note_date date,
  kind note_kind not null default 'prep',
  title text,
  body text,
  checklist jsonb not null default '[]'::jsonb,
  action_items jsonb not null default '[]'::jsonb,
  visibility note_visibility not null default 'private',
  source note_source not null default 'manual',
  template_key text,
  transcript text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notes_target_chk check (itinerary_id is not null or stop_id is not null)
);
create index notes_itinerary_idx on notes(itinerary_id);
create index notes_stop_idx on notes(stop_id);
create index notes_user_idx on notes(user_id);
create trigger notes_updated_at before update on notes
  for each row execute function set_updated_at();

create table if not exists note_attachments (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references notes(id) on delete cascade,
  kind note_attachment_kind not null default 'document',
  storage_path text,
  url text,
  filename text,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);
create index note_attachments_note_idx on note_attachments(note_id);

alter table notes enable row level security;
alter table note_attachments enable row level security;

-- The org-review boundary, in one line: owner always; a workspace member only
-- for work + outcome + org_reviewable notes.
create policy notes_select on notes for select using (
  user_id = auth.uid()
  or (mode = 'work' and kind = 'outcome' and visibility = 'org_reviewable'
      and is_workspace_member(workspace_id))
);
create policy notes_insert on notes for insert with check (user_id = auth.uid());
create policy notes_update on notes for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notes_delete on notes for delete using (user_id = auth.uid());

-- Attachments inherit their note's read; only the owner writes.
create policy note_attachments_select on note_attachments for select using (
  exists (
    select 1 from notes n where n.id = note_attachments.note_id and (
      n.user_id = auth.uid()
      or (n.mode = 'work' and n.kind = 'outcome' and n.visibility = 'org_reviewable'
          and is_workspace_member(n.workspace_id))
    )
  )
);
create policy note_attachments_write on note_attachments for all using (
  exists (select 1 from notes n where n.id = note_attachments.note_id and n.user_id = auth.uid())
) with check (
  exists (select 1 from notes n where n.id = note_attachments.note_id and n.user_id = auth.uid())
);
