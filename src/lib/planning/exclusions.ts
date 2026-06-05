// Profile + journey-level exclusions, wired into the ranker (P1.4).
//
// The user steers the engine by *removing* options, not by scoring them. Two
// layers of removal:
//
//   • Account level (travel_profile): "I won't walk more than 20 minutes",
//     "no taxi over £15", and `preferred_mode` as a soft recommendation hint
//     (handled by the ranker, not a hard filter — it never hides a faster
//     option, it only breaks ties).
//   • Journey level (itineraries.excluded_modes): "not the tube on this trip".
//
// This module is the hard-filter pass that runs *before* ranking: it strips
// the candidates the user has ruled out, returning what survives plus why the
// rest were dropped (so the UI can explain "hidden — over your taxi cap" under
// "show all"). Pure, no IO.
//
// It also reads time-bounded hard constraints out of `standing_facts`
// ("home by 18:00", "wake after 06:00") into a shape feasibility checks can
// consume — these gate journeys, they don't merely re-rank them.

import type { TravelModePreference } from "@/lib/types/domain";

export type ProfileExclusions = {
  preferredMode?: TravelModePreference | null;
  maxTaxiFarePence?: number | null;
  walkingThresholdMinutes?: number | null;
};

export type ExclusionContext = {
  profile?: ProfileExclusions | null;
  // itineraries.excluded_modes — per-journey mode IDs the user ruled out.
  journeyExcludedModes?: readonly string[] | null;
};

export type FilterableOption = {
  id: string;
  // Trip-level or leg-level mode label (e.g. "walk", "taxi", "rail").
  mode: string;
  // Longest single walking stretch in this option, minutes (for the walking
  // threshold). Null/absent = no walking leg to test.
  walkMinutes?: number | null;
  // Taxi fare for this option in pence (for the fare cap). Null/absent = not a
  // taxi option / no estimate.
  taxiFarePence?: number | null;
};

export type ExclusionReason =
  | "journey_excluded"
  | "over_taxi_cap"
  | "over_walking_threshold";

export type ExclusionResult<T extends FilterableOption> = {
  kept: T[];
  dropped: { option: T; reason: ExclusionReason }[];
};

// Run the hard-filter pass. Order of checks is stable so the dropped-reason is
// deterministic when more than one rule would fire.
export function applyExclusions<T extends FilterableOption>(
  options: T[],
  ctx: ExclusionContext = {},
): ExclusionResult<T> {
  const excluded = new Set(
    (ctx.journeyExcludedModes ?? []).map((m) => m.toLowerCase()),
  );
  const maxFare = ctx.profile?.maxTaxiFarePence ?? null;
  const walkCap = ctx.profile?.walkingThresholdMinutes ?? null;

  const kept: T[] = [];
  const dropped: { option: T; reason: ExclusionReason }[] = [];

  for (const opt of options) {
    if (excluded.has(opt.mode.toLowerCase())) {
      dropped.push({ option: opt, reason: "journey_excluded" });
      continue;
    }
    if (
      maxFare != null &&
      opt.taxiFarePence != null &&
      opt.taxiFarePence > maxFare
    ) {
      dropped.push({ option: opt, reason: "over_taxi_cap" });
      continue;
    }
    if (
      walkCap != null &&
      opt.mode.toLowerCase() === "walk" &&
      opt.walkMinutes != null &&
      opt.walkMinutes > walkCap
    ) {
      dropped.push({ option: opt, reason: "over_walking_threshold" });
      continue;
    }
    kept.push(opt);
  }

  return { kept, dropped };
}

// ── Standing-facts hard constraints ─────────────────────────────────────────

// A time-bounded hard constraint pulled out of standing_facts. `time` is the
// HH:MM clock value; the caller resolves it to an absolute Date on the trip
// day before handing it to the feasibility engine as latestReturnTime /
// earliestDepartTime.
export type StandingConstraint =
  | { kind: "home_by"; time: string }
  | { kind: "wake_after"; time: string };

// Shape of a standing_facts row this reader understands. `details` is the
// row's JSON column; we look for a `time` (HH:MM) inside it.
export type StandingFactRow = {
  fact_kind: string;
  active?: boolean | null;
  details?: unknown;
};

const HHMM = /^([01]?\d|2[0-3]):[0-5]\d$/;

function readTime(details: unknown): string | null {
  if (details && typeof details === "object" && "time" in details) {
    const t = (details as { time?: unknown }).time;
    if (typeof t === "string" && HHMM.test(t.trim())) return t.trim();
  }
  return null;
}

// Extract the hard time constraints the planner must honour. Inactive facts
// and facts without a parseable time are skipped (we don't gate on what we
// can't read). The two kinds the engine currently consumes are `home_by`
// (latest return) and `wake_after` (earliest departure).
export function readStandingConstraints(
  facts: readonly StandingFactRow[],
): StandingConstraint[] {
  const out: StandingConstraint[] = [];
  for (const f of facts) {
    if (f.active === false) continue;
    const time = readTime(f.details);
    if (!time) continue;
    if (f.fact_kind === "home_by") out.push({ kind: "home_by", time });
    else if (f.fact_kind === "wake_after")
      out.push({ kind: "wake_after", time });
  }
  return out;
}
