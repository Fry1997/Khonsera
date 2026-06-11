import { describe, it, expect } from "vitest";
import { computeLeaveBy, leaveByCountdown, leaveByUrgency, DEFAULT_BUFFER_MIN } from "./leave-by";

const T = (hhmm: string) => new Date(`2026-06-11T${hhmm}:00Z`).getTime();

describe("computeLeaveBy", () => {
  it("subtracts travel + buffer from the arrive-by time", () => {
    // Arrive by 10:00, 18 min travel, 5 min buffer → leave by 09:37.
    const r = computeLeaveBy(T("10:00"), 18 * 60, T("09:00"), 5);
    expect(r.travelMinutes).toBe(18);
    expect(r.bufferMinutes).toBe(5);
    expect(r.leaveByIso).toBe("2026-06-11T09:37:00.000Z");
    expect(r.minutesUntilLeave).toBe(37);
    expect(r.urgency).toBe("comfortable");
  });

  it("uses the default buffer when none is given", () => {
    const r = computeLeaveBy(T("10:00"), 0, T("09:00"));
    expect(r.bufferMinutes).toBe(DEFAULT_BUFFER_MIN);
    // No travel, 5 min buffer → leave by 09:55.
    expect(r.leaveByIso).toBe("2026-06-11T09:55:00.000Z");
  });

  it("flags urgent inside 15 minutes and breach once overdue", () => {
    const urgent = computeLeaveBy(T("10:00"), 40 * 60, T("09:10"), 5); // leave 09:15, now 09:10 → 5 min
    expect(urgent.urgency).toBe("urgent");

    const breach = computeLeaveBy(T("10:00"), 40 * 60, T("09:30"), 5); // leave 09:15, now 09:30 → -15
    expect(breach.minutesUntilLeave).toBe(-15);
    expect(breach.urgency).toBe("breach");
  });
});

describe("leaveByUrgency thresholds", () => {
  it("is comfortable beyond 15 min, urgent within, breach below zero", () => {
    expect(leaveByUrgency(16)).toBe("comfortable");
    expect(leaveByUrgency(15)).toBe("urgent");
    expect(leaveByUrgency(0)).toBe("urgent");
    expect(leaveByUrgency(-1)).toBe("breach");
  });
});

describe("leaveByCountdown", () => {
  it("reads naturally across the range", () => {
    expect(leaveByCountdown(0)).toBe("Leave now");
    expect(leaveByCountdown(8)).toBe("Leave in 8 min");
    expect(leaveByCountdown(75)).toBe("Leave in 1h 15m");
    expect(leaveByCountdown(-3)).toBe("3 min overdue");
  });
});
