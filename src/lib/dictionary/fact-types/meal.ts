import type { FactTypeSchema } from "../types";

// A meal / dining reservation (dinner, lunch). A dated event with a party size.
export const meal: FactTypeSchema = {
  factType: "meal",
  shape: "dated_event",
  conceptWords: ["dinner", "lunch", "breakfast", "brunch", "reservation", "restaurant"],
  targets: [{ table: "stops", as: "meal" }],
  slots: [
    {
      key: "place",
      label: "Where",
      dataType: "place",
      tier: "essential_to_work",
      resolvesTo: "locations",
      elicitationPrompt: "Where are you eating?",
      dbMapping: "stops.location_id",
    },
    {
      key: "date",
      label: "Date",
      dataType: "date",
      tier: "essential_to_work",
      dbMapping: "date portion of stops.start_time",
    },
    {
      key: "start_time",
      label: "Time",
      dataType: "time",
      tier: "essential_to_work",
      elicitationPrompt: "What time is the table?",
      dbMapping: "time portion of stops.start_time",
    },
    {
      key: "party_size",
      label: "Party",
      dataType: "party_size",
      tier: "nice_to_have",
      dbMapping: "stops.notes / metadata",
    },
    {
      key: "booking_reference",
      label: "Reservation ref",
      dataType: "text",
      tier: "nice_to_have",
      dbMapping: "stops.external_reference",
    },
  ],
};
