// Pure helpers for the travel-day view. Given a list of legs and "now", work
// out where the user should be. Keeps the page server-component-friendly
// (re-rendered on refresh, no client clock state machine needed).

export type Leg = {
  id: string;
  sequence: number;
  leg_type: string;
  start_location_name: string | null;
  end_location_name: string | null;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  distance_miles: number | null;
  instructions: string | null;
  provider: string | null;
  service_number: string | null;
};

export type LegPhase = "past" | "current" | "next" | "future";

export type LegWithPhase = Leg & {
  phase: LegPhase;
  startMs: number | null;
  endMs: number | null;
};

export function annotateLegs(legs: Leg[], now: Date): LegWithPhase[] {
  const ordered = [...legs].sort((a, b) => a.sequence - b.sequence);
  const nowMs = now.getTime();

  // Pass 1: compute past / future status from times alone.
  const annotated: LegWithPhase[] = ordered.map((l) => {
    const startMs = l.start_time ? Date.parse(l.start_time) : null;
    const endMs = l.end_time ? Date.parse(l.end_time) : null;
    let phase: LegPhase = "future";
    if (startMs != null && endMs != null) {
      if (endMs <= nowMs) phase = "past";
      else if (startMs <= nowMs && nowMs < endMs) phase = "current";
      else phase = "future";
    }
    return { ...l, phase, startMs, endMs };
  });

  // Pass 2: if no leg is "current" (gap between legs, or trip hasn't started)
  // mark the first future leg as "next" so the UI can highlight it.
  const hasCurrent = annotated.some((l) => l.phase === "current");
  if (!hasCurrent) {
    const firstFuture = annotated.find((l) => l.phase === "future");
    if (firstFuture) firstFuture.phase = "next";
  }

  return annotated;
}

export type TripPacing = {
  status: "before" | "on_track" | "running_late" | "complete";
  message: string;
  leaveByMs?: number;
  minutesUntilLeave?: number;
  minutesLate?: number;
};

// Heuristic pacing — "on track" means the current leg's end_time is in the
// future, "running late" means we're past a leg's end without the next being
// marked current. No real-time location, just a wall-clock heuristic.
export function pacing(legs: LegWithPhase[], now: Date): TripPacing {
  if (legs.length === 0) {
    return { status: "before", message: "No journey legs to follow yet." };
  }
  const nowMs = now.getTime();
  const first = legs[0];
  const last = legs[legs.length - 1];

  if (last.endMs != null && nowMs >= last.endMs) {
    return { status: "complete", message: "Journey window has finished." };
  }

  if (first.startMs != null && nowMs < first.startMs) {
    const minutesUntil = Math.round((first.startMs - nowMs) / 60_000);
    return {
      status: "before",
      message:
        minutesUntil > 60
          ? `Leave in ${Math.round(minutesUntil / 60)} h ${minutesUntil % 60} min`
          : `Leave in ${minutesUntil} min`,
      leaveByMs: first.startMs,
      minutesUntilLeave: minutesUntil,
    };
  }

  // Are we still inside a current leg? On track.
  const current = legs.find((l) => l.phase === "current");
  if (current) {
    return {
      status: "on_track",
      message: `On track${current.leg_type ? ` — ${current.leg_type}` : ""}`,
    };
  }

  // Past the last leg start but no current → between legs. If we're past the
  // next leg's start without it being marked current, we're late.
  const nextFuture = legs.find((l) => l.phase === "next" || l.phase === "future");
  if (nextFuture?.startMs != null && nowMs > nextFuture.startMs) {
    const lateMin = Math.round((nowMs - nextFuture.startMs) / 60_000);
    return {
      status: "running_late",
      message: `Running ${lateMin} min behind`,
      minutesLate: lateMin,
    };
  }
  return { status: "on_track", message: "On track" };
}
