// Sort TravelOption candidates so the UI can pick the recommended one and
// show the rest in order. Pure: takes the option set plus the user's mode
// preference and returns a new array.
//
// Ordering rules, in priority:
//   1. Feasibility status: recommended > tight > not_recommended > not_possible
//   2. Mode preference: if the user prefers rail/drive, that mode beats the
//      other at the same feasibility tier
//   3. Total cost (lower = better)
//   4. Total duration (shorter = better)

import type {
  FeasibilityStatus,
  TravelModePreference,
} from "@/lib/types/domain";

export type RankableOption = {
  id: string;
  mode: "rail" | "drive" | "mixed";
  feasibilityStatus: FeasibilityStatus;
  totalCostEstimate?: number | null;
  totalDurationMinutes?: number | null;
};

const FEASIBILITY_RANK: Record<FeasibilityStatus, number> = {
  recommended: 0,
  tight: 1,
  not_recommended: 2,
  not_possible: 3,
};

export function rankOptions<T extends RankableOption>(
  options: T[],
  preference: TravelModePreference = "compare",
): T[] {
  return [...options].sort((a, b) => {
    // 1. Feasibility tier.
    const f = FEASIBILITY_RANK[a.feasibilityStatus] - FEASIBILITY_RANK[b.feasibilityStatus];
    if (f !== 0) return f;

    // 2. Mode preference. compare/mixed = no preference applied here.
    if (preference === "rail" || preference === "drive") {
      const aMatch = a.mode === preference ? 0 : 1;
      const bMatch = b.mode === preference ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
    }

    // 3. Cost (treat null as "unknown, worse than any known").
    const ac = a.totalCostEstimate ?? Number.POSITIVE_INFINITY;
    const bc = b.totalCostEstimate ?? Number.POSITIVE_INFINITY;
    if (ac !== bc) return ac - bc;

    // 4. Duration.
    const ad = a.totalDurationMinutes ?? Number.POSITIVE_INFINITY;
    const bd = b.totalDurationMinutes ?? Number.POSITIVE_INFINITY;
    return ad - bd;
  });
}

export function pickRecommended<T extends RankableOption>(
  options: T[],
  preference: TravelModePreference = "compare",
): T | null {
  if (options.length === 0) return null;
  return rankOptions(options, preference)[0] ?? null;
}
