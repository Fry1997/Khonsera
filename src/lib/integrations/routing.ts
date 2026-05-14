import { features } from "@/lib/features";
import { isDemoModeActive } from "@/lib/demo-mode";
import { getDirections, mapsApiKey } from "@/lib/google/maps";
import type { IntegrationResult, RouteRequest, RouteResult } from "./types";

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
