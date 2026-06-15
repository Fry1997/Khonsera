-- 0039 — Privacy hardening (P17 prep): expense_records was workspace-readable by
-- ANY member (is_workspace_member), which would expose a PERSONAL-trip expense
-- (it still carries workspace_id) to the workspace. Tighten SELECT to mirror the
-- itinerary boundary: you see your OWN expenses always; the workspace sees only
-- WORK-mode-trip expenses. Personal-trip + un-tripped expenses stay owner-only.
drop policy if exists "expense_records_member_select" on expense_records;
create policy expense_records_select on expense_records for select using (
  user_id = auth.uid()
  or exists (
    select 1 from itineraries i
    where i.id = expense_records.itinerary_id
      and i.mode = 'work'
      and is_workspace_member(i.workspace_id)
  )
);

-- Same fix for mileage_expenses (joined via the expense record).
drop policy if exists "mileage_expenses_member_select" on mileage_expenses;
create policy mileage_expenses_select on mileage_expenses for select using (
  exists (
    select 1 from expense_records e
    where e.id = mileage_expenses.expense_record_id
      and ( e.user_id = auth.uid()
            or exists (select 1 from itineraries i where i.id = e.itinerary_id and i.mode = 'work' and is_workspace_member(i.workspace_id)) )
  )
);
