// Event-aware ETA (Navigation N0 — the concierge ETA).
//
// Every other nav app answers "when will my car reach this POINT?". Ours answers
// "will I make my DAY, and by how much?" — arrival measured against a commitment's
// needed-by time and its comfort buffer (D77), re-derived live as position moves.
//
// Pure / deterministic / no I/O. The live position → "minutes from now to the
// commitment's place" is supplied by the caller (it comes from the guidance loop +
// downstream scheduled legs); this module turns that into the relationship the user
// actually cares about. Composes with src/lib/live/engine.ts (decisionClock /
// delayConsequence / cascade) and the comfort buffers — it does not duplicate them.

export type CommitmentInput = {
  id: string;
  name: string;
  place: string;
  neededByIso: string;   // the commitment's start / hard arrive-by
  bufferMin: number;     // how early you want to be (comfort buffer, D77)
  // Live door-to-door minutes from NOW to this commitment's place (active-leg
  // remaining + downstream legs). The caller derives this; see deriveMinutesFromNow.
  minutesFromNow: number;
};

export type EventETAState = "on_track" | "thinning" | "will_miss";

export type EventETA = {
  commitmentId: string;
  name: string;
  place: string;
  neededByIso: string;
  bufferMin: number;
  projectedArrivalIso: string; // now + minutesFromNow
  // How early you LAND before the commitment (negative = late). This is the D82
  // "spare" made live — the number the leg card shows, now moving in real time.
  spareMin: number;
  // Margin against your COMFORT (spare − buffer). ≥0 means you keep your cushion;
  // <0 means you'll make it but tighter than you like; «0 means you're late.
  slackMin: number;
  state: EventETAState;
};

export type DayProjection = {
  etas: EventETA[];
  // The first thing that breaks (or thins) — the connection to name in the surface.
  pinch: EventETA | null;
};

function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

function diffMinutes(aIso: string, bIso: string): number {
  return Math.round((new Date(aIso).getTime() - new Date(bIso).getTime()) / 60_000);
}

/** Project the live ETA + day-relationship for a single commitment. */
export function projectEventETA(nowIso: string, c: CommitmentInput): EventETA {
  const projectedArrivalIso = addMinutes(nowIso, Math.max(0, c.minutesFromNow));
  const spareMin = diffMinutes(c.neededByIso, projectedArrivalIso); // neededBy − arrival
  const slackMin = spareMin - c.bufferMin;
  const state: EventETAState =
    spareMin < 0 ? "will_miss" : spareMin < c.bufferMin ? "thinning" : "on_track";
  return {
    commitmentId: c.id,
    name: c.name,
    place: c.place,
    neededByIso: c.neededByIso,
    bufferMin: c.bufferMin,
    projectedArrivalIso,
    spareMin,
    slackMin,
    state,
  };
}

/**
 * Project the whole remaining day and surface the pinch — the first commitment that
 * breaks (earliest will_miss), else the thinnest non-on_track, else null. This is
 * what makes the ETA chip answer "will I make my day", not just the next point.
 */
export function projectDay(nowIso: string, commitments: CommitmentInput[]): DayProjection {
  const etas = commitments
    .map((c) => projectEventETA(nowIso, c))
    .sort((a, b) => new Date(a.neededByIso).getTime() - new Date(b.neededByIso).getTime());

  const misses = etas.filter((e) => e.state === "will_miss");
  const thinning = etas.filter((e) => e.state === "thinning");
  const pinch =
    misses[0] ?? // earliest break (already sorted by neededBy)
    [...thinning].sort((a, b) => a.slackMin - b.slackMin)[0] ?? // else the thinnest
    null;

  return { etas, pinch };
}

/**
 * Derive "minutes from now to the place" from the live guidance state of the ACTIVE
 * leg plus the scheduled minutes of any downstream legs before the commitment.
 *
 * activeLegRemainingMin: from the guidance loop (remaining distance ÷ live speed, or
 *   the route's remaining duration when speed is unknown).
 * downstreamMin: summed scheduled durations of legs between the active leg's end and
 *   the commitment, PLUS any known live delay on them.
 *
 * Kept pure + separate so it's testable without a GPS/route harness; the caller wires
 * the real guidance numbers in.
 */
export function deriveMinutesFromNow(input: {
  activeLegRemainingMin: number;
  downstreamMin?: number;
  downstreamDelayMin?: number;
}): number {
  return (
    Math.max(0, input.activeLegRemainingMin) +
    Math.max(0, input.downstreamMin ?? 0) +
    Math.max(0, input.downstreamDelayMin ?? 0)
  );
}
