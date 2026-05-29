import type { FactTypeSchema } from "../types";

// A train journey. In the existing schema this is NOT a single row: it becomes a
// travel_booking + one travel_booking_segment per leg + locked transitions +
// transit_departure / transit_arrival stops. Slots below describe the journey
// abstractly; the confirm-flow fans them out across those tables.
export const trainJourney: FactTypeSchema = {
  factType: "train_journey",
  shape: "dated_event",
  conceptWords: ["train", "rail", "trainline", "lner", "eurostar"],
  targets: [
    { table: "travel_bookings", note: "booking-level: provider, ref, price, departure_at/arrival_at" },
    { table: "travel_booking_segments", note: "one per leg: from/to hub, codes, times, operator, seat, barcode" },
    { table: "transitions", as: "train", note: "is_locked=true once booked" },
    { table: "stops", as: "transit_departure", note: "departure event" },
    { table: "stops", as: "transit_arrival", note: "arrival event" },
  ],
  slots: [
    {
      key: "origin",
      label: "From",
      dataType: "hub",
      tier: "essential_to_work",
      resolvesTo: "transport_hubs",
      autoInferFrom: [
        "previous_leg.destination",
        "travel_profile.default_rail_origin",
      ],
      elicitationPrompt: "Which station are you leaving from?",
      dbMapping: "travel_booking_segments.from_hub_id / from_station_code",
    },
    {
      key: "destination",
      label: "To",
      dataType: "hub",
      tier: "essential_to_work",
      resolvesTo: "transport_hubs",
      elicitationPrompt: "Where are you heading?",
      dbMapping: "travel_booking_segments.to_hub_id / to_station_code",
    },
    {
      key: "date",
      label: "Date",
      dataType: "date",
      tier: "essential_to_work",
      elicitationPrompt: "Which day?",
      dbMapping: "date portion of travel_booking_segments.departure_at",
    },
    {
      key: "departure_time",
      label: "Departs",
      dataType: "time",
      tier: "essential_to_work",
      elicitationPrompt: "What time does it leave?",
      dbMapping: "time portion of travel_booking_segments.departure_at",
    },
    {
      key: "arrival_time",
      label: "Arrives",
      dataType: "time",
      tier: "nice_to_have",
      derivableFrom: ["origin", "destination", "departure_time", "rail_timetable_api"],
      dbMapping: "travel_booking_segments.arrival_at",
    },
    {
      key: "changes",
      label: "Changes",
      dataType: "text",
      tier: "nice_to_have",
      dbMapping: "additional travel_booking_segments rows",
    },
    {
      key: "booking_reference",
      label: "Booking ref",
      dataType: "text",
      tier: "essential_to_use",
      dbMapping: "travel_bookings.booking_reference",
    },
    {
      key: "ticket",
      label: "Ticket / QR",
      dataType: "text",
      tier: "essential_to_use",
      dbMapping: "travel_booking_segments.barcode_data / barcode_ref",
    },
    {
      key: "operator",
      label: "Operator",
      dataType: "text",
      tier: "nice_to_have",
      dbMapping: "travel_booking_segments.operator",
    },
    {
      key: "price",
      label: "Price",
      dataType: "money",
      tier: "nice_to_have",
      dbMapping: "travel_bookings.actual_price / currency",
    },
    {
      key: "seat",
      label: "Coach / seat",
      dataType: "text",
      tier: "nice_to_have",
      dbMapping: "travel_booking_segments.coach / seat",
    },
  ],
  validations: ["departure_time must be before arrival_time when both present"],
};
