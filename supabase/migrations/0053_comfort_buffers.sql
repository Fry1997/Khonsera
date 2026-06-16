-- 0053 — Comfort buffers, by what you're catching.
--
-- A buffer isn't one number: an airport wants check-in + security time, a
-- national-rail platform wants a few minutes, a customer meeting wants a polite
-- early arrival, a tube change wants barely any. `default_arrival_buffer_minutes`
-- (mig 0001) already carried the rail/station dial. Add two more so the three
-- comfort levels the day actually needs are user-tunable in Travel profile.
--
-- The solver applies these as an EARLIER leave (not a longer leg) so they read
-- as slack; feasibility uses the same number as its "comfortable" threshold, so
-- a route the solver builds for you never warns about the slack it just gave you.

alter table travel_profiles
  add column if not exists default_airport_buffer_minutes integer not null default 90,
  add column if not exists default_meeting_buffer_minutes integer not null default 10;

comment on column travel_profiles.default_arrival_buffer_minutes is
  'Comfort buffer (minutes) for boarding national rail — how early to be on the platform.';
comment on column travel_profiles.default_airport_buffer_minutes is
  'Comfort buffer (minutes) for a flight — check-in + security before departure.';
comment on column travel_profiles.default_meeting_buffer_minutes is
  'Comfort buffer (minutes) for an appointment or event — arrive a touch early.';
