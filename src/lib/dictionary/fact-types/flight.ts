import type { FactTypeSchema } from "../types";

// A flight. Like a train journey it fans out into travel_booking(+segments) and
// the departure/arrival stops, but origin/destination resolve to airports.
export const flight: FactTypeSchema = {
  factType: "flight",
  shape: "dated_event",
  conceptWords: ["flight", "fly", "easyjet", "ryanair", "ba", "jet2"],
  targets: [
    { table: "travel_bookings", note: "booking-level: airline, ref, price, times" },
    { table: "travel_booking_segments", note: "one per leg, airports as hubs" },
    { table: "transitions", as: "flight", note: "is_locked=true once booked" },
    { table: "stops", as: "transit_departure" },
    { table: "stops", as: "transit_arrival" },
  ],
  slots: [
    {
      key: "origin",
      label: "From",
      dataType: "hub",
      tier: "essential_to_work",
      resolvesTo: "transport_hubs",
      autoInferFrom: ["travel_profile.default_flight_origin"],
      elicitationPrompt: "Which airport are you flying from?",
      dbMapping: "travel_booking_segments.from_hub_id (IATA)",
    },
    {
      key: "destination",
      label: "To",
      dataType: "hub",
      tier: "essential_to_work",
      resolvesTo: "transport_hubs",
      elicitationPrompt: "Where are you flying to?",
      dbMapping: "travel_booking_segments.to_hub_id (IATA)",
    },
    {
      key: "date",
      label: "Date",
      dataType: "date",
      tier: "essential_to_work",
      dbMapping: "date portion of travel_booking_segments.departure_at",
    },
    {
      key: "departure_time",
      label: "Departs",
      dataType: "time",
      tier: "essential_to_work",
      dbMapping: "time portion of travel_booking_segments.departure_at",
    },
    {
      key: "arrival_time",
      label: "Arrives",
      dataType: "time",
      tier: "nice_to_have",
      derivableFrom: ["origin", "destination", "departure_time"],
      dbMapping: "travel_booking_segments.arrival_at (destination-local)",
    },
    {
      key: "flight_number",
      label: "Flight number",
      dataType: "text",
      tier: "essential_to_use",
      dbMapping: "travel_booking_segments.train_number (reused for service id)",
    },
    {
      key: "booking_reference",
      label: "Booking ref / PNR",
      dataType: "text",
      tier: "essential_to_use",
      dbMapping: "travel_bookings.booking_reference",
    },
    {
      key: "seat",
      label: "Seat",
      dataType: "text",
      tier: "nice_to_have",
      dbMapping: "travel_booking_segments.seat",
    },
    {
      key: "price",
      label: "Price",
      dataType: "money",
      tier: "nice_to_have",
      dbMapping: "travel_bookings.actual_price / currency",
    },
  ],
  validations: ["departure and arrival are in their own airport-local frames"],
};
