// The day-of engine — the pure brain behind the live Today (docs/today-live-engine.md).
//
// Input: the threaded plan (fixed points in time order) + the live travel time
// from where you ARE to the next obligation + now. Output: one DayState the view
// renders thinly. Pure / deterministic — no GPS, no network, no IO — so the whole
// thing unit-tests. Position is reduced to one number by the caller (the live
// route seconds from current location to the next fixed point), keeping this
// layer free of geo + routing.

import { computeGaps, type Gap, type GapStop } from "@/lib/planning/gaps";

export type DayPhase = "at_rest" | "readiness" | "in_transit" | "arrived";

// The notification band for the next obligation — quiet → leave-now → cliff
// (the feasibility cliff, where the preferred mode no longer makes it).
export type FeasBand = "comfortable" | "heads_up" | "leave_now" | "cliff";

// A fixed point as the engine needs it. The view maps its richer SpineAnchor
// onto this; the engine stays free of UI types.
export interface EngineAnchor {
  id: string;
  startMs: number | null; // arrive-by / start
  endMs: number | null; // leave / end (defaults to startMs)
  plannedTravelMinutes: number | null; // planned travel INTO this anchor (fallback for leave-by)
  isStation?: boolean; // station boarding buffer vs a readiness buffer
  bufferMinutes?: number | null; // user/booking-specific preferred margin for this boundary
  notBeforeMs?: number | null; // a preceding fixed span may prohibit leaving before this time
  isBlockingSpan?: boolean; // a shift/fixed span that remains current until its end
}

export interface Feasibility {
  leaveByMs: number;
  slackMin: number; // minutes until you must leave (negative = overdue)
  bufferLeftMin: number; // real margin remaining if you left now
  band: FeasBand;
  travelMinutes: number;
  bufferMinutes: number; // real margin at the constrained leave time
  preferredBufferMinutes: number;
  constrainedByPrevious: boolean;
  source: "live" | "planned"; // live route from your position, or the plan's estimate
}

export interface DayState {
  phase: DayPhase;
  nextIndex: number | null; // index into the input anchors of the next obligation
  feasibility: Feasibility | null;
  gaps: Gap[];
}

// A rail departure should honour the user's expected platform-arrival margin.
// Fifteen minutes is the product default and matches travel_profiles defaults;
// individual boundaries can override it through EngineAnchor.bufferMinutes.
export const STATION_BUFFER_MIN = 15;
export const READINESS_BUFFER_MIN = 5;

function bufferFor(a: EngineAnchor): number {
  if (a.bufferMinutes != null && Number.isFinite(a.bufferMinutes)) {
    return Math.max(0, Math.round(a.bufferMinutes));
  }
  return a.isStation ? STATION_BUFFER_MIN : READINESS_BUFFER_MIN;
}

function endOf(a: EngineAnchor): number | null {
  return a.endMs ?? a.startMs;
}

// How long an obligation stays your "next" after its time passes. You don't
// silently "finish" something by the clock — if you haven't reached it you're
// just late TO it, and it should stay in front of you, not reel into the past.
// (Proper arrival-by-dwell / the skip fork supersede this heuristic later.)
export const LATE_GRACE_MIN = 60;

// The next obligation: the earliest fixed point not yet behind us. A blocking
// fixed span (for example a 09:00–17:00 shift) is current context, not somewhere
// the traveller still needs to get to once it has started. While that span is
// active, the engine advances to the first obligation after it; the following
// boundary carries notBeforeMs so its leave-by can never move the shift earlier.
export function pickNextIndex(anchors: EngineAnchor[], nowMs: number): number | null {
  for (let i = 0; i < anchors.length; i++) {
    const anchor = anchors[i];
    const start = anchor.startMs;
    const end = endOf(anchor);
    const activeBlockingSpan =
      anchor.isBlockingSpan === true &&
      start != null &&
      end != null &&
      start <= nowMs &&
      nowMs < end;
    if (activeBlockingSpan) continue;
    if (end != null && end >= nowMs) return i;
  }

  // Nothing ahead — but you may be running late to the most recent one (within
  // the grace), so keep it in front rather than calling the day done.
  const grace = LATE_GRACE_MIN * 60_000;
  for (let i = anchors.length - 1; i >= 0; i--) {
    const end = endOf(anchors[i]);
    if (end != null && end + grace >= nowMs) return i;
  }
  return null;
}

export function bandFor(slackMin: number, bufferLeftMin: number, preferredBufferMinutes = 0): FeasBand {
  if (bufferLeftMin < 0) return "cliff";
  if (slackMin <= 0) return "leave_now";
  if (bufferLeftMin < preferredBufferMinutes || slackMin <= 20) return "heads_up";
  return "comfortable";
}

export function computeDayState(input: { anchors: EngineAnchor[]; nowMs: number; liveTravelSeconds?: number | null }): DayState {
  const { anchors, nowMs } = input;

  // Gaps across the whole threaded chain. legMinutes[i] = travel stops[i]→[i+1],
  // which is the travel INTO anchor i+1.
  const gapStops: GapStop[] = anchors.map((a) => ({ id: a.id, startMs: a.startMs, endMs: endOf(a) }));
  const legMinutes = anchors.slice(1).map((a) => a.plannedTravelMinutes);
  const gaps = computeGaps(gapStops, legMinutes);

  const nextIndex = pickNextIndex(anchors, nowMs);
  if (nextIndex == null) {
    return { phase: anchors.length ? "arrived" : "at_rest", nextIndex: null, feasibility: null, gaps };
  }

  const next = anchors[nextIndex];
  const arriveByMs = next.startMs;
  const liveMin = input.liveTravelSeconds != null ? Math.max(1, Math.round(input.liveTravelSeconds / 60)) : null;
  const travelMin = liveMin ?? next.plannedTravelMinutes;

  if (arriveByMs == null || travelMin == null) {
    return { phase: "readiness", nextIndex, feasibility: null, gaps };
  }

  const preferredBuffer = bufferFor(next);
  const preferredLeaveByMs = arriveByMs - (travelMin + preferredBuffer) * 60_000;
  const notBeforeMs = next.notBeforeMs ?? Number.NEGATIVE_INFINITY;
  const leaveByMs = Math.max(preferredLeaveByMs, notBeforeMs);
  const constrainedByPrevious = leaveByMs > preferredLeaveByMs;

  const slackMin = Math.round((leaveByMs - nowMs) / 60_000);
  const bufferLeftMin = Math.floor((arriveByMs - nowMs) / 60_000) - travelMin;
  const bufferAtLeave = Math.floor((arriveByMs - leaveByMs) / 60_000) - travelMin;
  const realBuffer = Math.max(0, bufferAtLeave);
  const band = bandFor(slackMin, bufferLeftMin, preferredBuffer);

  return {
    phase: nowMs >= leaveByMs ? "in_transit" : "readiness",
    nextIndex,
    feasibility: {
      leaveByMs,
      slackMin,
      bufferLeftMin,
      band,
      travelMinutes: travelMin,
      bufferMinutes: realBuffer,
      preferredBufferMinutes: preferredBuffer,
      constrainedByPrevious,
      source: liveMin != null ? "live" : "planned",
    },
    gaps,
  };
}
