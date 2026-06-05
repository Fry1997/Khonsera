import type { FactTypeMapping } from "../types";

// Transport fact-types. Concept words + slot names come from
// data/layer_1_concept_words.yaml; these mappings add the DB-materialisation
// metadata (which tables, slot value types, place-resolution preference, tiers).
//
// A booked rail/air/coach/ferry/bus leg fans out to travel_booking(+segments) +
// locked transition + transit stops; an unbooked one is a planned transition
// (the brief §16 transition-vs-booking rule decides at materialisation time).

const transitOriginDest = {
  origin: {
    dataType: "hub" as const,
    resolvesTo: "transport_hubs" as const,
    placePref: "transit" as const,
    autoInferFrom: ["previous_leg.destination", "travel_profile.default_rail_origin"],
    dbMapping: "travel_booking_segments.from_hub_id / from_station_code",
  },
  destination: {
    dataType: "hub" as const,
    resolvesTo: "transport_hubs" as const,
    placePref: "transit" as const,
    dbMapping: "travel_booking_segments.to_hub_id / to_station_code",
  },
  date: { dataType: "date" as const },
  departure_time: { dataType: "time" as const },
  arrival_time: {
    dataType: "time" as const,
    derivableFrom: ["origin", "destination", "departure_time"],
  },
  booking_ref: { tier: "essential_to_use" as const, dataType: "text" as const, dbMapping: "travel_bookings.booking_reference" },
  ticket: { tier: "essential_to_use" as const, dataType: "text" as const, dbMapping: "travel_booking_segments.barcode_data" },
  price: { dataType: "money" as const, dbMapping: "travel_bookings.actual_price" },
  seat: { dataType: "text" as const, dbMapping: "travel_booking_segments.seat" },
};

export const trainJourney: FactTypeMapping = {
  factType: "train_journey",
  shape: "dated_event",
  targets: [
    { table: "travel_bookings", note: "when booked" },
    { table: "travel_booking_segments", note: "one per leg" },
    { table: "transitions", as: "train", note: "is_locked=true once booked" },
    { table: "stops", as: "transit_departure" },
    { table: "stops", as: "transit_arrival" },
  ],
  slotMeta: { ...transitOriginDest, operator: { dataType: "text", dbMapping: "travel_booking_segments.operator" } },
  validations: ["departure_time must be before arrival_time when both present"],
};

export const flightJourney: FactTypeMapping = {
  factType: "flight_journey",
  shape: "dated_event",
  targets: [
    { table: "travel_bookings", note: "when booked" },
    { table: "travel_booking_segments", note: "airports as hubs" },
    { table: "transitions", as: "flight", note: "is_locked=true once booked" },
    { table: "stops", as: "transit_departure" },
    { table: "stops", as: "transit_arrival" },
  ],
  slotMeta: {
    ...transitOriginDest,
    origin: { ...transitOriginDest.origin, autoInferFrom: ["travel_profile.default_flight_origin"] },
    flight_number: { tier: "essential_to_use", dataType: "text" },
    airline: { dataType: "text" },
  },
};

export const ferryJourney: FactTypeMapping = {
  factType: "ferry_journey",
  shape: "dated_event",
  targets: [
    { table: "transitions", as: "mixed", note: "planned; booking when a ref/ticket is present" },
    { table: "stops", as: "transit_departure" },
    { table: "stops", as: "transit_arrival" },
  ],
  slotMeta: { ...transitOriginDest },
};

export const busJourney: FactTypeMapping = {
  factType: "bus_journey",
  shape: "dated_event",
  targets: [
    { table: "transitions", as: "bus" },
    { table: "stops", as: "transit_departure" },
    { table: "stops", as: "transit_arrival" },
  ],
  slotMeta: {
    origin: { dataType: "place", resolvesTo: "locations", placePref: "event" },
    destination: { dataType: "place", resolvesTo: "locations", placePref: "event" },
    date: { dataType: "date" },
    departure_time: { dataType: "time" },
  },
};

export const coachJourney: FactTypeMapping = {
  factType: "coach_journey",
  shape: "dated_event",
  targets: [
    { table: "transitions", as: "bus", note: "coach modelled as bus mode" },
    { table: "stops", as: "transit_departure" },
    { table: "stops", as: "transit_arrival" },
  ],
  slotMeta: { ...transitOriginDest },
};

export const taxiJourney: FactTypeMapping = {
  factType: "taxi_journey",
  shape: "dated_event",
  targets: [{ table: "transitions", as: "taxi" }],
  slotMeta: {
    pickup_place: { dataType: "place", resolvesTo: "locations", placePref: "event" },
    dropoff_place: { dataType: "place", resolvesTo: "locations", placePref: "event" },
    date: { dataType: "date" },
    pickup_time: { dataType: "time" },
    passengers: { dataType: "party_size" },
  },
};

export const walkingLeg: FactTypeMapping = {
  factType: "walking_leg",
  shape: "dated_event",
  targets: [{ table: "transitions", as: "walk" }],
  slotMeta: {
    origin: { dataType: "place", resolvesTo: "locations", placePref: "event" },
    destination: { dataType: "place", resolvesTo: "locations", placePref: "event" },
    start_time: { dataType: "time" },
  },
};

export const drivingLeg: FactTypeMapping = {
  factType: "driving_leg",
  shape: "dated_event",
  targets: [{ table: "transitions", as: "drive" }],
  slotMeta: {
    origin: { dataType: "place", resolvesTo: "locations", placePref: "event" },
    destination: { dataType: "place", resolvesTo: "locations", placePref: "event" },
    date: { dataType: "date" },
    departure_time: { dataType: "time" },
  },
};

export const transportMappings: FactTypeMapping[] = [
  trainJourney,
  flightJourney,
  ferryJourney,
  busJourney,
  coachJourney,
  taxiJourney,
  walkingLeg,
  drivingLeg,
];
