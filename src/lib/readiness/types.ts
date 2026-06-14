// Readiness (Phase 4) — the "have you got everything?" check, DERIVED from the
// day-object by the rules engine, with a thin persisted tick/dismiss overlay
// (readiness_state, migration 0035). See docs/research/readiness.md.

export type ReadinessCategory =
  | "tickets"
  | "documents"
  | "bookings"
  | "devices"
  | "international"
  | "multiday";

export type ReadinessSeverity = "info" | "advise" | "warn";

export type ReadinessAction =
  | { kind: "none" }
  | { kind: "task"; title: string } // set a reminder
  | { kind: "book" } // connections seam (mocked until L5) — booked item auto-satisfies
  | { kind: "link"; href: string; label: string };

export type ReadinessCheck = {
  key: string; // stable per day, so the overlay sticks across recomputes
  category: ReadinessCategory;
  label: string;
  detail?: string;
  severity: ReadinessSeverity;
  action: ReadinessAction;
};

export type ReadinessStatus = "open" | "done" | "dismissed" | "snoozed";
export type ReadinessItem = ReadinessCheck & { status: ReadinessStatus };

export const CATEGORY_LABELS: Record<ReadinessCategory, string> = {
  tickets: "Tickets",
  documents: "Documents",
  bookings: "Bookings",
  devices: "Devices & power",
  international: "International",
  multiday: "Your trip",
};

export type DaySummary = {
  isMultiDay: boolean;
  uncoveredNights: string[]; // ISO dates with no accommodation
  unbookedTransitLegs: { key: string; from: string; to: string }[];
  hasFlight: boolean;
  isInternational: boolean;
  hasDrive: boolean;
};
