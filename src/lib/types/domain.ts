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

export type TravelModePreference = "rail" | "drive" | "compare" | "mixed";

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
