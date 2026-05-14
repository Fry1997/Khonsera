-- When a membership goes away (user deleted, admin removed them, or they
-- left), check whether the workspace has any active members remaining. If
-- not, delete the workspace — cascade wipes all child rows (customers,
-- visits, audit, jobs, etc.).
--
-- Rules captured here:
--   * Personal workspace where the sole user deletes their account → deleted.
--   * Shared workspace whose last active member leaves → deleted.
--   * Shared workspace with other active members → survives. The remaining
--     members keep their existing roles. We deliberately do NOT auto-
--     escalate anyone to owner/admin — manual support process for that.
--
-- The trigger is SECURITY DEFINER so it can DELETE the workspace regardless
-- of the calling user's RLS posture (the membership cascade may run under
-- service_role during auth.users deletion).

create or replace function cleanup_empty_workspace_after_membership_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from workspaces w
  where w.id = old.workspace_id
    and not exists (
      select 1 from memberships m
      where m.workspace_id = w.id and m.status = 'active'
    );
  return old;
end;
$$;

create trigger memberships_cleanup_empty_workspace
  after delete on memberships
  for each row execute function cleanup_empty_workspace_after_membership_delete();

-- Trigger functions called only from triggers should not be REST-callable.
revoke execute on function public.cleanup_empty_workspace_after_membership_delete()
  from public, anon, authenticated, service_role;
