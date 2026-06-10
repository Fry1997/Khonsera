// Today projection (planner master brief §8). Today is NOT a separate screen
// with its own data — it is the plan seen through "now". This pure function
// selects which of the four states is active from current time vs the plan, so
// the same model renders as the live day. Engine-driven, never user-picked.

export type TodayState = "dormant" | "readiness" | "in-transit" | "arrived";
export type TodayUrgency = "comfortable" | "urgent" | "breach";

export type ProjectionStop = {
  id: string;
  title: string;
  start: string | null; // ISO
  end?: string | null; // ISO
  hasLegAfter?: boolean; // a transition exists from this stop to the next
};

export type TodayProjection = {
  state: TodayState;
  urgency: TodayUrgency;
  // index into the stops array for the "current" stop, when applicable
  currentIndex: number | null;
  nextIndex: number | null;
  leaveByIso: string | null; // readiness: when to leave
};

function ms(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

function sameDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

// Urgency from minutes-until-leave (readiness) or until the next move.
function urgencyFor(minutesUntil: number | null): TodayUrgency {
  if (minutesUntil == null) return "comfortable";
  if (minutesUntil < 0) return "breach";
  if (minutesUntil <= 20) return "urgent";
  return "comfortable";
}

export function projectToday(stops: ProjectionStop[], nowMs: number): TodayProjection {
  const timed = stops
    .map((s, i) => ({ s, i, start: ms(s.start), end: ms(s.end) ?? ms(s.start) }))
    .filter((x): x is { s: ProjectionStop; i: number; start: number; end: number } => x.start != null);

  if (timed.length === 0) {
    return { state: "dormant", urgency: "comfortable", currentIndex: null, nextIndex: null, leaveByIso: null };
  }

  const first = timed[0];
  const last = timed[timed.length - 1];

  // Before the day starts.
  if (nowMs < first.start) {
    if (sameDay(nowMs, first.start)) {
      const minutesUntil = Math.round((first.start - nowMs) / 60000);
      return {
        state: "readiness",
        urgency: urgencyFor(minutesUntil),
        currentIndex: null,
        nextIndex: first.i,
        leaveByIso: first.s.start,
      };
    }
    return { state: "dormant", urgency: "comfortable", currentIndex: null, nextIndex: first.i, leaveByIso: null };
  }

  // After the day ends.
  if (nowMs > last.end) {
    return { state: "dormant", urgency: "comfortable", currentIndex: last.i, nextIndex: null, leaveByIso: null };
  }

  // Within the day: find the current stop (latest start <= now) and the next.
  let curPos = 0;
  for (let p = 0; p < timed.length; p++) {
    if (timed[p].start <= nowMs) curPos = p;
    else break;
  }
  const cur = timed[curPos];
  const next = timed[curPos + 1];

  // Between this stop and the next → in transit (mid-leg) if travel is needed.
  if (next && nowMs < next.start) {
    const inLeg = cur.end != null && nowMs >= cur.end && cur.s.hasLegAfter;
    if (inLeg) {
      const minutesUntilArrive = Math.round((next.start - nowMs) / 60000);
      return {
        state: "in-transit",
        urgency: urgencyFor(minutesUntilArrive),
        currentIndex: cur.i,
        nextIndex: next.i,
        leaveByIso: null,
      };
    }
    // Still at the current anchor, the next move ahead.
    const minutesUntilNext = Math.round((next.start - nowMs) / 60000);
    return {
      state: "arrived",
      urgency: urgencyFor(minutesUntilNext),
      currentIndex: cur.i,
      nextIndex: next.i,
      leaveByIso: cur.s.end ?? null,
    };
  }

  // At the last/active anchor, nothing ahead.
  return { state: "arrived", urgency: "comfortable", currentIndex: cur.i, nextIndex: null, leaveByIso: null };
}
