// Live-guidance engine — pure functions over a NavRoute and a GPS fix, so the
// whole thing unit-tests without a browser. The hook (use-guidance.ts) feeds
// watchPosition fixes in; this answers: where on the route am I, what's the
// next instruction, how far to it, how much remains, am I off-route?

import { haversineMeters } from "@/lib/geo";
import type { NavRoute } from "./types";

export interface GuidanceState {
  segment_index: number;      // geometry segment the fix snapped to
  snapped: [number, number];  // [lat, lng] on the route line
  off_route_m: number;        // crow-flies distance from fix to the line
  along_m: number;            // distance travelled along the route
  remaining_m: number;
  remaining_s: number;        // duration scaled by remaining fraction
  maneuver_index: number;     // the maneuver we're heading toward
  to_maneuver_m: number;      // distance along the route to that maneuver
  arrived: boolean;
}

// Off-route thresholds. Tight so a wrong turn is caught within a few paces;
// the floor for walking is the centreline/pavement offset (~10–20m) — below
// ~20m you'd reroute just for walking the correct side of the street. The
// accuracy gate (use-guidance) only trusts the call when GPS is precise to
// within the threshold, which filters street-canyon wobble.
export const OFF_ROUTE_M: Record<NavRoute["mode"], number> = {
  walk: 25,
  cycle: 50,
  drive: 80,
};

const ARRIVE_M = 25;

// Cumulative metres along the geometry, one entry per point. Computed once
// per route (the hook memoises) and shared by every guidance tick.
export function cumulativeDistances(geometry: [number, number][]): number[] {
  const out = new Array<number>(geometry.length);
  out[0] = 0;
  for (let i = 1; i < geometry.length; i++) {
    const [aLat, aLng] = geometry[i - 1];
    const [bLat, bLng] = geometry[i];
    out[i] = out[i - 1] + haversineMeters(aLat, aLng, bLat, bLng);
  }
  return out;
}

// Project a fix onto the nearest segment of the route line. Equirectangular
// locally (fine at city scale) — we only need metres-level fidelity.
function projectOntoSegment(
  p: [number, number],
  a: [number, number],
  b: [number, number],
): { point: [number, number]; t: number } {
  const cos = Math.cos((p[0] * Math.PI) / 180);
  const ax = a[1] * cos, ay = a[0];
  const bx = b[1] * cos, by = b[0];
  const px = p[1] * cos, py = p[0];
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return { point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], t };
}

export function snapToRoute(
  geometry: [number, number][],
  cumulative: number[],
  fix: { lat: number; lng: number },
  // Searching from the last-known segment keeps us from snapping backwards
  // onto an earlier pass of a self-crossing route; -1 searches everywhere.
  fromSegment = -1,
): { segment_index: number; snapped: [number, number]; off_route_m: number; along_m: number } {
  const p: [number, number] = [fix.lat, fix.lng];
  let best = { segment_index: 0, snapped: geometry[0], off_route_m: Number.POSITIVE_INFINITY, along_m: 0 };

  // A short look-back (2 segments) absorbs GPS jitter without rewinding far.
  const start = fromSegment >= 0 ? Math.max(0, fromSegment - 2) : 0;
  for (let i = start; i < geometry.length - 1; i++) {
    const { point, t } = projectOntoSegment(p, geometry[i], geometry[i + 1]);
    const d = haversineMeters(fix.lat, fix.lng, point[0], point[1]);
    if (d < best.off_route_m) {
      const segLen = cumulative[i + 1] - cumulative[i];
      best = { segment_index: i, snapped: point, off_route_m: d, along_m: cumulative[i] + segLen * t };
    }
  }
  return best;
}

export function guidanceTick(
  route: NavRoute,
  cumulative: number[],
  fix: { lat: number; lng: number },
  fromSegment = -1,
): GuidanceState {
  const snap = snapToRoute(route.geometry, cumulative, fix, fromSegment);
  const total = cumulative[cumulative.length - 1];
  const remaining_m = Math.max(0, total - snap.along_m);

  // Next maneuver = first whose begin point lies ahead of us. The final
  // "arrive" maneuver begins at the last shape point.
  let maneuver_index = route.maneuvers.length - 1;
  for (let i = 0; i < route.maneuvers.length; i++) {
    const beginAlong = cumulative[Math.min(route.maneuvers[i].begin_shape_index, cumulative.length - 1)];
    // Skip the depart maneuver once we're moving (its begin is behind us).
    if (beginAlong > snap.along_m + 1) {
      maneuver_index = i;
      break;
    }
  }
  const beginAlong = cumulative[Math.min(route.maneuvers[maneuver_index]?.begin_shape_index ?? 0, cumulative.length - 1)];

  const destDist = haversineMeters(fix.lat, fix.lng, route.destination.lat, route.destination.lng);
  return {
    ...snap,
    remaining_m,
    remaining_s: total > 0 ? Math.round(route.duration_s * (remaining_m / total)) : 0,
    maneuver_index,
    to_maneuver_m: Math.max(0, beginAlong - snap.along_m),
    arrived: destDist <= ARRIVE_M || remaining_m <= ARRIVE_M,
  };
}

// Walking distances read in metres up close, miles further out — matches the
// voice-safe style of formatMiles but keeps barrier-scale numbers honest.
export function formatNavDistance(meters: number): string {
  if (meters < 15) return "now";
  if (meters < 300) return `${Math.round(meters / 10) * 10} m`;
  if (meters < 800) return `${Math.round(meters / 50) * 50} m`;
  const miles = meters / 1609.344;
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

export function formatNavDuration(seconds: number): string {
  if (seconds < 60) return "under a minute";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  return `${h}h ${String(mins % 60).padStart(2, "0")}m`;
}
