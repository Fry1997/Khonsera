// Feasibility engine — pure functions. Takes a visit plan and travel options
// and produces a verdict. Stays pure so it's easy to test and reuse on the
// server or in client previews. Real integration data feeds in via the
// integrations layer; this module never calls providers directly.

import type { FeasibilityStatus } from "@/lib/types/domain";

export type FeasibilityInput = {
  appointmentStart: Date;
  appointmentEnd: Date;
  arriveSiteAt: Date;
  leaveSiteAt: Date;
  latestReturnTime?: Date;
  arriveReturnLocationAt?: Date;
  arrivalBufferMinutes: number;
  returnBufferMinutes: number;
};

export type FeasibilityVerdict = {
  status: FeasibilityStatus;
  reasons: string[];
};

export function evaluateFeasibility(input: FeasibilityInput): FeasibilityVerdict {
  const reasons: string[] = [];

  const bufferAtSite = minutesBetween(input.arriveSiteAt, input.appointmentStart);
  if (bufferAtSite < 0) {
    return {
      status: "not_possible",
      reasons: [
        `Earliest arrival is ${formatTime(input.arriveSiteAt)}, after the ${formatTime(input.appointmentStart)} start.`,
      ],
    };
  }
  if (bufferAtSite < input.arrivalBufferMinutes) {
    reasons.push(
      `Only ${bufferAtSite} min buffer before appointment (target ${input.arrivalBufferMinutes}).`,
    );
  }

  if (
    input.latestReturnTime &&
    input.arriveReturnLocationAt &&
    input.arriveReturnLocationAt > input.latestReturnTime
  ) {
    return {
      status: "not_possible",
      reasons: [
        `Return arrival ${formatTime(input.arriveReturnLocationAt)} is after your latest return ${formatTime(input.latestReturnTime)}.`,
      ],
    };
  }

  if (
    input.latestReturnTime &&
    input.arriveReturnLocationAt &&
    minutesBetween(input.arriveReturnLocationAt, input.latestReturnTime) <
      input.returnBufferMinutes
  ) {
    reasons.push("Return buffer is tight.");
  }

  if (reasons.length === 0) return { status: "recommended", reasons: [] };
  if (reasons.length === 1) return { status: "tight", reasons };
  return { status: "not_recommended", reasons };
}

function minutesBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 60_000);
}

function formatTime(d: Date) {
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
