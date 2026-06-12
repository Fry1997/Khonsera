// True leave-by — when to actually walk out the door for the next anchor, from
// real travel time (distance via the nav router, or the plan's computed leg as
// fallback) plus a get-ready buffer. Pure, so it unit-tests without GPS.
//
//   leaveBy = arriveBy − travelTime − buffer
//
// The old "leave by" on Today was just the next stop's start time (i.e. the
// arrive-by), which is not when to leave at all. This is.

export type LeaveByUrgency = "comfortable" | "urgent" | "breach";

export interface LeaveByResult {
  leaveByMs: number;
  leaveByIso: string;
  travelMinutes: number;
  bufferMinutes: number;
  // From `now`: minutes until you must leave. Negative = you should have left.
  minutesUntilLeave: number;
  urgency: LeaveByUrgency;
}

// A short readiness buffer — coat, keys, the walk to the door. Distinct from
// travel time; tunable per anchor later (readiness back-calc, spine §4).
export const DEFAULT_BUFFER_MIN = 5;

export function leaveByUrgency(minutesUntilLeave: number): LeaveByUrgency {
  if (minutesUntilLeave < 0) return "breach";
  if (minutesUntilLeave <= 15) return "urgent";
  return "comfortable";
}

export function computeLeaveBy(
  arriveByMs: number,
  travelSeconds: number,
  nowMs: number,
  bufferMinutes: number = DEFAULT_BUFFER_MIN,
): LeaveByResult {
  const travelMinutes = Math.round(travelSeconds / 60);
  const leaveByMs = arriveByMs - travelSeconds * 1000 - bufferMinutes * 60_000;
  const minutesUntilLeave = Math.round((leaveByMs - nowMs) / 60_000);
  return {
    leaveByMs,
    leaveByIso: new Date(leaveByMs).toISOString(),
    travelMinutes,
    bufferMinutes,
    minutesUntilLeave,
    urgency: leaveByUrgency(minutesUntilLeave),
  };
}

// A fixed-departure mode (a lift collecting you at a set time) flips the
// question: not "when do I leave" but "is this pickup workable". Same arithmetic
// the other way round — used in PLANNING as you set the pickup (validate live)
// and in LIVE to show the arranged lift's standing. `mustArriveByMs` already
// folds in any platform/check-in readiness at the destination.
export interface PickupCheck {
  arrivalMs: number; // when this pickup gets you to the fixed point
  slackMin: number; // minutes spare on arrival (negative = late)
  feasible: boolean;
  latestPickupMs: number; // the latest pickup that still makes it
  minutesLate: number; // 0 when feasible, else how late you'd be
}

export function checkPickup(pickupMs: number, travelSeconds: number, mustArriveByMs: number): PickupCheck {
  const arrivalMs = pickupMs + travelSeconds * 1000;
  const slackMin = Math.round((mustArriveByMs - arrivalMs) / 60_000);
  return {
    arrivalMs,
    slackMin,
    feasible: arrivalMs <= mustArriveByMs,
    latestPickupMs: mustArriveByMs - travelSeconds * 1000,
    minutesLate: slackMin < 0 ? -slackMin : 0,
  };
}

// "Leave now" / "Leave in 8 min" / "Left 3 min ago" — the human countdown.
export function leaveByCountdown(minutesUntilLeave: number): string {
  if (minutesUntilLeave <= 0 && minutesUntilLeave > -1) return "Leave now";
  if (minutesUntilLeave < 0) return `${Math.abs(minutesUntilLeave)} min overdue`;
  if (minutesUntilLeave < 1) return "Leave now";
  if (minutesUntilLeave < 60) return `Leave in ${minutesUntilLeave} min`;
  const h = Math.floor(minutesUntilLeave / 60);
  const m = minutesUntilLeave % 60;
  return `Leave in ${h}h ${String(m).padStart(2, "0")}m`;
}
