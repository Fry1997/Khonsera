import { features } from "@/lib/features";
import { isDemoModeActive } from "@/lib/demo-mode";
import { haversineMeters } from "@/lib/geo";
import {
  getDirections,
  mapsApiKey,
  type DirectionsStep,
  type LatLng,
} from "@/lib/google/maps";
import type { IntegrationResult, RouteRequest, RouteResult } from "./types";
import type { TransitionMode, LegType } from "@/lib/types/domain";

// Extra fields beyond the IntegrationResult contract that real callers
// (planning, the map widget) want. Kept optional so the stub return path
// still matches.
type EnrichedRoute = RouteResult & {
  overviewPolyline?: string;
};

export async function getRoute(
  req: RouteRequest,
): Promise<IntegrationResult<EnrichedRoute>> {
  // Real Google Directions when GOOGLE_MAPS_API_KEY is set. We don't gate
  // this behind features.routingLive — the presence of the key is the
  // implicit feature flag.
  if (mapsApiKey() && req.mode === "drive") {
    const dir = await getDirections({
      origin: req.origin,
      destination: req.destination,
      mode: "driving",
      arrivalTime: req.arriveBy,
      departureTime: req.departAt,
    });
    if (dir) {
      const minutes = Math.round(dir.durationSeconds / 60);
      const miles = dir.distanceMeters / 1609.344;
      // Anchor times to arriveBy when provided, departAt otherwise, then
      // now.
      let start: Date;
      let end: Date;
      if (req.arriveBy) {
        end = req.arriveBy;
        start = new Date(end.getTime() - minutes * 60_000);
      } else if (req.departAt) {
        start = req.departAt;
        end = new Date(start.getTime() + minutes * 60_000);
      } else {
        start = new Date();
        end = new Date(start.getTime() + minutes * 60_000);
      }
      return {
        mode: "live",
        data: {
          legs: [
            {
              type: "drive",
              startName:
                typeof req.origin === "string" ? req.origin : dir.startAddress,
              endName:
                typeof req.destination === "string"
                  ? req.destination
                  : dir.endAddress,
              startTime: start,
              endTime: end,
              durationMinutes: minutes,
              distanceMiles: miles,
              instructions: "Live Google Directions.",
            },
          ],
          totalDurationMinutes: minutes,
          totalDistanceMiles: miles,
          overviewPolyline: dir.overviewPolyline,
        },
      };
    }
    // If the real call failed, fall through to demo/unavailable rather
    // than throwing.
  }

  if (features.routingLive) {
    return { mode: "unavailable", reason: "Live routing not yet implemented" };
  }

  if (await isDemoModeActive()) {
    return { mode: "demo", demo: true, data: mockRoute(req) };
  }

  return {
    mode: "unavailable",
    reason:
      "Routing provider not connected. Set GOOGLE_MAPS_API_KEY to enable live journey planning.",
  };
}

// ---- Transition-mode routing
// Higher-level entry point used by the itinerary editor: takes our
// TransitionMode (walk/drive/taxi/bus/tube/train/mixed), maps to a Google
// Directions mode, and returns enough sub-step detail to populate
// journey_legs for the transition.

export type TransitionStep = {
  sequence: number;
  legType: LegType;
  startName: string;
  endName: string;
  startTime?: string; // ISO
  endTime?: string;
  durationMinutes: number;
  distanceMiles?: number;
  serviceNumber?: string; // e.g. "Bus 24", "Northern Line"
  instructions?: string;
  // For potential map rendering of just this sub-leg.
  polyline?: string;
};

export type TransitionRoute = {
  totalDurationMinutes: number;
  totalDistanceMiles?: number;
  overviewPolyline?: string;
  steps: TransitionStep[];
};

function googleModeFor(
  mode: TransitionMode,
): "driving" | "walking" | "transit" | null {
  switch (mode) {
    case "walk":
      return "walking";
    case "drive":
    case "taxi":
      return "driving";
    case "bus":
    case "tube":
    case "train":
    case "mixed":
      return "transit";
    case "flight":
      return null; // handled by booking flow, not Maps
  }
}

function vehicleToLegType(vehicleType: string): LegType {
  const v = vehicleType.toUpperCase();
  if (v.includes("BUS")) return "bus";
  if (v.includes("SUBWAY") || v.includes("METRO_RAIL") || v.includes("TRAM"))
    return "train"; // closest enum value we have
  if (v.includes("RAIL") || v.includes("HEAVY_RAIL") || v.includes("MONORAIL"))
    return "train";
  return "train";
}

function stepToTransitionStep(
  s: DirectionsStep,
  sequence: number,
): TransitionStep {
  const minutes = Math.round(s.durationSeconds / 60);
  const miles = s.distanceMeters / 1609.344;
  if (s.travelMode === "WALKING") {
    return {
      sequence,
      legType: "walk",
      startName: stripHtml(s.htmlInstructions ?? "") || "Walk",
      endName: "",
      durationMinutes: minutes,
      distanceMiles: miles,
      instructions: stripHtml(s.htmlInstructions ?? ""),
      polyline: s.polyline,
    };
  }
  if (s.travelMode === "TRANSIT" && s.transit) {
    return {
      sequence,
      legType: vehicleToLegType(s.transit.vehicleType),
      startName: s.transit.departureStop,
      endName: s.transit.arrivalStop,
      startTime: s.transit.departureTime,
      endTime: s.transit.arrivalTime,
      durationMinutes: minutes,
      serviceNumber:
        s.transit.line + (s.transit.headsign ? ` → ${s.transit.headsign}` : ""),
      instructions: stripHtml(s.htmlInstructions ?? ""),
      polyline: s.polyline,
    };
  }
  // DRIVING / BICYCLING / fallback.
  return {
    sequence,
    legType: "drive",
    startName: stripHtml(s.htmlInstructions ?? "") || "Drive",
    endName: "",
    durationMinutes: minutes,
    distanceMiles: miles,
    instructions: stripHtml(s.htmlInstructions ?? ""),
    polyline: s.polyline,
  };
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "").trim();
}

export async function routeForTransition(args: {
  mode: TransitionMode;
  origin: LatLng;
  destination: LatLng;
  arriveBy?: Date;
  departAt?: Date;
}): Promise<TransitionRoute | null> {
  const gmode = googleModeFor(args.mode);

  // No live routing provider (or an unroutable mode like flight) → fall back to
  // a straight-line estimate from the coordinates, so a leg ALWAYS has a sensible
  // door-to-door time + distance. Without this every walk/taxi came back null and
  // the day read as "arrive immediately" with no geography between points.
  if (!mapsApiKey() || !gmode) {
    return haversineRoute(args.mode, args.origin, args.destination);
  }

  const dir = await getDirections({
    origin: args.origin,
    destination: args.destination,
    mode: gmode,
    arrivalTime: args.arriveBy,
    departureTime: args.departAt,
  });
  if (!dir) return haversineRoute(args.mode, args.origin, args.destination);

  const totalMinutes = Math.round(dir.durationSeconds / 60);
  const totalMiles = dir.distanceMeters / 1609.344;

  // For drive / walk Google returns a long list of turn-by-turn maneuvers
  // which is too noisy for the timeline. Collapse them into a single step.
  // For transit, keep each step (walk → bus → walk → train …).
  let steps: TransitionStep[];
  const isTransit = gmode === "transit";
  if (isTransit) {
    steps = dir.steps.map((s, i) => stepToTransitionStep(s, i));
  } else {
    steps = [
      {
        sequence: 0,
        legType: gmode === "walking" ? "walk" : args.mode === "taxi" ? "taxi" : "drive",
        startName: dir.startAddress,
        endName: dir.endAddress,
        durationMinutes: totalMinutes,
        distanceMiles: totalMiles,
        instructions: gmode === "walking" ? "Walk" : "Drive",
      },
    ];
  }

  return {
    totalDurationMinutes: totalMinutes,
    totalDistanceMiles: gmode === "walking" || isTransit ? undefined : totalMiles,
    overviewPolyline: dir.overviewPolyline,
    steps,
  };
}

// Straight-line door-to-door estimate when no live provider is available.
// Conservative average speeds (km/h) + a detour factor (real paths are longer
// than the crow flies). Locked/booked legs ignore this — they keep booked times.
const MODE_KMH: Record<TransitionMode, number> = {
  walk: 4.8,
  taxi: 28,
  drive: 32,
  bus: 18,
  tube: 26,
  train: 90,
  flight: 700,
  mixed: 28,
};
const DETOUR_FACTOR = 1.3;

function haversineRoute(mode: TransitionMode, origin: LatLng, destination: LatLng): TransitionRoute | null {
  if (
    origin == null || destination == null ||
    !Number.isFinite(origin.lat) || !Number.isFinite(origin.lng) ||
    !Number.isFinite(destination.lat) || !Number.isFinite(destination.lng)
  ) {
    return null;
  }
  const meters = haversineMeters(origin.lat, origin.lng, destination.lat, destination.lng) * DETOUR_FACTOR;
  const miles = meters / 1609.344;
  const kmh = MODE_KMH[mode] ?? 25;
  const minutes = Math.max(1, Math.round((meters / 1000 / kmh) * 60));
  const legType: LegType =
    mode === "walk" ? "walk" : mode === "taxi" ? "taxi" : mode === "drive" ? "drive"
      : mode === "train" ? "train" : mode === "bus" ? "bus" : "wait";
  return {
    totalDurationMinutes: minutes,
    totalDistanceMiles: miles,
    steps: [
      {
        sequence: 0,
        legType,
        startName: "",
        endName: "",
        durationMinutes: minutes,
        distanceMiles: miles,
        instructions: "Estimated from distance",
      },
    ],
  };
}

function mockRoute(req: RouteRequest): EnrichedRoute {
  const start = req.departAt ?? new Date();
  const baseMinutes = req.mode === "drive" ? 168 : req.mode === "walk" ? 14 : 162;
  const end = new Date(start.getTime() + baseMinutes * 60_000);
  return {
    legs: [
      {
        type: req.mode === "drive" ? "drive" : req.mode === "walk" ? "walk" : "train",
        startName: typeof req.origin === "string" ? req.origin : "Origin",
        endName:
          typeof req.destination === "string" ? req.destination : "Destination",
        startTime: start,
        endTime: end,
        durationMinutes: baseMinutes,
        distanceMiles: req.mode === "drive" ? 178 : undefined,
        instructions: "Demo mode — mock route data.",
      },
    ],
    totalDurationMinutes: baseMinutes,
    totalDistanceMiles: req.mode === "drive" ? 178 : undefined,
  };
}
