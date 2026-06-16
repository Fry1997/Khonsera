// Comfort buffers — how early you want to be, by what you're catching.
//
// A buffer is not one number. It's a matter of personal comfort AND of what
// kind of thing you're arriving for: an airport wants check-in + security time,
// a national-rail platform wants a few minutes, a tube change wants barely any,
// a customer meeting wants a polite early arrival. So the buffer is a small set
// of user-tunable dials (Settings → Travel profile) resolved per stop.
//
// The solver applies the buffer as an EARLIER leave (not a longer leg), so it
// reads as slack in a wider window. Feasibility then uses the SAME buffer as its
// "comfortable" threshold — which is why a route the solver builds for you never
// "moans" about zero slack: the slack it gave you is exactly the comfort you asked
// for. A warning only fires when two genuinely-fixed times can't fit it.
//
// Pure / no I/O. Used by both `resolveItineraryTimes` (solver input) and the
// plan page's leg feasibility, so the two always agree on the number.

import type { TransitionMode } from "@/lib/types/domain";

export type ComfortBufferProfile = {
  // Rail / national-rail platform boarding (Settings: "Station buffer").
  default_arrival_buffer_minutes?: number | null;
  // Airport check-in + security (Settings: "Airport buffer").
  default_airport_buffer_minutes?: number | null;
  // Appointments / events — arrive a touch early (Settings: "Meeting buffer").
  default_meeting_buffer_minutes?: number | null;
};

// Defaults when a dial is unset. These are the conventional comfort levels;
// the user overrides any of them in Travel profile.
export const DEFAULT_STATION_BUFFER = 15; // national rail platform
export const DEFAULT_AIRPORT_BUFFER = 90; // check-in + security
export const DEFAULT_MEETING_BUFFER = 10; // appointment / event
export const DEFAULT_TUBE_BUFFER = 5; // tube / bus board + interchange
export const DEFAULT_DINING_BUFFER = 5; // a reservation grace

// Resolve the comfort buffer (minutes) you'd want when arriving INTO this stop.
// `mode` is the stop's own transport mode (from metadata.transport_mode) or the
// mode of the leg that reaches it — it lets us tell a tube change (quick) from a
// national-rail board (fuller) and a flight (long).
export function comfortBufferMinutes(
  stop: { type?: string | null; mode?: TransitionMode | string | null },
  profile?: ComfortBufferProfile | null,
): number {
  const station = profile?.default_arrival_buffer_minutes ?? DEFAULT_STATION_BUFFER;
  const airport = profile?.default_airport_buffer_minutes ?? DEFAULT_AIRPORT_BUFFER;
  const meeting = profile?.default_meeting_buffer_minutes ?? DEFAULT_MEETING_BUFFER;
  const type = stop.type ?? "";
  const mode = stop.mode ?? null;

  // Air travel: the airport check-in / security buffer.
  if (type.includes("flight") || mode === "flight") return airport;

  // Boarding rail / tube. The buffer is the platform/interchange margin, so it
  // only attaches to a DEPARTURE (or a changeover, which boards onward) — never
  // a plain arrival, where there's nothing to be early for.
  if (type === "transit_departure" || type === "transit_changeover") {
    // Tube and bus interchanges are quick; cap the tube buffer so a user who
    // likes a roomy rail buffer doesn't inherit it underground.
    if (mode === "tube" || mode === "bus") return Math.min(DEFAULT_TUBE_BUFFER, station);
    return station;
  }

  // Appointments / events — arrive a touch early.
  if (type === "appointment" || type === "event") return meeting;

  // A dining reservation gets a small grace.
  if (type === "meal") return DEFAULT_DINING_BUFFER;

  // Home/base, check-in/out, plain arrivals, stopovers, other: no boarding buffer.
  return 0;
}

// Read a stop's transport mode from its metadata (booked rail/flight stamp it),
// falling back to a supplied leg mode. Small helper so callers don't duplicate
// the metadata-shape knowledge.
export function stopModeOf(
  stop: { metadata?: Record<string, unknown> | null },
  fallback?: TransitionMode | string | null,
): TransitionMode | string | null {
  const m = stop.metadata?.transport_mode;
  if (typeof m === "string" && m) return m;
  return fallback ?? null;
}
