// Multi-category operator disambiguation (brief §10 / Layer-3 header heuristic).
// A word like "by" carries several categories; the engine picks one by inspecting
// what follows it: a place → narrower; a time → positioner; a mode noun →
// method_marker; a duration+event → time_proximity; an event ref → positioner.

import type { OperatorCategory, Dictionary } from "@/lib/dictionary/dictionary";

export type FollowingKind =
  | "time"
  | "place"
  | "mode"
  | "duration"
  | "event"
  | "unknown";

// Classify the token following an operator, using the dictionary (mode nouns are
// concept words of transport fact-types) plus simple shape hints.
export function classifyFollowing(
  word: string,
  dict: Dictionary,
  hints: { isTime?: boolean; isDuration?: boolean; isDate?: boolean } = {},
): FollowingKind {
  if (hints.isDuration) return "duration";
  if (hints.isTime) return "time";
  const lower = word.toLowerCase();
  const factType = dict.conceptIndex.get(lower);
  const MODE_TYPES = new Set([
    "train_journey",
    "flight_journey",
    "bus_journey",
    "coach_journey",
    "ferry_journey",
    "taxi_journey",
    "driving_leg",
    "walking_leg",
  ]);
  if (factType && MODE_TYPES.has(factType)) return "mode";
  if (/^[A-Z]/.test(word)) return "place";
  return "unknown";
}

// Resolve one category from the candidates given what follows.
export function disambiguateOperator(
  categories: OperatorCategory[],
  following: FollowingKind,
): OperatorCategory {
  if (categories.length === 1) return categories[0];

  const prefer = (c: OperatorCategory): OperatorCategory | null =>
    categories.includes(c) ? c : null;

  switch (following) {
    case "mode":
      return prefer("method_marker") ?? categories[0];
    case "place":
      // "via <place>" with a known destination → route; else an intermediate stop.
      return prefer("narrower") ?? prefer("journey_breaker") ?? prefer("method_marker") ?? categories[0];
    case "time":
      return prefer("positioner") ?? prefer("time_proximity") ?? categories[0];
    case "duration":
      return prefer("time_proximity") ?? prefer("positioner") ?? categories[0];
    case "event":
      return prefer("positioner") ?? categories[0];
    default:
      // No signal — prefer the interpretation that builds a more complete fact.
      return prefer("narrower") ?? prefer("positioner") ?? categories[0];
  }
}
