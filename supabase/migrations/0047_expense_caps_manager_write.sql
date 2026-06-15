-- SECURITY (deep audit D64): expense_caps (travel-policy per-diems) were app-gated
-- to managers via requireManager(), but the RLS write policy allowed ANY workspace
-- member to insert/update/delete caps directly via the REST API — a traveller could
-- raise their own cap. Add an is_workspace_manager() helper mirroring is_workspace_member
-- (manager tier = company_admin/team_manager/owner/admin, matching MANAGER_ROLES in
-- src/lib/auth.ts) and gate writes with it. Members keep SELECT (they read the policy).

create or replace function public.is_workspace_manager(ws uuid)
returns boolean
language sql stable security definer
set search_path to 'public'
set row_security to 'off'
as $$
  select exists (
    select 1 from memberships
    where workspace_id = ws and user_id = auth.uid() and status = 'active'
      and role::text in ('company_admin','team_manager','owner','admin')
  );
$$;
revoke execute on function public.is_workspace_manager(uuid) from anon;

drop policy if exists expense_caps_member_write on public.expense_caps;
create policy expense_caps_manager_write on public.expense_caps
  for all using (is_workspace_manager(workspace_id)) with check (is_workspace_manager(workspace_id));
