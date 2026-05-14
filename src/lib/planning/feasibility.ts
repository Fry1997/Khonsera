// Feasibility engine. Pure functions — no IO, no provider calls. Given a
// proposed appointment and the timing of the best outbound/return travel
// options, decide whether the visit is realistic and explain why.
//
// The engine produces a single verdict and an ordered list of reasons.
// Callers (UI, tests, ranking) read the verdict to decide what to render;
// the reasons feed both the "why" line on the result card and the suggested
// wording the user can send to the customer.

import type { FeasibilityStatus } from "@/lib/types/domain";
import { formatTimeInTz, minutesBetween } from "@/lib/types/time";

export type FeasibilityInput = {
  appointmentStart: Date;
  appointmentEnd: Date;
  arriveSiteAt: Date;
  leaveSiteAt: Date;
  arriveReturnLocationAt?: Date;
  latestReturnTime?: Date;
  arrivalBufferMinutes: number;
  returnBufferMinutes: number;
  timezone?: string; // for human-readable reasons
  // Optional calendar conflicts found in the outbound/return travel windows.
  conflictTitles?: string[];
};

export type FeasibilityReason =
  | { code: "arrival_after_appointment"; message: string; severity: "blocker" }
  | { code: "arrival_buffer_low"; message: string; severity: "minor" }
  | { code: "return_after_latest"; message: string; severity: "blocker" }
  | { code: "return_buffer_low"; message: string; severity: "minor" }
  | { code: "calendar_conflict"; message: string; severity: "major" };

export type FeasibilityVerdict = {
  status: FeasibilityStatus;
  reasons: FeasibilityReason[];
  // Plain-English line the user can paste/say to the customer.
  suggestedWording: string;
};

export function evaluateFeasibility(input: FeasibilityInput): FeasibilityVerdict {
  const tz = input.timezone ?? "Europe/London";
  const reasons: FeasibilityReason[] = [];

  // 1. Arrival before appointment (blocker if late).
  const bufferAtSite = minutesBetween(input.arriveSiteAt, input.appointmentStart);
  if (bufferAtSite < 0) {
    reasons.push({
      code: "arrival_after_appointment",
      severity: "blocker",
      message: `Earliest arrival is ${fmt(input.arriveSiteAt, tz)}, after the ${fmt(input.appointmentStart, tz)} start.`,
    });
  } else if (bufferAtSite < input.arrivalBufferMinutes) {
    reasons.push({
      code: "arrival_buffer_low",
      severity: "minor",
      message: `Only ${bufferAtSite} min buffer before the appointment (target ${input.arrivalBufferMinutes}).`,
    });
  }

  // 2. Return journey — only checked if the user gave a hard cap.
  if (input.latestReturnTime && input.arriveReturnLocationAt) {
    if (input.arriveReturnLocationAt > input.latestReturnTime) {
      reasons.push({
        code: "return_after_latest",
        severity: "blocker",
        message: `You'd be home at ${fmt(input.arriveReturnLocationAt, tz)}, past your ${fmt(input.latestReturnTime, tz)} return.`,
      });
    } else {
      const returnBuffer = minutesBetween(
        input.arriveReturnLocationAt,
        input.latestReturnTime,
      );
      if (returnBuffer < input.returnBufferMinutes) {
        reasons.push({
          code: "return_buffer_low",
          severity: "minor",
          message: `Only ${returnBuffer} min buffer before your latest return time.`,
        });
      }
    }
  }

  // 3. Calendar conflicts during travel/meeting windows.
  for (const title of input.conflictTitles ?? []) {
    reasons.push({
      code: "calendar_conflict",
      severity: "major",
      message: `Conflicts with: ${title}`,
    });
  }

  const status = rollUp(reasons);

  return {
    status,
    reasons,
    suggestedWording: buildSuggestedWording({
      status,
      input,
      tz,
    }),
  };
}

function rollUp(reasons: FeasibilityReason[]): FeasibilityStatus {
  if (reasons.some((r) => r.severity === "blocker")) return "not_possible";
  const major = reasons.filter((r) => r.severity === "major").length;
  const minor = reasons.filter((r) => r.severity === "minor").length;
  if (major >= 1) return "not_recommended";
  if (minor >= 2) return "not_recommended";
  if (minor === 1) return "tight";
  return "recommended";
}

function buildSuggestedWording({
  status,
  input,
  tz,
}: {
  status: FeasibilityStatus;
  input: FeasibilityInput;
  tz: string;
}): string {
  const start = fmt(input.appointmentStart, tz);
  const leave = fmt(input.leaveSiteAt, tz);
  const day = formatDay(input.appointmentStart, tz);

  switch (status) {
    case "recommended":
      return `${day} at ${start} works — I'd plan to stay until around ${leave} before heading back.`;
    case "tight":
      return `${day} at ${start} could work, but it's tight on either end. Happy to confirm if you're flexible by ~15 min on the day.`;
    case "not_recommended":
      return `${day} at ${start} would be risky — I'd want to push to a slightly later slot if that's possible.`;
    case "not_possible":
      return `${day} at ${start} I can't realistically make — would a later time on the same day or another day work?`;
  }
}

function fmt(d: Date, tz: string): string {
  return formatTimeInTz(d, tz);
}

function formatDay(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    timeZone: tz,
  }).format(d);
}
