-- Store the Google-encoded polyline returned by Directions API on each
-- travel_options row. Optional — only populated for drive options when
-- Google Maps is connected. Used by the visit-detail map to draw the real
-- route shape rather than a straight line.

alter table travel_options add column overview_polyline text;
