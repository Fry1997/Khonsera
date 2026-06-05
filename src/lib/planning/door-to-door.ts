// Composite door-to-door ranking (P1.1).
//
// A journey is rarely one resource. "Rail to Derby" is really: taxi to the
// station + train + walk to the brewery. The old ranker compared whole
// options on a single duration/cost it was handed; it had no way to *build*
// that total from first-mile + main + last-mile sub-legs, and no notion of
// the time lost at each connection.
//
// This module composes a chain of legs into one RankableOption-shaped total,
// folding in the mode-specific connection buffers from `buffers.ts`. Rank the
// composed journeys with `rankOptions` and the fastest door-to-door wins —
// which is the brief's core ranking rule.
//
// Pure, no IO. Callers fetch leg durations/costs (routing.ts, rail.ts) and
// hand the plain legs in.

import type {
  FeasibilityStatus,
  TransitionMode,
  TravelModePreference,
} from "@/lib/types/domain";
import type { RankableOption } from "./ranking";
import { connectionBufferMinutes } from "./buffers";

// Feasibility tiers, best first — door-to-door ranking still honours these
// above raw speed (a faster-but-not-recommended journey loses to a slower
// recommended one), matching `ranking.ts`.
const FEASIBILITY_RANK: Record<FeasibilityStatus, number> = {
  recommended: 0,
  tight: 1,
  not_recommended: 2,
  not_possible: 3,
};

// One sub-leg of a door-to-door journey (first-mile, main, last-mile, …).
export type JourneyLeg = {
  mode: TransitionMode;
  durationMinutes: number;
  costEstimate?: number | null;
};

// A candidate journey before composition: an ordered chain of legs plus the
// trip-level descriptor used for ranking + the recommendation hint.
export type DoorToDoorJourney = {
  id: string;
  // Trip-level mode the ranker reasons about (rail vs drive vs mixed).
  mode: "rail" | "drive" | "mixed";
  legs: JourneyLeg[];
  // Optional pre-computed feasibility — defaults to "recommended" so a bare
  // journey still ranks. Callers that ran the feasibility engine pass it in.
  feasibilityStatus?: FeasibilityStatus;
};

// The composed result: a RankableOption (so it drops straight into
// `rankOptions`) plus the buffer total and per-leg breakdown for the UI.
export type ComposedJourney = RankableOption & {
  legs: JourneyLeg[];
  connectionBufferMinutes: number;
  travelMinutes: number; // sum of leg durations, before buffers
};

// Sum a chain of legs into one door-to-door total. Duration = leg time +
// the connection buffer between each adjacent pair. Cost = sum of known leg
// costs (null when no leg carried a cost, so the ranker treats it as unknown
// rather than free).
export function composeDoorToDoor(
  journey: DoorToDoorJourney,
): ComposedJourney {
  const legs = journey.legs;
  const travelMinutes = legs.reduce((sum, l) => sum + l.durationMinutes, 0);

  let buffer = 0;
  for (let i = 1; i < legs.length; i++) {
    buffer += connectionBufferMinutes(legs[i - 1].mode, legs[i].mode);
  }

  const knownCosts = legs
    .map((l) => l.costEstimate)
    .filter((c): c is number => c != null);
  const totalCostEstimate =
    knownCosts.length > 0
      ? knownCosts.reduce((sum, c) => sum + c, 0)
      : null;

  return {
    id: journey.id,
    mode: journey.mode,
    feasibilityStatus: journey.feasibilityStatus ?? "recommended",
    totalDurationMinutes: travelMinutes + buffer,
    totalCostEstimate,
    legs,
    connectionBufferMinutes: buffer,
    travelMinutes,
  };
}

// Compose every journey, then rank the totals. Unlike `rankOptions` (which
// breaks ties on cost first), door-to-door ranking sorts on *speed* — the
// brief's core rule: "Ranking is by door-to-door speed." Order of keys:
//   1. Feasibility tier (recommended > tight > … )
//   2. Preferred-mode hint (only nudges between equal tiers — never hides a
//      faster option, just settles ties)
//   3. Door-to-door duration (faster wins)
//   4. Cost (cheaper wins) as the final tiebreak
export function rankDoorToDoor(
  journeys: DoorToDoorJourney[],
  preference: TravelModePreference = "compare",
): ComposedJourney[] {
  return [...journeys.map(composeDoorToDoor)].sort((a, b) => {
    const f =
      FEASIBILITY_RANK[a.feasibilityStatus] -
      FEASIBILITY_RANK[b.feasibilityStatus];
    if (f !== 0) return f;

    if (preference === "rail" || preference === "drive") {
      const am = a.mode === preference ? 0 : 1;
      const bm = b.mode === preference ? 0 : 1;
      if (am !== bm) return am - bm;
    }

    const ad = a.totalDurationMinutes ?? Number.POSITIVE_INFINITY;
    const bd = b.totalDurationMinutes ?? Number.POSITIVE_INFINITY;
    if (ad !== bd) return ad - bd;

    const ac = a.totalCostEstimate ?? Number.POSITIVE_INFINITY;
    const bc = b.totalCostEstimate ?? Number.POSITIVE_INFINITY;
    return ac - bc;
  });
}

export function recommendedDoorToDoor(
  journeys: DoorToDoorJourney[],
  preference: TravelModePreference = "compare",
): ComposedJourney | null {
  if (journeys.length === 0) return null;
  return rankDoorToDoor(journeys, preference)[0] ?? null;
}
