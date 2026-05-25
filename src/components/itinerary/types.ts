// Shared domain types for the itinerary editor surfaces (brief form +
// the post-submit editor). Pure types only — no React, no helpers, no
// constants. Keep this file dependency-light so both client and server
// modules can pull from it without dragging UI deps along.

import type { PlaceSelection } from "@/components/place-picker";
import type { TransportBookingValue } from "@/components/transport-booking-fields";
import type { AccommodationBookingValue } from "@/components/accommodation-booking-fields";

// ─────────────────────────────────────────────────────────────────────
// Kinds + sub-roles
//
// Each anchor in the brief carries a kind (the primary badge) and an
// optional role (the sub-badge). Both are inferred from the chosen
// place's Google type but the user can override either at any time.
// ─────────────────────────────────────────────────────────────────────

export type AnchorKind =
  | "appointment"
  | "stay"
  | "meal"
  | "event"
  | "station";

export type AnchorRole = string | null;

export type RoleOption = { value: string; label: string };

// Timing mode — what's pinned on this anchor.
//   arrive_by   — you know when you need to be there. Most common.
//   leave_by    — you know when you need to leave (a train to catch,
//                 a dinner to make). The arrival is derived backwards.
//   around_then — you only know the duration; Khonsera fits the stop
//                 between the adjacent anchors once travel is known.
//   maximize    — spend as long as possible here. Khonsera computes
//                 arrival from inbound transport + travel, departure
//                 from outbound transport - travel - buffer.
export type TimingMode = "arrive_by" | "leave_by" | "around_then" | "maximize";

export type Anchor = {
  uid: string;
  place: PlaceSelection | null;
  kindOverride: AnchorKind | null;
  roleOverride: AnchorRole | null;
  date: string;
  time: string;
  timingMode: TimingMode;
  timingModeOverride: boolean;
  durationMins: number;
  checkOutDate: string;
  checkOutTime: string;
  notes: string | null;
  accommodation: AccommodationBookingValue | null;
};

// ─────────────────────────────────────────────────────────────────────
// Transitions
//
// Each pair of adjacent anchors can carry an intended travel mode and
// optionally a pre-booked ticket. "auto" means "let the editor pick";
// any other mode locks the editor onto that. Booking, when present,
// also locks start/end times.
// ─────────────────────────────────────────────────────────────────────

export type TransitionMode =
  | "auto"
  | "walk"
  | "drive"
  | "taxi"
  | "bus"
  | "tube"
  | "train"
  | "flight"
  | "mixed";

export type BriefBooking = {
  provider: string;
  reference: string;
  serviceNumber: string;
  departTime: string;
  arriveTime: string;
  seat: string;
  price: string;
  // Station/airport hub for the destination — set via TransportHubPicker
  // when the mode is station-based (train, flight, tube, bus).
  destinationHub: { id: string | null; label: string | null };
};

export type LocalMode = "auto" | "walk" | "drive" | "taxi";

// A Stopover is an *intent* to drop in somewhere between two anchors —
// not an anchor itself. It has no fixed time, only an ideal duration;
// its position is implied by which two anchors it sits between. The
// leave-by times propagate backwards from the next anchor's fixed
// start.
export type Stopover = {
  place: PlaceSelection | null;
  durationMins: number;
};

export type BriefTransition = {
  mode: TransitionMode;
  localBefore: LocalMode;
  localAfter: LocalMode;
  booked: boolean;
  booking: BriefBooking;
  // Rich booking via the full transport modal (same form as planning).
  // When set, takes precedence over the simple `booking` fields.
  transportBooking: TransportBookingValue | null;
};
