import { describe, it, expect } from "vitest";
import { computeDayState, pickNextIndex, type EngineAnchor } from "./engine";

const T = (hhmm: string) => new Date(`2026-06-11T${hhmm}:00Z`).getTime();

// Home (base, no node) → Luton station 10:00 → Wellingborough 11:00 → review 11:30.
const anchors: EngineAnchor[] = [
  { id: "luton", startMs: T("10:00"), endMs: T("10:00"), plannedTravelMinutes: 16, isStation: true },
  { id: "welly", startMs: T("11:00"), endMs: T("11:00"), plannedTravelMinutes: 25, isStation: true },
  { id: "review", startMs: T("11:30"), endMs: T("12:30"), plannedTravelMinutes: 8 },
];

describe("pickNextIndex", () => {
  it("is the earliest fixed point still ahead", () => {
    expect(pickNextIndex(anchors, T("09:00"))).toBe(0);
    expect(pickNextIndex(anchors, T("10:30"))).toBe(1);
    expect(pickNextIndex(anchors, T("13:00"))).toBe(2); // review (12:30) still in front within the late grace
    expect(pickNextIndex(anchors, T("14:00"))).toBe(null); // past the grace → whole day behind us
  });

  it("skips an active fixed shift and advances to the first move after it", () => {
    const officeDay: EngineAnchor[] = [
      { id: "shift", startMs: T("09:00"), endMs: T("17:00"), plannedTravelMinutes: 9, isBlockingSpan: true },
      { id: "return-train", startMs: T("17:22"), endMs: T("17:22"), plannedTravelMinutes: 9, isStation: true, notBeforeMs: T("17:00") },
    ];
    expect(pickNextIndex(officeDay, T("12:00"))).toBe(1);
  });
});

describe("computeDayState — leave-by + bands", () => {
  it("back-calculates leave-by from arrive-by − travel − the default 15-minute rail buffer", () => {
    // next = Luton 10:00, planned 16 min + 15 buffer → leave by 09:29.
    const s = computeDayState({ anchors, nowMs: T("09:00") });
    expect(s.nextIndex).toBe(0);
    expect(s.feasibility?.source).toBe("planned");
    expect(s.feasibility?.bufferMinutes).toBe(15);
    expect(new Date(s.feasibility!.leaveByMs).toISOString()).toBe("2026-06-11T09:29:00.000Z");
    expect(s.feasibility?.slackMin).toBe(29);
    expect(s.feasibility?.band).toBe("comfortable");
    expect(s.phase).toBe("readiness");
  });

  it("calculates the real Wellingborough office-day leave-by", () => {
    const officeDay: EngineAnchor[] = [
      {
        id: "wellingborough-departure",
        startMs: T("07:25"),
        endMs: T("07:25"),
        plannedTravelMinutes: 47,
        isStation: true,
      },
    ];

    const s = computeDayState({ anchors: officeDay, nowMs: T("05:30") });
    expect(new Date(s.feasibility!.leaveByMs).toISOString()).toBe("2026-06-11T06:23:00.000Z");
  });

  it("honours a user-specific buffer on an individual boundary", () => {
    const custom: EngineAnchor[] = [
      { id: "train", startMs: T("10:00"), endMs: T("10:00"), plannedTravelMinutes: 20, isStation: true, bufferMinutes: 10 },
    ];
    const s = computeDayState({ anchors: custom, nowMs: T("09:00") });
    expect(s.feasibility?.bufferMinutes).toBe(10);
    expect(new Date(s.feasibility!.leaveByMs).toISOString()).toBe("2026-06-11T09:30:00.000Z");
  });

  it("never pulls a fixed shift earlier to satisfy a preferred rail buffer", () => {
    const officeDay: EngineAnchor[] = [
      { id: "shift", startMs: T("09:00"), endMs: T("17:00"), plannedTravelMinutes: 9, isBlockingSpan: true },
      {
        id: "return-train",
        startMs: T("17:22"),
        endMs: T("17:22"),
        plannedTravelMinutes: 9,
        isStation: true,
        bufferMinutes: 15,
        notBeforeMs: T("17:00"),
      },
    ];
    const s = computeDayState({ anchors: officeDay, nowMs: T("12:00") });
    expect(s.nextIndex).toBe(1);
    expect(new Date(s.feasibility!.leaveByMs).toISOString()).toBe("2026-06-11T17:00:00.000Z");
    expect(s.feasibility?.constrainedByPrevious).toBe(true);
    expect(s.feasibility?.preferredBufferMinutes).toBe(15);
    expect(s.feasibility?.bufferMinutes).toBe(13);
  });

  it("prefers the live route time over the plan when given", () => {
    // 6-min live walk overrides the 16-min plan → leave by 09:39.
    const s = computeDayState({ anchors, nowMs: T("09:00"), liveTravelSeconds: 6 * 60 });
    expect(s.feasibility?.source).toBe("live");
    expect(new Date(s.feasibility!.leaveByMs).toISOString()).toBe("2026-06-11T09:39:00.000Z");
  });

  it("walks through the bands as the window closes", () => {
    // leave-by 09:29. heads_up inside 20 min, leave_now at/after it, cliff once no margin remains.
    expect(computeDayState({ anchors, nowMs: T("09:20") }).feasibility?.band).toBe("heads_up");
    expect(computeDayState({ anchors, nowMs: T("09:29") }).feasibility?.band).toBe("leave_now");
    expect(computeDayState({ anchors, nowMs: T("09:45") }).feasibility?.band).toBe("cliff");
  });

  it("goes in_transit once you're past leave-by", () => {
    expect(computeDayState({ anchors, nowMs: T("09:40") }).phase).toBe("in_transit");
  });

  it("is arrived when the day is behind you, at_rest when there's no plan", () => {
    expect(computeDayState({ anchors, nowMs: T("14:00") }).phase).toBe("arrived");
    expect(computeDayState({ anchors: [], nowMs: T("14:00") }).phase).toBe("at_rest");
  });

  it("surfaces the day's gaps alongside the next obligation", () => {
    // welly 11:00 → review 11:30 window is 30 min; 8-min leg leaves 22 spare ≥ 15.
    const s = computeDayState({ anchors, nowMs: T("09:00") });
    expect(s.gaps.some((g) => g.beforeStopId === "review" && g.spareMinutes === 22)).toBe(true);
  });
});
