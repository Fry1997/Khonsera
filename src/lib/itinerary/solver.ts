// Itinerary time solver.
//
// Given an ordered chain of stops and the transitions between them, propagate
// times outward from anchors (stops with is_time_fixed=true or locked
// transitions with both start/end set) so every other stop and transition
// gets a computed start/end.
//
// Pure / deterministic: takes plain rows in, returns plain rows out, no IO.
// Server-side use only — the caller writes the result back to the database.

export type SolverStop = {
  id: string;
  sequence: number;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  is_time_fixed: boolean;
  // Minutes you should ARRIVE before this stop's start (a station boarding
  // buffer). Applied when back-propagating INTO this stop: the previous stop's
  // leave time is pulled this much earlier, WITHOUT lengthening the leg — so the
  // buffer reads as slack in a wider window, not an inflated journey.
  arrival_buffer_minutes?: number;
};

export type SolverTransition = {
  id: string;
  from_stop_id: string;
  to_stop_id: string;
  start_time: string | null;
  end_time: string | null;
  computed_duration_minutes: number | null;
  is_locked: boolean;
};

export type SolverConflict = {
  kind: "stop_anchor_mismatch" | "transition_locked_mismatch";
  entityId: string;
  expected: string;
  actual: string;
};

export type SolverResult = {
  stops: SolverStop[];
  transitions: SolverTransition[];
  conflicts: SolverConflict[];
};

export function solveTimes(input: {
  stops: SolverStop[];
  transitions: SolverTransition[];
}): SolverResult {
  // Clone shallow so we can write computed fields without mutating callers.
  const stops = [...input.stops]
    .sort((a, b) => a.sequence - b.sequence)
    .map((s) => ({ ...s }));
  const tByFrom = new Map<string, SolverTransition>();
  for (const t of input.transitions) tByFrom.set(t.from_stop_id, { ...t });

  const conflicts: SolverConflict[] = [];

  // Helper: stop duration in minutes (default 0).
  const stopDur = (s: SolverStop) => s.duration_minutes ?? 0;

  // Anchor index: any stop with is_time_fixed AND a start_time, OR any with
  // a fully-known start+end window (e.g. an event with both fields).
  const anchorIdxs: number[] = [];
  for (let i = 0; i < stops.length; i++) {
    const s = stops[i];
    if (s.is_time_fixed && s.start_time) anchorIdxs.push(i);
  }
  // Also treat the first stop as a soft anchor only if it already has a
  // start_time (and is not pinned). We don't auto-anchor anything — the user
  // anchors what they care about.

  // Propagate from each anchor outward.
  for (const anchorIdx of anchorIdxs) {
    propagate(stops, tByFrom, anchorIdx, conflicts);
  }

  return {
    stops,
    transitions: Array.from(tByFrom.values()),
    conflicts,
  };

  // -- inner: walks forward and backward from a single anchor, filling
  //    start/end on every reachable stop+transition, stopping when it hits
  //    a missing transition.computed_duration_minutes or another anchor.
  function propagate(
    stops: SolverStop[],
    tByFrom: Map<string, SolverTransition>,
    anchorIdx: number,
    conflicts: SolverConflict[],
  ) {
    const anchor = stops[anchorIdx];
    if (!anchor.start_time) return;
    if (!anchor.end_time) {
      anchor.end_time = addMinutes(anchor.start_time, stopDur(anchor));
    }

    // Forward.
    for (let i = anchorIdx; i < stops.length - 1; i++) {
      const cur = stops[i];
      const next = stops[i + 1];
      const tr = tByFrom.get(cur.id);
      if (!tr) break;
      const trDur = tr.computed_duration_minutes;
      // Need either a duration or a locked window to advance.
      if (trDur == null && !tr.is_locked) break;
      if (!cur.end_time) break;
      const trStart = cur.end_time;
      const trEnd = trDur != null ? addMinutes(trStart, trDur) : tr.end_time;
      if (!trEnd) break;

      if (tr.is_locked && tr.start_time && tr.start_time !== trStart) {
        conflicts.push({
          kind: "transition_locked_mismatch",
          entityId: tr.id,
          expected: trStart,
          actual: tr.start_time,
        });
        // honour the lock.
      } else {
        tr.start_time = trStart;
      }
      tr.end_time = trEnd;

      // Next stop start = transition end.
      if (next.is_time_fixed && next.start_time && next.start_time !== trEnd) {
        conflicts.push({
          kind: "stop_anchor_mismatch",
          entityId: next.id,
          expected: trEnd,
          actual: next.start_time,
        });
        break; // honour the user's anchor; don't overwrite.
      }
      if (!next.is_time_fixed) next.start_time = trEnd;
      // For maximize stops (duration_minutes null, not fixed), don't set
      // end_time here — backward propagation from the next anchor will
      // fill it, giving the full available window.
      if (next.duration_minutes != null || next.is_time_fixed) {
        next.end_time = addMinutes(
          next.start_time ?? trEnd,
          stopDur(next),
        );
      }
    }

    // Backward.
    for (let i = anchorIdx; i > 0; i--) {
      const cur = stops[i];
      const prev = stops[i - 1];
      const tr = tByFrom.get(prev.id);
      if (!tr) break;
      const trDur = tr.computed_duration_minutes;
      if (trDur == null && !tr.is_locked) break;
      if (!cur.start_time) break;
      const trEnd = cur.start_time;
      // Leave the buffer earlier when arriving INTO a buffered stop (a station),
      // so the leg sits in a wider window with the buffer as slack.
      const buf = cur.arrival_buffer_minutes ?? 0;
      const trStart =
        trDur != null ? addMinutes(trEnd, -(trDur + buf)) : tr.start_time;
      if (!trStart) break;

      if (tr.is_locked && tr.end_time && tr.end_time !== trEnd) {
        conflicts.push({
          kind: "transition_locked_mismatch",
          entityId: tr.id,
          expected: trEnd,
          actual: tr.end_time,
        });
      } else {
        tr.end_time = trEnd;
      }
      tr.start_time = trStart;

      // Previous stop end = transition start; previous stop start = end - duration.
      // For maximize stops (no duration), set end_time from the backward pass
      // and keep start_time from the forward pass — this fills the full window.
      const prevEnd = trStart;
      const prevStart = prev.duration_minutes != null
        ? addMinutes(prevEnd, -stopDur(prev))
        : prev.start_time ?? addMinutes(prevEnd, 0);
      if (prev.is_time_fixed && prev.start_time && prev.start_time !== prevStart) {
        conflicts.push({
          kind: "stop_anchor_mismatch",
          entityId: prev.id,
          expected: prevStart,
          actual: prev.start_time,
        });
        break;
      }
      if (!prev.is_time_fixed) {
        prev.start_time = prevStart;
        prev.end_time = prevEnd;
      }
    }
  }
}

function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}
