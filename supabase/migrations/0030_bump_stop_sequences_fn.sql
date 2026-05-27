CREATE OR REPLACE FUNCTION bump_stop_sequences(
  p_itinerary_id uuid,
  p_workspace_id uuid,
  p_from_sequence integer
) RETURNS void AS $$
BEGIN
  UPDATE stops
  SET sequence = sequence + 1
  WHERE itinerary_id = p_itinerary_id
    AND workspace_id = p_workspace_id
    AND sequence >= p_from_sequence
  ;
END;
$$ LANGUAGE plpgsql;
