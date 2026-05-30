import type { FactTypeMapping } from "../types";

// Scheduled / event fact-types. These are the hard anchors a trip is back-timed
// from. Concept words + slots come from the YAML; mappings add DB metadata.
// Event-place slots resolve as plain labels unless an explicit station is named
// (brief §10): a meeting "in Derby" is the city, not the station.

const eventPlace = {
  dataType: "place" as const,
  resolvesTo: "customer_sites" as const,
  placePref: "event" as const,
  dbMapping: "stops.location_id / customer_site_id (label otherwise)",
};

export const scheduledEvent: FactTypeMapping = {
  factType: "scheduled_event",
  shape: "dated_event",
  typicalHours: [8, 18], // work hours — bare "at 3" → 15:00
  targets: [{ table: "stops", as: "appointment" }],
  slotMeta: {
    place: eventPlace,
    date: { dataType: "date" },
    time: { dataType: "time", dbMapping: "time portion of stops.start_time" },
    contact: { dataType: "person", resolvesTo: "contacts", dbMapping: "stops.contact_id" },
    organisation: { dataType: "text", resolvesTo: "customers", dbMapping: "stops.customer_id" },
    duration: { dataType: "duration" },
    attendees: { dataType: "text" },
  },
};

export const scheduledCall: FactTypeMapping = {
  factType: "scheduled_call",
  shape: "dated_event",
  typicalHours: [8, 18],
  // A call has no place; it's a time-anchored appointment-type stop.
  targets: [{ table: "stops", as: "appointment", note: "video/phone call — no place" }],
  slotMeta: {
    date: { dataType: "date" },
    time: { dataType: "time" },
    contact: { dataType: "person", resolvesTo: "contacts", dbMapping: "stops.contact_id" },
    organisation: { dataType: "text", resolvesTo: "customers" },
    duration: { dataType: "duration" },
  },
};

export const appointment: FactTypeMapping = {
  factType: "appointment",
  shape: "dated_event",
  typicalHours: [8, 18],
  targets: [{ table: "stops", as: "appointment" }],
  slotMeta: {
    place: eventPlace,
    date: { dataType: "date" },
    time: { dataType: "time" },
    contact: { dataType: "person", resolvesTo: "contacts" },
    organisation: { dataType: "text", resolvesTo: "customers" },
    booking_ref: { tier: "essential_to_use", dataType: "text" },
  },
};

export const businessEvent: FactTypeMapping = {
  factType: "business_event",
  shape: "dated_event",
  typicalHours: [9, 17],
  targets: [{ table: "stops", as: "event" }],
  slotMeta: {
    place: eventPlace,
    date: { dataType: "date" },
    start_time: { dataType: "time" },
    end_time: { dataType: "time" },
    booking_ref: { tier: "essential_to_use", dataType: "text" },
  },
};

export const mealPlan: FactTypeMapping = {
  factType: "meal_plan",
  shape: "dated_event",
  // Default lean towards evening dining; the resolver narrows per meal word
  // (breakfast/lunch/dinner/drinks) from the clause text (stress-test Fix 7).
  typicalHours: [12, 22],
  targets: [{ table: "stops", as: "meal" }],
  slotMeta: {
    place: { dataType: "place", resolvesTo: "locations", placePref: "event" },
    date: { dataType: "date" },
    time_or_period: { dataType: "time", dbMapping: "time portion of stops.start_time" },
    party_size: { dataType: "party_size" },
    contact: { dataType: "person", resolvesTo: "contacts", dbMapping: "stops.contact_id" },
    booking_ref: { dataType: "text", dbMapping: "stops.external_reference" },
  },
};

export const scheduledMappings: FactTypeMapping[] = [
  scheduledEvent,
  scheduledCall,
  appointment,
  businessEvent,
  mealPlan,
];
