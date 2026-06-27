import type { Journey, Leg, LegMode, LatLng, Station } from "./types";
import { decodePolyline } from "./utils/decode-polyline";

// Shared wiring layer: build a JourneyMap `Journey` from DB stops + transitions.
// Extracted from the legacy itinerary-editor so both the legacy page and the
// canonical `/plan/[id]` spine render the same door-to-door map. Pure + testable.

export type StopForMap = {
  id: string;
  title: string | null;
  location?: { name: string | null; latitude: number | null; longitude: number | null } | null;
  customer_site?: { name: string | null; latitude: number | null; longitude: number | null } | null;
  transport_hub?: { code: string | null; name: string | null; latitude: number | null; longitude: number | null } | null;
};

export type TransitionForMap = {
  from_stop_id: string;
  mode: string;
  overview_polyline?: string | null;
  computed_duration_minutes?: number | null;
};

const MODE_MAP: Record<string, LegMode> = {
  walk: "walk",
  drive: "road",
  taxi: "road",
  train: "rail",
  bus: "transit",
  tube: "transit",
  mixed: "road",
  cycle: "road",
  flight: "flight",
  ferry: "ferry",
};

function coordOf(s: StopForMap): { lat: number; lng: number } {
  const lat = Number(s.customer_site?.latitude ?? s.location?.latitude ?? s.transport_hub?.latitude ?? 0);
  const lng = Number(s.customer_site?.longitude ?? s.location?.longitude ?? s.transport_hub?.longitude ?? 0);
  return { lat, lng };
}

function nameOf(s: StopForMap): string {
  return s.title ?? s.location?.name ?? s.customer_site?.name ?? s.transport_hub?.name ?? "";
}

function haversineMi(a: LatLng, b: LatLng): number {
  const R = 3958.8; // miles
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const la1 = (a[0] * Math.PI) / 180;
  const la2 = (b[0] * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// A stored route is only trustworthy if its endpoints actually sit at this
// leg's two stops. A mis-keyed / stale cache (e.g. a Leicester→Birmingham
// polyline cached under the wrong CRS pair) decodes to a line that wanders off
// to the wrong place — the "phantom branch" that forks off the real route.
// Reject anything whose ends don't match the leg, in either orientation, and
// fall back to the straight line instead of drawing the bad geometry.
const MAX_ENDPOINT_DRIFT_MI = 6; // generous vs rail-node snapping (<1mi), tight vs a wrong city (30mi+)

export function polylineOrientation(
  track: LatLng[],
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): "forward" | "reverse" | null {
  if (track.length < 2) return null;
  const s = track[0];
  const e = track[track.length - 1];
  const f: LatLng = [from.lat, from.lng];
  const t: LatLng = [to.lat, to.lng];
  const tol = MAX_ENDPOINT_DRIFT_MI;
  if (haversineMi(s, f) <= tol && haversineMi(e, t) <= tol) return "forward";
  if (haversineMi(s, t) <= tol && haversineMi(e, f) <= tol) return "reverse";
  return null;
}

function fmtDuration(mins: number): string {
  if (mins <= 0) return "";
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m} min`;
}

/** Build a Journey, or null when fewer than one routable leg has coordinates. */
export function buildJourneyFromStops(
  sortedStops: StopForMap[],
  transitions: TransitionForMap[],
  meta: { id: string; eyebrow: string },
): Journey | null {
  if (sortedStops.length < 2) return null;
  const transitionByFrom = new Map(transitions.map((t) => [t.from_stop_id, t]));
  const legs: Leg[] = [];
  let totalMinutes = 0;
  let totalDistanceMi = 0;

  for (let i = 0; i < sortedStops.length - 1; i++) {
    const fromStop = sortedStops[i];
    const toStop = sortedStops[i + 1];
    const transition = transitionByFrom.get(fromStop.id);
    if (!transition) continue;

    const from = coordOf(fromStop);
    const to = coordOf(toStop);
    if (from.lat === 0 && from.lng === 0) continue;
    if (to.lat === 0 && to.lng === 0) continue;

    const fromStation: Station = { name: nameOf(fromStop), code: fromStop.transport_hub?.code ?? undefined, lat: from.lat, lng: from.lng };
    const toStation: Station = { name: nameOf(toStop), code: toStop.transport_hub?.code ?? undefined, lat: to.lat, lng: to.lng };

    // Default to the straight line; only trust a stored polyline whose ends
    // actually connect this leg's stops (guards against the phantom branch).
    const straight: LatLng[] = [[from.lat, from.lng], [to.lat, to.lng]];
    let track: LatLng[] = straight;
    if (transition.overview_polyline) {
      const decoded = decodePolyline(transition.overview_polyline);
      const orient = polylineOrientation(decoded, from, to);
      if (orient === "forward") track = decoded;
      else if (orient === "reverse") track = [...decoded].reverse();
    }

    const durationMins = transition.computed_duration_minutes ?? 0;
    totalMinutes += durationMins;
    for (let k = 1; k < track.length; k++) totalDistanceMi += haversineMi(track[k - 1], track[k]);

    legs.push({
      mode: MODE_MAP[transition.mode] ?? "road",
      from: fromStation,
      to: toStation,
      track,
      durationLabel: fmtDuration(durationMins),
      durationMinutes: durationMins || undefined,
    });
  }

  if (legs.length === 0) return null;

  // Direction: a leg is "back" when it brings you CLOSER to where the day started
  // (the base) than it began — i.e. you're heading home. This cleanly splits the
  // outbound half from the return without needing an explicit turnaround marker, so
  // the two can be coloured distinctly instead of overlapping as one line.
  const origin = legs[0].from;
  const distToOrigin = (lat: number, lng: number) =>
    haversineMi([lat, lng], [origin.lat, origin.lng]);
  for (const leg of legs) {
    const startD = distToOrigin(leg.from.lat, leg.from.lng);
    const endD = distToOrigin(leg.to.lat, leg.to.lng);
    leg.direction = endD < startD - 0.05 ? "back" : "out";
  }

  return {
    id: meta.id,
    eyebrow: meta.eyebrow,
    totalDistanceMi: Math.round(totalDistanceMi * 10) / 10,
    totalDurationLabel: fmtDuration(totalMinutes),
    legs,
  };
}
