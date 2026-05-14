// Hand-written domain types that mirror the enums in supabase/migrations.
// Once the project is wired to a Supabase instance, run `npm run db:types`
// to generate the full database type definitions and import them alongside.

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
export type VisitStatus =
  | "draft"
  | "checking"
  | "proposed"
  | "confirmed"
  | "booked"
  | "in_progress"
  | "completed"
  | "cancelled";
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
export type SavedTripStatus =
  | "upcoming"
  | "ready"
  | "in_progress"
  | "completed"
  | "cancelled";
