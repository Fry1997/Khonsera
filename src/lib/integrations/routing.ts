import { features } from "@/lib/features";
import { isDemoModeActive } from "@/lib/demo-mode";
import type { IntegrationResult, RouteRequest, RouteResult } from "./types";

export async function getRoute(
  req: RouteRequest,
): Promise<IntegrationResult<RouteResult>> {
  if (features.routingLive) {
    // TODO: real provider call (Google Maps / Mapbox).
    return { mode: "unavailable", reason: "Live routing not yet implemented" };
  }

  if (await isDemoModeActive()) {
    return { mode: "demo", demo: true, data: mockRoute(req) };
  }

  return {
    mode: "unavailable",
    reason:
      "Routing provider not connected. Connect a maps API in settings to enable journey planning.",
  };
}

function mockRoute(req: RouteRequest): RouteResult {
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
