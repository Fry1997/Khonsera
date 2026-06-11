// Valhalla adapter — request building + response mapping, kept pure so the
// mapping is unit-testable with a fixture. The network call lives in the
// server action (actions/nav.ts); a future transit adapter (TfL/OTP) sits
// beside this one behind the same NavRoute shape.
//
// Valhalla is open source (https://github.com/valhalla/valhalla). The default
// endpoint is the FOSSGIS community instance; self-hosting swaps one env var.

import { decodeShape } from "./shape";
import type { ManeuverKind, NavMode, NavPoint, NavRoute } from "./types";

const COSTING: Record<NavMode, string> = {
  walk: "pedestrian",
  cycle: "bicycle",
  drive: "auto",
};

export function buildValhallaRequest(origin: NavPoint, destination: NavPoint, mode: NavMode) {
  return {
    locations: [
      { lat: origin.lat, lon: origin.lng, type: "break" },
      { lat: destination.lat, lon: destination.lng, type: "break" },
    ],
    costing: COSTING[mode],
    units: "kilometers",
    // Valhalla narrative gives written + verbal instructions per maneuver.
    directions_options: { language: "en-GB" },
  };
}

// Valhalla maneuver `type` enum → our normalised kind.
// https://valhalla.github.io/valhalla/api/turn-by-turn/api-reference/#trip-legs-and-maneuvers
const KIND_BY_TYPE: Record<number, ManeuverKind> = {
  1: "depart", 2: "depart", 3: "depart",
  4: "arrive", 5: "arrive", 6: "arrive",
  7: "straight", 8: "straight",
  9: "slight-right", 10: "right", 11: "sharp-right",
  12: "uturn", 13: "uturn",
  14: "sharp-left", 15: "left", 16: "slight-left",
  17: "straight", 18: "right", 19: "left", // ramp straight/right/left
  20: "right", 21: "left",                 // exit right/left
  22: "straight", 23: "slight-right", 24: "slight-left", // stay on
  25: "merge", 37: "merge", 38: "merge",
  26: "roundabout", 27: "exit-roundabout",
  28: "ferry", 29: "ferry",
};

interface ValhallaManeuver {
  type: number;
  instruction: string;
  verbal_pre_transition_instruction?: string;
  street_names?: string[];
  length: number; // km (we request kilometers)
  time: number;   // seconds
  begin_shape_index: number;
  end_shape_index: number;
}

interface ValhallaLeg {
  maneuvers: ValhallaManeuver[];
  shape: string; // encoded polyline, precision 6
}

export interface ValhallaTrip {
  trip: {
    legs: ValhallaLeg[];
    summary: { length: number; time: number }; // km, seconds
    status: number;
  };
}

export function mapValhallaTrip(
  body: ValhallaTrip,
  origin: NavPoint,
  destination: NavPoint,
  mode: NavMode,
): NavRoute | null {
  const trip = body?.trip;
  const leg = trip?.legs?.[0];
  if (!trip || !leg?.shape) return null;

  const geometry = decodeShape(leg.shape, 6);
  if (geometry.length < 2) return null;

  return {
    mode,
    origin,
    destination,
    distance_m: Math.round(trip.summary.length * 1000),
    duration_s: Math.round(trip.summary.time),
    geometry,
    maneuvers: (leg.maneuvers ?? []).map((m) => ({
      kind: KIND_BY_TYPE[m.type] ?? "other",
      instruction: m.instruction,
      verbal: m.verbal_pre_transition_instruction,
      distance_m: Math.round(m.length * 1000),
      time_s: Math.round(m.time),
      begin_shape_index: m.begin_shape_index,
      end_shape_index: m.end_shape_index,
      street: m.street_names?.[0],
    })),
    provider: "valhalla",
    fetched_at: new Date().toISOString(),
  };
}
