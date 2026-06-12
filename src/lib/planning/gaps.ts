// The gap engine — step one: the genuine spare time between fixed points.
//
// Once the day is threaded (solveTimes), the time between an occupied stop and
// the next one is split into TRAVEL (the leg) and what's left over. That
// left-over is rested time — an asset, not a void. This pure function finds it;
// the layers above turn a gap into "what can you do" (the unplanned-time radius)
// and let you drop something into it.
//
// Pure / deterministic — no IO, no routing. It takes a threaded chain (stops in
// sequence with resolved start/end times) plus the travel minutes of each leg.

export interface GapStop {
  id: string;
  title?: string;
  startMs: number | null; // resolved arrival/start
  endMs: number | null; // resolved leave/end (defaults to startMs if absent)
}

export interface Gap {
  afterStopId: string; // the stop you're free after
  beforeStopId: string; // the stop you must be at next
  // Genuine free minutes once the leg's travel is taken out of the window.
  spareMinutes: number;
  windowStartMs: number; // earliest you're free (you leave `after`)
  windowEndMs: number; // when you must be at `before`
  travelMinutes: number; // the leg eating into the window
}

// Find the spare-time pockets in a threaded chain. `legMinutes[i]` is the travel
// from stops[i] → stops[i+1] (null = unknown → treated as 0, so we never invent
// spare time we can't justify... actually unknown travel could hide a gap, so we
// surface it but flag travel as 0; callers can re-check once routed).
export function computeGaps(stops: GapStop[], legMinutes: Array<number | null>, minSpareMinutes = 15): Gap[] {
  const gaps: Gap[] = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    const leaveA = a.endMs ?? a.startMs;
    const arriveBy = b.startMs;
    if (leaveA == null || arriveBy == null) continue;

    const windowMin = Math.round((arriveBy - leaveA) / 60_000);
    if (windowMin <= 0) continue;

    const travel = Math.max(0, Math.round(legMinutes[i] ?? 0));
    const spare = windowMin - travel;
    if (spare < minSpareMinutes) continue;

    gaps.push({
      afterStopId: a.id,
      beforeStopId: b.id,
      spareMinutes: spare,
      windowStartMs: leaveA,
      windowEndMs: arriveBy,
      travelMinutes: travel,
    });
  }
  return gaps;
}

// Total genuinely free minutes across the day — the "what could I actually do
// with today" number.
export function totalSpareMinutes(gaps: Gap[]): number {
  return gaps.reduce((sum, g) => sum + g.spareMinutes, 0);
}
