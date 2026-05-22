// Per-leg feasibility — given when the executive can leave one
// anchor and when they need to arrive at the next, plus how long the
// chosen mode takes, does it actually fit?
//
// Three outcomes:
//   • ok      — comfortable, leave at fromEnd, arrive with buffer
//   • tight   — fits, but with less than bufferMinutes of slack
//   • late    — won't fit; the executive arrives after toStart
//
// 'unknown' covers every missing-data case — we don't flag what we
// can't compute. Callers can treat unknown as "stay quiet" and pinch
// to the inline flags only when the data is present.
//
// Pure / no I/O / no time-of-day awareness. Callers are responsible
// for converting their native time representations (ISO strings,
// anchor date+time pairs, etc.) into Date objects before calling.

export type Feasibility =
  | { state: "ok" }
  | { state: "tight"; slackMinutes: number; message: string }
  | { state: "late"; shortMinutes: number; message: string }
  | { state: "unknown" };

export type FeasibilityInput = {
  fromEnd: Date | null;
  toStart: Date | null;
  travelMinutes: number | null;
  // Below this many minutes of slack we flag 'tight'. Defaults to 10
  // — matches the editor's previous in-line hard-coded value.
  bufferMinutes?: number;
};

export function checkLegFeasibility(input: FeasibilityInput): Feasibility {
  const buffer = input.bufferMinutes ?? 10;
  if (!input.fromEnd || !input.toStart || input.travelMinutes == null) {
    return { state: "unknown" };
  }
  const required = input.travelMinutes;
  if (required <= 0) return { state: "ok" };
  const gapMins =
    (input.toStart.getTime() - input.fromEnd.getTime()) / 60_000;
  if (gapMins <= 0) {
    return {
      state: "late",
      shortMinutes: Math.ceil(required - gapMins),
      message: `Needs ~${required}m, no gap between fixed times`,
    };
  }
  if (required > gapMins) {
    return {
      state: "late",
      shortMinutes: Math.ceil(required - gapMins),
      message: `Needs ${required}m in a ${Math.round(gapMins)}m window`,
    };
  }
  if (required + buffer > gapMins) {
    const slack = Math.round(gapMins - required);
    return {
      state: "tight",
      slackMinutes: slack,
      message: `${slack}m of slack`,
    };
  }
  return { state: "ok" };
}
