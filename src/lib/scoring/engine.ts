// scoreLeg — pure function over per-leg candidates + scoring context.
// Returns a Resolution describing the winner, the survivors, and the
// filtered-out candidates with their reasons.
//
// This is the keystone of the planning + live re-scoring loop: both
// the pre-plan UI and the mid-trip suggestion gate call this same
// function, so the two never contradict each other. Anything that
// changes the answer (weights, lookup tables, filter thresholds)
// lives here or in weights.json.

import weightsJson from "./weights.json";
import type {
  CandidateInput,
  FilteredCandidate,
  FilterReason,
  Luggage,
  ModeCandidate,
  Resolution,
  ScoredCandidate,
  ScoringContext,
  TripPurpose,
  WeightProfile,
} from "./types";

const WEIGHTS = weightsJson as Record<TripPurpose, WeightProfile>;

// The +15% multiplier on the preferred-mode candidate. Soft thumb on
// the scale — flips ties and close calls toward the preference, but
// a clearly-better alternative still wins.
const PREFERRED_BIAS = 1.15;

export function scoreLeg(
  candidates: CandidateInput[],
  ctx: ScoringContext,
): Resolution {
  // Resolution order, per the spec:
  //   1. User override set → use it. Skip scoring.
  //   2. Else if all previews settled → score, return winner.
  //   3. Else → 'resolving'.
  if (ctx.userOverride) {
    return resolveOverride(candidates, ctx.userOverride);
  }

  // Any pending candidate → resolving. Don't compute partial answers
  // that flip when the late preview arrives.
  if (candidates.some((c) => c.pending)) {
    return {
      state: "resolving",
      winner: null,
      ranked: [],
      filtered: [],
    };
  }

  // Step 1 — hard filters.
  const evaluated = candidates.map((c) => evaluateFilter(c, ctx));
  const survivors = evaluated.filter(
    (e): e is { input: CandidateInput; filterReason: null } =>
      e.filterReason === null,
  );
  const filtered: FilteredCandidate[] = evaluated
    .filter(
      (e): e is FilteredCandidate => e.filterReason !== null,
    );

  if (survivors.length === 0) {
    // Distinguish "no data" (e.g. all unavailable) from "no survivors"
    // (e.g. all would be late). The picker copy differs.
    const allNoData = filtered.every((f) => f.filterReason === "no_data");
    return {
      state: allNoData ? "no_data" : "no_survivors",
      winner: null,
      ranked: [],
      filtered,
    };
  }

  // Determine whether the cost dimension is meaningful at all. If
  // taxi survived but has no cost data (real Uber API failed), the
  // spec says drop the cost dim and re-normalise the remaining
  // weights to sum to 1.0. The MVP stub always returns a cost, so
  // this branch only fires in the real-API future, but worth
  // codifying now.
  const taxiSurvivor = survivors.find((s) => s.input.mode === "taxi");
  const dropCost =
    taxiSurvivor != null && taxiSurvivor.input.costEstimatePence == null;

  // Steps 2–4 — score, weight, preferred bias.
  const weights = adjustedWeights(ctx.tripPurpose, dropCost);
  const fastestDuration = Math.min(
    ...survivors.map((s) => s.input.durationSeconds ?? Infinity),
  );

  const scored: ScoredCandidate[] = survivors.map((s) => {
    const time = scoreTime(s.input.durationSeconds, fastestDuration);
    const cost = scoreCost(
      s.input.mode,
      s.input.costEstimatePence,
      ctx.maxTaxiFarePence,
    );
    const effort = scoreEffort(
      s.input.mode,
      s.input.durationSeconds,
      ctx.luggage,
    );
    const risk = scoreRisk(s.input.arrivalBufferSeconds);

    const base =
      weights.time * time +
      weights.cost * cost +
      weights.effort * effort +
      weights.risk * risk;
    const preferredBoostApplied =
      ctx.preferredMode !== "no_preference" &&
      ctx.preferredMode === s.input.mode;
    const total = preferredBoostApplied ? base * PREFERRED_BIAS : base;

    return {
      mode: s.input.mode,
      total,
      scores: { time, cost, effort, risk },
      preferredBoostApplied,
      filterReason: null,
      explanation: "", // filled in after sorting
      input: s.input,
    };
  });

  // Step 5 — rank, then fill in explanations relative to the field.
  scored.sort((a, b) => b.total - a.total);
  for (let i = 0; i < scored.length; i++) {
    scored[i].explanation = explanationFor(scored[i], scored, ctx);
  }

  return {
    state: scored.length === 1 ? "single_candidate" : "resolved",
    winner: scored[0],
    ranked: scored,
    filtered,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Override path — bypasses scoring, returns the user's pick as a
// minimal Resolution. We still echo back the other candidates as
// filtered=[] / ranked=[that one] so the picker can render
// alternatives, but their scores aren't computed.
// ─────────────────────────────────────────────────────────────────────
function resolveOverride(
  candidates: CandidateInput[],
  override: ModeCandidate,
): Resolution {
  const match = candidates.find((c) => c.mode === override);
  if (!match) {
    // Override mode isn't in the candidate set (shouldn't happen in
    // practice — the override comes from the same picker). Treat as
    // resolving so the UI doesn't show stale data.
    return { state: "resolving", winner: null, ranked: [], filtered: [] };
  }
  const winner: ScoredCandidate = {
    mode: override,
    total: 100,
    scores: { time: 100, cost: 100, effort: 100, risk: 100 },
    preferredBoostApplied: false,
    filterReason: null,
    explanation: "Your override",
    input: match,
  };
  return {
    state: "resolved_override",
    winner,
    ranked: [winner],
    filtered: [],
  };
}

// ─────────────────────────────────────────────────────────────────────
// Filters
// ─────────────────────────────────────────────────────────────────────
function evaluateFilter(
  c: CandidateInput,
  ctx: ScoringContext,
): { input: CandidateInput; filterReason: FilterReason | null } {
  if (c.durationSeconds == null) {
    return { input: c, filterReason: "no_data" };
  }
  if (c.arrivalBufferSeconds < 0) {
    return { input: c, filterReason: "would_be_late" };
  }
  if (
    c.mode === "walk" &&
    c.durationSeconds > ctx.walkingThresholdMinutes * 60
  ) {
    return { input: c, filterReason: "walk_exceeds_threshold" };
  }
  return { input: c, filterReason: null };
}

// ─────────────────────────────────────────────────────────────────────
// Dimension scores
// ─────────────────────────────────────────────────────────────────────
function scoreTime(
  durationSeconds: number | null,
  fastest: number,
): number {
  if (durationSeconds == null || fastest <= 0) return 0;
  return Math.round(100 * (fastest / durationSeconds));
}

function scoreCost(
  mode: ModeCandidate,
  costPence: number | null,
  maxTaxiFare: number,
): number {
  if (mode === "walk" || mode === "drive") return 100;
  // taxi
  if (costPence == null) {
    // Unknown — we shouldn't be scoring this dimension on this
    // candidate (the caller should have dropped the cost weight).
    // Return 0 defensively so a bug here doesn't silently push taxi
    // into the lead.
    return 0;
  }
  if (costPence <= maxTaxiFare) return 100;
  if (costPence <= maxTaxiFare * 1.5) return 60;
  if (costPence <= maxTaxiFare * 2.5) return 25;
  return 5;
}

function scoreEffort(
  mode: ModeCandidate,
  durationSeconds: number | null,
  luggage: Luggage,
): number {
  if (mode === "taxi") return 95;
  if (mode === "drive") return 85;
  // walk
  const mins = (durationSeconds ?? 0) / 60;
  let base: number;
  if (mins < 10) base = 90;
  else if (mins < 20) base = 60;
  else if (mins < 30) base = 30;
  else base = 10;
  const luggageHit =
    luggage === "heavy" ? 25 : luggage === "light" ? 10 : 0;
  return Math.max(0, base - luggageHit);
}

function scoreRisk(arrivalBufferSeconds: number): number {
  const mins = arrivalBufferSeconds / 60;
  if (mins < 5) return 20;
  if (mins < 15) return 70;
  if (mins < 30) return 95;
  return 85; // > 30 min — slightly penalised for being absurdly early
}

// ─────────────────────────────────────────────────────────────────────
// Weight adjustment when the cost dimension is unscoreable.
// ─────────────────────────────────────────────────────────────────────
function adjustedWeights(
  tripPurpose: TripPurpose,
  dropCost: boolean,
): WeightProfile {
  const base = WEIGHTS[tripPurpose];
  if (!dropCost) return base;
  const remaining = base.time + base.effort + base.risk;
  if (remaining === 0) return base;
  return {
    time: base.time / remaining,
    cost: 0,
    effort: base.effort / remaining,
    risk: base.risk / remaining,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Picker-facing explanation copy.
// ─────────────────────────────────────────────────────────────────────
function explanationFor(
  c: ScoredCandidate,
  field: ScoredCandidate[],
  ctx: ScoringContext,
): string {
  // Winner: lean on the dimension that won. Pick the dimension whose
  // contribution to total is the highest among the four.
  const weights = WEIGHTS[ctx.tripPurpose];
  const contributions: Array<{ name: string; value: number }> = [
    { name: "Fastest", value: weights.time * c.scores.time },
    { name: "Cheapest", value: weights.cost * c.scores.cost },
    { name: "Lowest effort", value: weights.effort * c.scores.effort },
    { name: "Safest arrival", value: weights.risk * c.scores.risk },
  ];
  if (c === field[0]) {
    const top = contributions.reduce((a, b) =>
      a.value >= b.value ? a : b,
    );
    return top.name;
  }
  // Non-winners: highlight what's holding them back.
  if (c.mode === "taxi" && c.input.costEstimatePence != null) {
    if (c.input.costEstimatePence > ctx.maxTaxiFarePence) {
      const overshoot =
        ((c.input.costEstimatePence - ctx.maxTaxiFarePence) /
          ctx.maxTaxiFarePence) *
        100;
      return overshoot < 100
        ? `Above your £${(ctx.maxTaxiFarePence / 100).toFixed(0)} taxi limit`
        : `Well above your taxi limit`;
    }
  }
  if (c.mode === "walk" && c.input.durationSeconds != null) {
    const mins = c.input.durationSeconds / 60;
    if (mins > 20) return "Longer walk";
  }
  return "Slower";
}
