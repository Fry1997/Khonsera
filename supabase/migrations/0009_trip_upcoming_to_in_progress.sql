-- Allow a confirmed trip to be marked "in progress" without a separate
-- intermediate "ready" hop. Useful in v1 where there's no automated
-- "day-of" trigger that flips upcoming -> ready.

insert into saved_trip_edges (from_status, to_status)
values ('upcoming', 'in_progress')
on conflict do nothing;
