-- SECURITY (continues 0043): sweep the remaining stale 0010 `*_member_*` policies
-- that exposed personal/private data to any workspace member. Each table gets the
-- correct boundary: user-scoped private tables → owner-only; itinerary-scoped
-- tables → can_access_itinerary (owner OR work-mode member); expense writes →
-- owner (+ work-mode member for the manager-review update path).

-- ── TIER 1: user-scoped PRIVATE tables → owner-only (user_id = auth.uid()) ──
drop policy if exists calendar_connections_member_select on public.calendar_connections;
drop policy if exists calendar_connections_member_insert on public.calendar_connections;
drop policy if exists calendar_connections_member_update on public.calendar_connections;
drop policy if exists calendar_connections_member_delete on public.calendar_connections;
create policy calendar_connections_owner on public.calendar_connections
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists captured_inputs_member_select on public.captured_inputs;
drop policy if exists captured_inputs_member_insert on public.captured_inputs;
drop policy if exists captured_inputs_member_update on public.captured_inputs;
drop policy if exists captured_inputs_member_delete on public.captured_inputs;
create policy captured_inputs_owner on public.captured_inputs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists intents_member_select on public.intents;
drop policy if exists intents_member_insert on public.intents;
drop policy if exists intents_member_update on public.intents;
drop policy if exists intents_member_delete on public.intents;
create policy intents_owner on public.intents
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists standing_facts_member_select on public.standing_facts;
drop policy if exists standing_facts_member_insert on public.standing_facts;
drop policy if exists standing_facts_member_update on public.standing_facts;
drop policy if exists standing_facts_member_delete on public.standing_facts;
create policy standing_facts_owner on public.standing_facts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists travel_profiles_member_select on public.travel_profiles;
drop policy if exists travel_profiles_member_insert on public.travel_profiles;
drop policy if exists travel_profiles_member_update on public.travel_profiles;
drop policy if exists travel_profiles_member_delete on public.travel_profiles;
create policy travel_profiles_owner on public.travel_profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- gmail: insert/update/delete were already (user_id AND member); only SELECT leaked.
drop policy if exists gmail_connections_select on public.gmail_connections;
create policy gmail_connections_select on public.gmail_connections
  for select using (user_id = auth.uid());

drop policy if exists gmail_imported_select on public.gmail_imported_messages;
create policy gmail_imported_select on public.gmail_imported_messages
  for select using (user_id = auth.uid());

drop policy if exists gmail_scanned_emails_member_select on public.gmail_scanned_emails;
drop policy if exists gmail_scanned_emails_member_insert on public.gmail_scanned_emails;
drop policy if exists gmail_scanned_emails_member_update on public.gmail_scanned_emails;
drop policy if exists gmail_scanned_emails_member_delete on public.gmail_scanned_emails;
create policy gmail_scanned_emails_owner on public.gmail_scanned_emails
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── TIER 2: itinerary-scoped → can_access_itinerary(itinerary_id) ──
drop policy if exists booking_intents_member_select on public.booking_intents;
drop policy if exists booking_intents_member_insert on public.booking_intents;
drop policy if exists booking_intents_member_update on public.booking_intents;
drop policy if exists booking_intents_member_delete on public.booking_intents;
create policy booking_intents_access on public.booking_intents
  for all using (can_access_itinerary(itinerary_id)) with check (can_access_itinerary(itinerary_id));

drop policy if exists calendar_event_links_member_select on public.calendar_event_links;
drop policy if exists calendar_event_links_member_insert on public.calendar_event_links;
drop policy if exists calendar_event_links_member_update on public.calendar_event_links;
drop policy if exists calendar_event_links_member_delete on public.calendar_event_links;
create policy calendar_event_links_access on public.calendar_event_links
  for all using (can_access_itinerary(itinerary_id)) with check (can_access_itinerary(itinerary_id));

drop policy if exists notification_rules_member_select on public.notification_rules;
drop policy if exists notification_rules_member_insert on public.notification_rules;
drop policy if exists notification_rules_member_update on public.notification_rules;
drop policy if exists notification_rules_member_delete on public.notification_rules;
create policy notification_rules_access on public.notification_rules
  for all using (can_access_itinerary(itinerary_id)) with check (can_access_itinerary(itinerary_id));

drop policy if exists stopovers_member_select on public.stopovers;
drop policy if exists stopovers_member_insert on public.stopovers;
drop policy if exists stopovers_member_update on public.stopovers;
drop policy if exists stopovers_member_delete on public.stopovers;
create policy stopovers_access on public.stopovers
  for all using (can_access_itinerary(itinerary_id)) with check (can_access_itinerary(itinerary_id));

-- ── TIER 3: expense write-side (SELECT already tightened in 0039) ──
drop policy if exists expense_records_member_insert on public.expense_records;
drop policy if exists expense_records_member_update on public.expense_records;
drop policy if exists expense_records_member_delete on public.expense_records;
create policy expense_records_insert on public.expense_records
  for insert with check (user_id = auth.uid());
create policy expense_records_update on public.expense_records
  for update using (
    user_id = auth.uid() or exists (
      select 1 from itineraries i
      where i.id = expense_records.itinerary_id and i.mode = 'work' and is_workspace_member(i.workspace_id))
  ) with check (
    user_id = auth.uid() or exists (
      select 1 from itineraries i
      where i.id = expense_records.itinerary_id and i.mode = 'work' and is_workspace_member(i.workspace_id))
  );
create policy expense_records_delete on public.expense_records
  for delete using (user_id = auth.uid());

drop policy if exists mileage_expenses_member_insert on public.mileage_expenses;
drop policy if exists mileage_expenses_member_update on public.mileage_expenses;
drop policy if exists mileage_expenses_member_delete on public.mileage_expenses;
create policy mileage_expenses_write on public.mileage_expenses
  for all using (
    exists (select 1 from expense_records e where e.id = mileage_expenses.expense_record_id and e.user_id = auth.uid())
  ) with check (
    exists (select 1 from expense_records e where e.id = mileage_expenses.expense_record_id and e.user_id = auth.uid())
  );
