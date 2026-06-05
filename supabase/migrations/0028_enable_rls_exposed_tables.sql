-- Security fix: enable RLS on four tables currently exposed to the anon key.
-- Flagged ERROR-level by the Supabase advisor (rls_disabled_in_public).
--
-- Write paths verified against the codebase:
--   - gmail_scanned_emails : user data, written by Gmail scan (authenticated, workspace-scoped)
--   - rail_network_edges / rail_named_route_segments : admin-seeded reference data
--     (seedRailEdges/clearRailNetwork run as the authenticated session, gated by ctx.isAdmin)
--   - rail_route_cache : server-action L1 cache, upserted as the authenticated session on miss

-- ============================================================================
-- gmail_scanned_emails — user data, scope by workspace membership (matches gmail_connections)
-- ============================================================================
alter table gmail_scanned_emails enable row level security;

create policy "gmail_scanned_emails_member_select" on gmail_scanned_emails
  for select using (is_workspace_member(workspace_id));
create policy "gmail_scanned_emails_member_insert" on gmail_scanned_emails
  for insert with check (is_workspace_member(workspace_id));
create policy "gmail_scanned_emails_member_update" on gmail_scanned_emails
  for update using (is_workspace_member(workspace_id))
  with check (is_workspace_member(workspace_id));
create policy "gmail_scanned_emails_member_delete" on gmail_scanned_emails
  for delete using (is_workspace_member(workspace_id));

-- ============================================================================
-- rail_network_edges / rail_named_route_segments — reference data.
-- All authenticated users may read; only admins may write (mirrors the in-app
-- ctx.isAdmin gate on seedRailEdges/clearRailNetwork).
-- ============================================================================
alter table rail_network_edges        enable row level security;
alter table rail_named_route_segments enable row level security;

do $$
declare t text;
  tables text[] := array['rail_network_edges', 'rail_named_route_segments'];
begin
  foreach t in array tables loop
    execute format($f$
      create policy "%1$s_authenticated_select" on %1$s
        for select to authenticated using (true);
      create policy "%1$s_admin_insert" on %1$s
        for insert to authenticated
        with check (exists (select 1 from profiles where id = auth.uid() and is_admin));
      create policy "%1$s_admin_update" on %1$s
        for update to authenticated
        using (exists (select 1 from profiles where id = auth.uid() and is_admin))
        with check (exists (select 1 from profiles where id = auth.uid() and is_admin));
      create policy "%1$s_admin_delete" on %1$s
        for delete to authenticated
        using (exists (select 1 from profiles where id = auth.uid() and is_admin));
    $f$, t);
  end loop;
end$$;

-- ============================================================================
-- rail_route_cache — derived cache, read + upserted by authenticated server actions.
-- ============================================================================
alter table rail_route_cache enable row level security;

create policy "rail_route_cache_authenticated_select" on rail_route_cache
  for select to authenticated using (true);
create policy "rail_route_cache_authenticated_insert" on rail_route_cache
  for insert to authenticated with check (true);
create policy "rail_route_cache_authenticated_update" on rail_route_cache
  for update to authenticated using (true) with check (true);
