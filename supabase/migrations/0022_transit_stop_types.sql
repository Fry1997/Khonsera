-- Add transit_departure and transit_changeover to stop_type enum.
-- Transport booking stops were using 'appointment' which caused them
-- to render as editable anchors showing "(no place yet)" instead of
-- being recognized as transit stops by the planning page.
alter type stop_type add value if not exists 'transit_departure';
alter type stop_type add value if not exists 'transit_changeover';
