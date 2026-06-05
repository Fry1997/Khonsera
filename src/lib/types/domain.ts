// Hand-written domain types that mirror the enums in
// supabase/migrations/*.sql. Once the project is wired to a Supabase instance,
// `npm run db:types` regenerates the full database type definitions in
// database.ts and these stay as the curated subset.

export type WorkspaceType = "personal" | "organisation";
export type MembershipRole = "owner" | "admin" | "member" | "viewer";
export type MembershipStatus = "active" | "invited" | "suspended";

export type LocationType =
  | "home"
  | "office"
  | "station"
  | "hotel"
  | "customer_site"
  | "parking"
  | "other";

// Migration 0016 extended this enum with walk / taxi / no_preference
// for the scoring engine. The legacy values ('rail', 'compare',
// 'mixed') stay in the union so reads of pre-migration rows still
// typecheck — they get migrated to 'no_preference' on first
// settings-page save.
export type TravelModePreference =
  | "walk"
  | "drive"
  | "taxi"
  | "no_preference"
  | "rail"
  | "compare"
  | "mixed";

// Itinerary-level
export type ItineraryStatus =
  | "draft"
  | "planning"
  | "planned"
  | "in_progress"
  | "completed"
  | "cancelled";

export type StopType =
  | "start"
  | "end"
  | "appointment"
  | "accommodation"
  | "event"
  | "meal"
  | "transport_booked"
  | "transit_arrival"
  | "transit_departure"
  | "stopover"
  | "other";

export type TransitionMode =
  | "walk"
  | "drive"
  | "taxi"
  | "bus"
  | "tube"
  | "train"
  | "flight"
  | "mixed";

// Trip-level travel strategy (the JourneyMode chip). Stored on
// itineraries.travel_strategy (migration 0031); null = undecided.
export type TravelStrategy = "rail" | "drive" | "mixed";

// Planning-engine output verdict (per option / per transition)
export type FeasibilityStatus =
  | "recommended"
  | "tight"
  | "not_recommended"
  | "not_possible";

export type LegType =
  | "walk"
  | "drive"
  | "train"
  | "bus"
  | "taxi"
  | "wait"
  | "meeting"
  | "buffer";

export type ExpenseType =
  | "rail_ticket"
  | "mileage"
  | "parking"
  | "taxi"
  | "hotel"
  | "food"
  | "other";

// ============================================================================
// Tell Khonsera capture substrate (migration 0027)
// ============================================================================

// Lifecycle of a raw natural-language capture before it becomes records.
export type CapturedInputStatus =
  | "pending_review"
  | "confirmed"
  | "corrected"
  | "rejected"
  | "expired";

// How certain we are about a fact — drives whether the engine confirms it.
export type FactConfidence = "high" | "medium" | "low";

// How a fact entered the system.
export type FactSource =
  | "manual"
  | "captured"
  | "parsed_email"
  | "calendar"
  | "partner_api"
  | "inferred"
  | "system";

// Per-fact raw->done lifecycle. Distinct from a stop's `commitment` column
// (solver hardness: preferred/required).
export type FactCommitmentState =
  | "raw"
  | "sorted"
  | "planned"
  | "booked"
  | "live"
  | "done"
  | "cancelled";

// Lifecycle of a held wish without a date anchor.
export type IntentStatus =
  | "open"
  | "in_progress"
  | "fulfilled"
  | "abandoned"
  | "snoozed";
