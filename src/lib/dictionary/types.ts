// Fact-type schema model for the Tell Khonsera dictionary.
//
// Two halves that the loader merges into one runtime schema:
//   1. YAML Layer 1 (data/layer_1_concept_words.yaml) — the parse-time source of
//      truth: concept-word triggers + essential/optional slot names per fact-type.
//   2. The TypeScript mapping registry (this folder) — the DB-materialisation
//      metadata the YAML lacks: which tables a fact-type lands in, each slot's
//      value type, resolver target, place-resolution preference, tier override,
//      inference sources. Keyed by the YAML fact_type name.
//
// All of this is static reference data: it ships with the app, loads into memory
// once, and is pure (no I/O at use time). Shared by the parser's slot-fill +
// confidence, the (future) gap engine's missing-slot detection, the confirm/correct
// draft cards, and materialisation.

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

// Slot-aware place resolution preference (brief §10).
//   transit — resolve against transport_hubs (a station/airport)
//   event   — keep as a plain place label unless an explicit station is named
//   none    — not a place slot
export type PlaceResolutionPref = "transit" | "event" | "none";

// Per-slot materialisation metadata supplied by the registry (the YAML carries
// only the slot name + essential/optional split). All fields optional — sensible
// defaults are derived when absent.
export interface SlotMeta {
  // Tier override; default derived from the YAML essential/optional split.
  tier?: SlotTier;
  dataType?: SlotDataType;
  resolvesTo?: SlotResolverTarget;
  placePref?: PlaceResolutionPref;
  // Slots whose values can pre-fill this one (drops its effective tier).
  // Dotted refs read by the gap engine, e.g. "previous_leg.destination".
  autoInferFrom?: string[];
  // Sources that can derive the value when sibling slots are present.
  derivableFrom?: string[];
  elicitationPrompt?: string;
  dbMapping?: string;
}

// The §4 shape classification, decided from the presence/absence of anchors.
export type FactShape = "dated_event" | "undated_task" | "intent" | "note";

// Where a fact-type lands in the existing schema. A train journey is several rows
// across several tables, so this is a list, not one binding.
export interface FactTarget {
  table:
    | "stops"
    | "transitions"
    | "travel_bookings"
    | "travel_booking_segments"
    | "standing_facts"
    | "intents"
    | "captured_inputs";
  // For stops: the `type` enum value; for transitions: the `mode`.
  as?: string;
  note?: string;
}

// The registry entry for one fact-type — materialisation metadata only.
// Keyed by the YAML fact_type name (train_journey, scheduled_event, ...).
export interface FactTypeMapping {
  factType: string;
  shape: FactShape;
  targets: FactTarget[];
  // Per-slot metadata, keyed by slot name (matching the YAML slot names).
  slotMeta?: Record<string, SlotMeta>;
  // True for the verbatim-hold shapes (note/task/intent): keep the user's exact
  // words, never interpret the unknown subject noun (§4 tiered-honesty rule).
  verbatimHold?: boolean;
  // Human-readable validation rules the gap engine / UI enforce.
  validations?: string[];
  // [startHour, endHour] (24h) — the event's typical hours. Used to disambiguate a
  // bare meridiem-less hour ("dinner from 7" → 19:00) (stress-test Fix 7). Absent →
  // no inference (e.g. trains/flights), the bare hour stays flagged.
  typicalHours?: [number, number];
}

// A fully-resolved slot: YAML name + essential/optional → tier, merged with the
// registry's SlotMeta.
export interface SlotDef {
  key: string;
  label: string;
  dataType: SlotDataType;
  tier: SlotTier;
  resolvesTo?: SlotResolverTarget;
  placePref?: PlaceResolutionPref;
  autoInferFrom?: string[];
  derivableFrom?: string[];
  elicitationPrompt?: string;
  dbMapping?: string;
}

// The merged runtime schema the parser consumes: YAML concept words + slots fused
// with the registry mapping. Built once by the dictionary loader.
export interface FactTypeSchema {
  factType: string;
  shape: FactShape;
  conceptWords: string[];
  targets: FactTarget[];
  slots: SlotDef[];
  verbatimHold?: boolean;
  validations?: string[];
  typicalHours?: [number, number];
}

// The mapping registry (DB metadata, no concept words / slot lists of its own).
export interface FactTypeRegistry {
  getMapping(factType: string): FactTypeMapping | undefined;
  listMappings(): FactTypeMapping[];
}
