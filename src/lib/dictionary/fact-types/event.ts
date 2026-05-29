import type { FactTypeSchema } from "../types";

// A generic dated event (show, conference, gig) — the catch-all dated_event when
// no more specific concept word matched but a date/place anchor is present.
export const event: FactTypeSchema = {
  factType: "event",
  shape: "dated_event",
  conceptWords: ["event", "conference", "show", "gig", "concert", "match", "wedding"],
  targets: [{ table: "stops", as: "event" }],
  slots: [
    {
      key: "title",
      label: "What",
      dataType: "text",
      tier: "essential_to_work",
      dbMapping: "stops.title",
    },
    {
      key: "place",
      label: "Where",
      dataType: "place",
      tier: "essential_to_work",
      resolvesTo: "locations",
      elicitationPrompt: "Where is it?",
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
      label: "Starts",
      dataType: "time",
      tier: "nice_to_have",
      dbMapping: "time portion of stops.start_time",
    },
    {
      key: "end_time",
      label: "Ends",
      dataType: "time",
      tier: "nice_to_have",
      dbMapping: "stops.end_time",
    },
  ],
};
