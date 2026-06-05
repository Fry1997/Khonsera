// Insert-fact-by-time (P1.3) — pure core.
//
// Stops used to be appended with `max(sequence)+1`, which drops a new fact at
// the bottom of the list regardless of when it actually happens. A fact that
// occurs mid-morning belongs between the stops either side of it, not after
// everything. This finds the right sequence slot by `start_time` so the chain
// stays time-ordered, and names the two neighbours whose adjacency changed so
// the caller can scope its transition recompute to just them.
//
// Pure, no IO. The server action (`createStopAtTime` in actions/stops.ts) does
// the shift + insert + scoped recompute around this.

export type TimedStop = {
  id: string;
  sequence: number;
  start_time: string | null;
};

export type InsertionPlan = {
  // Sequence the new stop takes.
  sequence: number;
  // The neighbour that now precedes the new stop (null = new stop is first).
  beforeStopId: string | null;
  // The neighbour that now follows the new stop (null = new stop is last).
  afterStopId: string | null;
};

// Decide where a stop starting at `newStartTime` slots into an existing chain.
//
// We keep the canonical order = sequence order (that's what the UI renders and
// the solver walks). The new stop goes immediately before the first stop that
// (a) has a known start_time and (b) starts strictly after the new one. Stops
// with no start_time keep their place — we never reorder around an unknown
// time, we just don't let it push the new fact past a known later one.
export function planInsertionByTime(
  stops: readonly TimedStop[],
  newStartTime: string,
): InsertionPlan {
  const ordered = [...stops].sort((a, b) => a.sequence - b.sequence);
  const newMs = new Date(newStartTime).getTime();

  let insertIdx = ordered.length; // default: append at the end
  for (let i = 0; i < ordered.length; i++) {
    const t = ordered[i].start_time;
    if (t != null && new Date(t).getTime() > newMs) {
      insertIdx = i;
      break;
    }
  }

  const before = insertIdx > 0 ? ordered[insertIdx - 1] : null;
  const after = insertIdx < ordered.length ? ordered[insertIdx] : null;

  // Sequence to take: the follower's sequence (we shift it and everything
  // later up by one); or one past the last stop when appending.
  const sequence = after
    ? after.sequence
    : ordered.length > 0
      ? ordered[ordered.length - 1].sequence + 1
      : 0;

  return {
    sequence,
    beforeStopId: before?.id ?? null,
    afterStopId: after?.id ?? null,
  };
}
