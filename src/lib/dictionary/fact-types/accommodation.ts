import type { FactTypeSchema } from "../types";

// Accommodation is a CONSTRAINT, not a fixed journey point (check-in-from /
// check-out-by). It lands as an accommodation stop plus an optional booking; the
// user places hotel-visit stops on the timeline as needed.
export const accommodation: FactTypeSchema = {
  factType: "accommodation",
  shape: "dated_event",
  conceptWords: ["hotel", "stay", "airbnb", "premier inn", "travelodge", "b&b"],
  targets: [
    { table: "stops", as: "accommodation", note: "check-in-from / check-out-by constraint" },
    { table: "travel_bookings", note: "optional: provider, ref, price" },
  ],
  slots: [
    {
      key: "place",
      label: "Hotel",
      dataType: "place",
      tier: "essential_to_work",
      resolvesTo: "locations",
      elicitationPrompt: "Where are you staying?",
      dbMapping: "stops.location_id",
    },
    {
      key: "check_in_from",
      label: "Check-in from",
      dataType: "datetime",
      tier: "essential_to_work",
      elicitationPrompt: "Which night does it start?",
      dbMapping: "stops.start_time",
    },
    {
      key: "check_out_by",
      label: "Check-out by",
      dataType: "datetime",
      tier: "essential_to_work",
      dbMapping: "stops.end_time",
    },
    {
      key: "booking_reference",
      label: "Booking ref",
      dataType: "text",
      tier: "essential_to_use",
      dbMapping: "travel_bookings.booking_reference",
    },
    {
      key: "provider",
      label: "Provider",
      dataType: "text",
      tier: "nice_to_have",
      dbMapping: "travel_bookings.provider",
    },
    {
      key: "room",
      label: "Room",
      dataType: "text",
      tier: "nice_to_have",
      dbMapping: "stops.notes",
    },
    {
      key: "price",
      label: "Price",
      dataType: "money",
      tier: "nice_to_have",
      dbMapping: "travel_bookings.actual_price / currency",
    },
  ],
  validations: ["check_in_from must be before check_out_by"],
};
