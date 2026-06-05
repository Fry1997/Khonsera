import type { FactTypeMapping } from "../types";

// Accommodation is a CONSTRAINT (check-in-from / check-out-by), not a fixed
// journey point. It lands as an accommodation stop spanning the stay, plus an
// optional booking. Concept words + slots come from the YAML.
export const accommodationBooking: FactTypeMapping = {
  factType: "accommodation_booking",
  shape: "dated_event",
  targets: [
    { table: "stops", as: "accommodation", note: "stay span = check-in..check-out" },
    { table: "travel_bookings", note: "optional: provider, ref, price" },
  ],
  slotMeta: {
    place: { dataType: "place", resolvesTo: "locations", placePref: "event", dbMapping: "stops.location_id" },
    check_in_date: { dataType: "date", dbMapping: "date portion of stops.start_time" },
    check_out_date: { dataType: "date", dbMapping: "date portion of stops.end_time" },
    check_in_time: { dataType: "time" },
    check_out_time: { dataType: "time" },
    hotel_name: { dataType: "text" },
    booking_ref: { tier: "essential_to_use", dataType: "text", dbMapping: "travel_bookings.booking_reference" },
    guests: { dataType: "party_size" },
    price: { dataType: "money", dbMapping: "travel_bookings.actual_price" },
    room_type: { dataType: "text", dbMapping: "stops.notes" },
  },
  validations: ["check_in_date must be on or before check_out_date"],
};

export const accommodationMappings: FactTypeMapping[] = [accommodationBooking];
