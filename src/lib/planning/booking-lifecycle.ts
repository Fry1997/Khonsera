// Booking lifecycle + deeplinks (P4.13) — planning-side, Stage 0.
//
// The planning view only ever shows the pre-driver states: Proposed and
// Booked. The live-day states (driver assigned, en route, arrived) belong to
// the live-day brief. In Stage 0 we can't confirm a partner booking happened —
// the deeplink opens the partner app pre-filled and the card stays Proposed
// until the user marks it booked. This maps our booking_intent_status enum onto
// the lifecycle the UI reads, and builds the Stage-0 deeplinks.
//
// Pure, no IO.

import type { LatLng } from "@/lib/integrations/types";

// What the planning card renders. (Driver-assigned/arrived/etc. are live-day,
// not modelled here.)
export type LifecycleState =
  | "Proposed"
  | "Booked"
  | "Failed"
  | "Cancelled";

// booking_intent_status (migration): not_started | opened_partner | booked |
// failed | abandoned. opened_partner still reads Proposed in Stage 0 — opening
// the partner app isn't proof of a booking.
export function lifecycleState(status: string): LifecycleState {
  switch (status) {
    case "booked":
      return "Booked";
    case "failed":
      return "Failed";
    case "abandoned":
      return "Cancelled";
    case "not_started":
    case "opened_partner":
    default:
      return "Proposed";
  }
}

// Count of essentials still to book — drives the LifecycleBand auto-advance
// (planning → planned once nothing's left). The brief: any booking_intents
// whose status != 'booked'.
export function essentialsRemaining(
  intents: { status: string }[],
): number {
  return intents.filter((i) => i.status !== "booked").length;
}

// ── Stage-0 deeplinks ────────────────────────────────────────────────────────

function coordParams(prefix: string, p: LatLng, name?: string | null): string {
  const parts = [
    `${prefix}[latitude]=${p.lat}`,
    `${prefix}[longitude]=${p.lng}`,
  ];
  if (name) parts.push(`${prefix}[formatted_address]=${encodeURIComponent(name)}`);
  return parts.join("&");
}

// Uber universal link (works whether or not the app is installed). Pre-fills
// pickup (and dropoff when known). The card stays Proposed after this opens.
export function uberDeeplink(params: {
  pickup: LatLng;
  pickupName?: string | null;
  dropoff?: LatLng | null;
  dropoffName?: string | null;
}): string {
  const segments = [
    "action=setPickup",
    coordParams("pickup", params.pickup, params.pickupName),
  ];
  if (params.dropoff) {
    segments.push(coordParams("dropoff", params.dropoff, params.dropoffName));
  }
  return `https://m.uber.com/ul/?${segments.join("&")}`;
}

// Trainline results deeplink, pre-selecting the pair. Dates are ISO (yyyy-mm-dd
// or full ISO — Trainline reads the date part).
export function trainlineDeeplink(params: {
  originCode: string;
  destinationCode: string;
  outwardDate: string;
  returnDate?: string | null;
}): string {
  const q = new URLSearchParams({
    origin: params.originCode,
    destination: params.destinationCode,
    outwardDate: params.outwardDate,
  });
  if (params.returnDate) {
    q.set("returnDate", params.returnDate);
    q.set("journeySearchType", "return");
  } else {
    q.set("journeySearchType", "single");
  }
  return `https://www.thetrainline.com/book/results?${q.toString()}`;
}
