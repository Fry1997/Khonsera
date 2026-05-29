import type { FactTypeSchema } from "../types";

// A meeting / appointment — the most common hard anchor a trip is back-timed from.
// Supports open end-type (the engine computes a must-leave-by from the next anchor).
export const meeting: FactTypeSchema = {
  factType: "meeting",
  shape: "dated_event",
  conceptWords: ["meeting", "appointment", "demo", "visit", "call", "interview", "client"],
  targets: [{ table: "stops", as: "appointment" }],
  slots: [
    {
      key: "place",
      label: "Where",
      dataType: "place",
      tier: "essential_to_work",
      resolvesTo: "customer_sites",
      elicitationPrompt: "Where is it?",
      dbMapping: "stops.location_id / customer_site_id",
    },
    {
      key: "date",
      label: "Date",
      dataType: "date",
      tier: "essential_to_work",
      elicitationPrompt: "Which day?",
      dbMapping: "date portion of stops.start_time",
    },
    {
      key: "start_time",
      label: "Starts",
      dataType: "time",
      tier: "essential_to_work",
      elicitationPrompt: "What time?",
      dbMapping: "time portion of stops.start_time",
    },
    {
      key: "end_time",
      label: "Ends",
      dataType: "time",
      tier: "nice_to_have",
      derivableFrom: ["next_anchor.start_time"],
      dbMapping: "stops.end_time (open end-type => computed must-leave-by)",
    },
    {
      key: "with_person",
      label: "With",
      dataType: "person",
      tier: "nice_to_have",
      resolvesTo: "contacts",
      dbMapping: "stops.contact_id",
    },
    {
      key: "customer",
      label: "Customer",
      dataType: "text",
      tier: "nice_to_have",
      resolvesTo: "customers",
      dbMapping: "stops.customer_id",
    },
  ],
};
