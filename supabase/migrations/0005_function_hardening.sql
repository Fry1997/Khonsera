-- Layer 1-2 advisor follow-up. Two classes of fix:
--   (a) Pin search_path on the two trigger functions still missing it.
--       Pinned search_path is a defense-in-depth measure for SECURITY
--       DEFINER-adjacent code paths.
--   (b) Revoke REST-callable EXECUTE on the SECURITY DEFINER functions
--       that PostgREST otherwise exposes at /rpc/<name>:
--         - handle_new_user / handle_new_workspace are trigger-only and
--           should never be REST-callable. Revoke from PUBLIC, anon,
--           authenticated, service_role.
--         - visit_plan_transition / saved_trip_transition are called
--           from server actions as authenticated users — keep authenticated,
--           revoke from anon and PUBLIC.
--         - is_workspace_member is used inside RLS USING() clauses; needs
--           to remain callable by anon (anonymous queries running against
--           RLS-protected tables invoke it). Returns false for auth.uid()
--           is null, so REST-callable is safe. Left as-is.

alter function public.set_updated_at()                set search_path = public;
alter function public.block_direct_status_update()    set search_path = public;

revoke execute on function public.handle_new_user()        from public, anon, authenticated, service_role;
revoke execute on function public.handle_new_workspace()   from public, anon, authenticated, service_role;

revoke execute on function public.visit_plan_transition(uuid, visit_status, uuid, jsonb) from public, anon;
revoke execute on function public.saved_trip_transition(uuid, saved_trip_status, uuid, jsonb) from public, anon;
