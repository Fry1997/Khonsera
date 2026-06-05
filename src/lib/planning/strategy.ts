// Trip-level travel strategy (P2.5) — the JourneyMode chip's engine.
//
// At the trip level the user picks a *strategy*: take the train the whole
// trip, or drive it, or mix. Each strategy is a composed door-to-door journey
// (outbound + return folded together) — so this is the same composite ranking
// from P1.1 applied at trip scope. The chip surfaces the top two with their
// totals and a few pros; the user steers, the engine recommends.
//
// Pure, no IO. The caller builds one DoorToDoorJourney per viable strategy
// (id = the strategy name) from real leg data and hands them in.

import type { TravelStrategy, TravelModePreference } from "@/lib/types/domain";
import {
  rankDoorToDoor,
  type DoorToDoorJourney,
  type ComposedJourney,
} from "./door-to-door";

// Static pros per strategy (v1 — templated phrasing, not computed). The brief
// is explicit these can be fixed strings keyed on the strategy's properties.
const STRATEGY_PROS: Record<TravelStrategy, string[]> = {
  rail: ["Work on the way", "No parking to find", "Skip the traffic"],
  drive: ["Door-to-door", "Leave when you like", "Carry what you like"],
  mixed: ["Flexible", "Park-and-ride the busy bit"],
};

export type StrategySummary = {
  strategy: TravelStrategy;
  totalDurationMinutes: number;
  totalCostEstimate: number | null;
  // True for the engine's top pick, so the UI can mark the recommendation.
  recommended: boolean;
  pros: string[];
};

function isStrategy(mode: string): mode is TravelStrategy {
  return mode === "rail" || mode === "drive" || mode === "mixed";
}

function toSummary(j: ComposedJourney, recommended: boolean): StrategySummary {
  const strategy: TravelStrategy = isStrategy(j.mode) ? j.mode : "mixed";
  return {
    strategy,
    totalDurationMinutes: j.totalDurationMinutes ?? 0,
    totalCostEstimate: j.totalCostEstimate ?? null,
    recommended,
    pros: STRATEGY_PROS[strategy],
  };
}

// Rank the strategies (fastest viable first, per door-to-door rules) and
// return the top `limit` as summaries. The first is flagged `recommended`.
export function evaluateStrategies(
  journeys: DoorToDoorJourney[],
  preference: TravelModePreference = "compare",
  limit = 2,
): StrategySummary[] {
  const ranked = rankDoorToDoor(journeys, preference);
  return ranked
    .slice(0, limit)
    .map((j, i) => toSummary(j, i === 0));
}

// The engine's single recommended strategy, or null when there are no viable
// journeys. Used to seed itineraries.travel_strategy when the user hasn't
// chosen one yet.
export function recommendedStrategy(
  journeys: DoorToDoorJourney[],
  preference: TravelModePreference = "compare",
): TravelStrategy | null {
  const top = evaluateStrategies(journeys, preference, 1)[0];
  return top?.strategy ?? null;
}
