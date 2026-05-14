import { features } from "@/lib/features";
import { isDemoModeActive } from "@/lib/demo-mode";
import type {
  IntegrationResult,
  RailJourney,
  RailJourneyRequest,
} from "./types";

export async function findRailJourneys(
  req: RailJourneyRequest,
): Promise<IntegrationResult<RailJourney[]>> {
  if (features.railTimetableLive) {
    return { mode: "unavailable", reason: "Live rail timetable not yet implemented" };
  }
  if (await isDemoModeActive()) {
    return { mode: "demo", demo: true, data: mockJourneys(req) };
  }
  return {
    mode: "unavailable",
    reason: "Rail timetable provider not connected.",
  };
}

function mockJourneys(req: RailJourneyRequest): RailJourney[] {
  const anchor = req.departAt ?? req.arriveBy ?? new Date();
  return [0, 60, 120].map((offsetMin) => {
    const departAt = new Date(anchor.getTime() + offsetMin * 60_000);
    const arriveAt = new Date(departAt.getTime() + 152 * 60_000);
    return {
      departStation: req.originStation,
      arriveStation: req.destinationStation,
      departAt,
      arriveAt,
      durationMinutes: 152,
      changes: 1,
      estimatedPrice: 84.2,
      serviceNumbers: ["EMR-1A23", "XC-9F12"],
    };
  });
}
