-- Cover every foreign key with an index. Postgres uses these for cascading
-- deletes and RI checks; without them, deletes on a parent table do a
-- sequential scan of every child table. Cheap to add now while every table
-- is empty.

create index audit_events_actor_idx                       on audit_events(actor_id);
create index booking_intents_travel_option_idx            on booking_intents(travel_option_id);
create index calendar_connections_workspace_idx           on calendar_connections(workspace_id);
create index calendar_event_links_connection_idx          on calendar_event_links(calendar_connection_id);
create index expense_records_user_idx                     on expense_records(user_id);
create index journey_leg_alternatives_workspace_idx       on journey_leg_alternatives(workspace_id);
create index journey_legs_workspace_idx                   on journey_legs(workspace_id);
create index locations_user_idx                           on locations(user_id);
create index mileage_expenses_workspace_idx               on mileage_expenses(workspace_id);
create index notification_rules_workspace_idx             on notification_rules(workspace_id);
create index profiles_default_workspace_idx               on profiles(default_workspace_id);
create index saved_trips_selected_option_idx              on saved_trips(selected_travel_option_id);
create index travel_options_workspace_idx                 on travel_options(workspace_id);
create index travel_profiles_workspace_idx                on travel_profiles(workspace_id);
create index travel_profiles_drive_origin_idx             on travel_profiles(default_drive_origin_location_id);
create index travel_profiles_rail_origin_idx              on travel_profiles(default_rail_origin_location_id);
create index travel_profiles_return_location_idx          on travel_profiles(default_return_location_id);
create index trip_progress_workspace_idx                  on trip_progress(workspace_id);
create index trip_progress_current_leg_idx                on trip_progress(current_leg_id);
create index visit_checklist_items_workspace_idx          on visit_checklist_items(workspace_id);
create index visit_plans_contact_idx                      on visit_plans(contact_id);
create index visit_plans_customer_idx                     on visit_plans(customer_id);
create index visit_plans_customer_site_idx                on visit_plans(customer_site_id);
create index visit_plans_return_location_idx              on visit_plans(return_location_id);
create index visit_plans_start_location_idx               on visit_plans(start_location_id);
create index workspaces_created_by_idx                    on workspaces(created_by);
