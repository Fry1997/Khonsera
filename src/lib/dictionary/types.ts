// Fact-type schema model for the Tell Khonsera dictionary.
//
// A schema is the formal definition of what slots a fact-type carries, which are
// essential and which optional, and how each should be elicited or inferred. One
// source of truth shared by (a) the parser's confidence ratings, (b) the gap
// engine's missing-slot detection, (c) the confirm/correct draft cards, and (d)
// downstream validation.
//
// This is reference data: it changes with releases, not at runtime, so it lives in
// version control as code rather than a database table. It is pure — no I/O.

// Slot tiers, ranked. The gap engine surfaces missing slots worst-tier-first.
//   essential_to_work — without it the fact can't be planned (origin, destination, date)
//   essential_to_use  — needed to actually use the booking (ticket/QR, booking ref)
//   nice_to_have      — enriches but never blocks (seat, class, price)
export type SlotTier = "essential_to_work" | "essential_to_use" | "nice_to_have";

// Runtime state of a slot on a concrete fact (computed by the gap engine, not part
// of the schema). Listed here so consumers share one vocabulary.
//   empty     — no value; ask for it
//   ambiguous — resolved to a set, not a single value (e.g. multiple Birmingham stations)
//   resolved  — filled and unambiguous (silent)
export type SlotState = "empty" | "ambiguous" | "resolved";

// The kind of value a slot holds. Drives parsing + the correct input control.
export type SlotDataType =
  | "date"
  | "time"
  | "datetime"
  | "duration" // minutes
  | "money"
  | "party_size"
  | "place" // a saved Place / location
  | "hub" // a transport_hub (rail station / airport)
  | "person" // a contact
  | "text"
  | "number"
  | "boolean";

// Entity table a resolvable slot resolves against (for autocomplete + resolution).
export type SlotResolverTarget =
  | "transport_hubs"
  | "locations"
  | "customers"
  | "customer_sites"
  | "contacts";

export interface SlotDef {
  // Stable key, snake_case.
  key: string;
  // Human label for draft cards.
  label: string;
  dataType: SlotDataType;
  tier: SlotTier;
  // For place/hub/person slots: what it resolves against.
  resolvesTo?: SlotResolverTarget;
  // Slots whose values can pre-fill this one (drops its effective tier).
  // Dotted refs are conventions read by the gap engine, e.g.
  // "previous_leg.destination", "travel_profile.default_rail_origin".
  autoInferFrom?: string[];
  // Sources that can derive the value when other slots are present, e.g. a
  // rail timetable API deriving arrival_time from origin+destination+departure.
  derivableFrom?: string[];
  // What the concierge asks when this slot is empty (voice-guardrail safe).
  elicitationPrompt?: string;
  // Free-text note on where the value lands in the real DB representation.
  // (Mapping is many-to-one — see FactTypeSchema.targets — so this is a hint,
  // not a single column binding.)
  dbMapping?: string;
}

// The §4 shape classification, decided from the presence/absence of anchors.
export type FactShape = "dated_event" | "undated_task" | "intent" | "note";

// Where a fact-type lands in the existing schema. A train journey is several
// rows across several tables, so this is a list, not one binding.
export interface FactTarget {
  table:
    | "stops"
    | "transitions"
    | "travel_bookings"
    | "travel_booking_segments"
    | "standing_facts"
    | "intents"
    | "captured_inputs";
  // For stops: the `type` enum value this maps to; for transitions: the `mode`.
  as?: string;
  note?: string;
}

export interface FactTypeSchema {
  // Stable name, snake_case (e.g. "train_journey").
  factType: string;
  shape: FactShape;
  // Dictionary Layer-1 concept words that instantiate this fact-type.
  conceptWords: string[];
  // The real representation this maps to in the existing schema.
  targets: FactTarget[];
  slots: SlotDef[];
  // Human-readable validation rules the gap engine / UI enforce.
  validations?: string[];
  // True for the verbatim-hold shapes (note/task/intent): keep the user's exact
  // words, never interpret the unknown subject noun (§4 tiered-honesty rule).
  verbatimHold?: boolean;
}

export interface FactTypeRegistry {
  getSchema(factType: string): FactTypeSchema | undefined;
  listSchemas(): FactTypeSchema[];
  // All concept words → fact-type, for the dictionary's Layer-1 lookup.
  conceptWordIndex(): Map<string, string>;
}
