-- SECURITY (deep audit D64 follow-up): contacts had a `mode` column but NO owner
-- column, so a PERSONAL-mode contact was visible to the whole workspace with no
-- way to scope it to its owner. Add user_id, backfill from the workspace owner,
-- and gate: personal contacts → owner-only; work contacts → workspace-shared CRM.

alter table public.contacts add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- Backfill existing rows to their workspace's owner (prefer owner/admin membership).
update public.contacts c set user_id = (
  select m.user_id from public.memberships m
  where m.workspace_id = c.workspace_id
  order by (m.role::text = 'owner') desc, (m.role::text = 'company_admin') desc, m.created_at
  limit 1
) where c.user_id is null;

create index if not exists contacts_user_idx on public.contacts(user_id);

-- Replace the broad pre-Mode policies.
drop policy if exists contacts_member_select on public.contacts;
drop policy if exists contacts_member_insert on public.contacts;
drop policy if exists contacts_member_update on public.contacts;
drop policy if exists contacts_member_delete on public.contacts;

-- Personal contacts: owner-only. Work contacts: shared with the workspace (CRM).
create policy contacts_select on public.contacts for select using (
  user_id = auth.uid() or (mode = 'work' and is_workspace_member(workspace_id))
);
create policy contacts_insert on public.contacts for insert with check (
  user_id = auth.uid() and is_workspace_member(workspace_id)
);
create policy contacts_update on public.contacts for update using (
  user_id = auth.uid() or (mode = 'work' and is_workspace_member(workspace_id))
) with check (
  user_id = auth.uid() or (mode = 'work' and is_workspace_member(workspace_id))
);
create policy contacts_delete on public.contacts for delete using (
  user_id = auth.uid() or (mode = 'work' and is_workspace_member(workspace_id))
);
