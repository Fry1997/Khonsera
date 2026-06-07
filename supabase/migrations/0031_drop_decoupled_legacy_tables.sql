-- 0031_drop_decoupled_legacy_tables.sql
-- Foundation strip (authorised: pre-alpha, no CRM/legacy data to preserve).
-- Drops ONLY the legacy tables with zero application-code references — the
-- field-sales "visit" CRM, the unused saved-trips feature, and dead planning-
-- engine tables. Verified no kept table depends on these except
-- journey_legs.travel_option_id (an orphaned column, dropped here too).
--
-- DELIBERATELY KEPT (load-bearing, not a blind drop):
--   * customers / customer_sites  — woven through capture/place/stops (40+ files);
--     these migrate to the new place/contact model in the screen-reshape work.
--   * journey_legs                — active resolved-leg persistence (planning page).

-- Visit CRM ------------------------------------------------------------------
drop table if exists visit_checklist_items cascade;
drop table if exists visit_status_edges cascade;
drop table if exists visit_plans cascade;

-- Unused saved-trips feature -------------------------------------------------
drop table if exists saved_trip_edges cascade;
drop table if exists saved_trips cascade;

-- Dead planning-engine tables ------------------------------------------------
drop table if exists journey_leg_alternatives cascade;
drop table if exists trip_progress cascade;
drop table if exists planning_runs cascade;

-- travel_options: orphan the FK column on the kept journey_legs, then drop.
alter table journey_legs drop column if exists travel_option_id;
drop table if exists travel_options cascade;
