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
    expect(pickNextIndex(anchors, T("13:00"))).toBe(null); // whole day behind us
  });
});

describe("computeDayState — leave-by + bands", () => {
  it("back-calculates leave-by from arrive-by − travel − station buffer", () => {
    // next = Luton 10:00, planned 16 min + 8 buffer → leave by 09:36.
    const s = computeDayState({ anchors, nowMs: T("09:00") });
    expect(s.nextIndex).toBe(0);
    expect(s.feasibility?.source).toBe("planned");
    expect(new Date(s.feasibility!.leaveByMs).toISOString()).toBe("2026-06-11T09:36:00.000Z");
    expect(s.feasibility?.slackMin).toBe(36);
    expect(s.feasibility?.band).toBe("comfortable");
    expect(s.phase).toBe("readiness");
  });

  it("prefers the live route time over the plan when given", () => {
    // 6-min live walk overrides the 16-min plan → leave by 09:46.
    const s = computeDayState({ anchors, nowMs: T("09:00"), liveTravelSeconds: 6 * 60 });
    expect(s.feasibility?.source).toBe("live");
    expect(new Date(s.feasibility!.leaveByMs).toISOString()).toBe("2026-06-11T09:46:00.000Z");
  });

  it("walks through the bands as the window closes", () => {
    // leave-by 09:36. heads_up inside 20 min, leave_now at/after it, cliff once buffer gone.
    expect(computeDayState({ anchors, nowMs: T("09:20") }).feasibility?.band).toBe("heads_up");
    expect(computeDayState({ anchors, nowMs: T("09:36") }).feasibility?.band).toBe("leave_now");
    // buffer (8) erodes after leave-by; gone by 09:44 → cliff.
    expect(computeDayState({ anchors, nowMs: T("09:45") }).feasibility?.band).toBe("cliff");
  });

  it("goes in_transit once you're past leave-by", () => {
    expect(computeDayState({ anchors, nowMs: T("09:40") }).phase).toBe("in_transit");
  });

  it("is arrived when the day is behind you, at_rest when there's no plan", () => {
    expect(computeDayState({ anchors, nowMs: T("13:00") }).phase).toBe("arrived");
    expect(computeDayState({ anchors: [], nowMs: T("13:00") }).phase).toBe("at_rest");
  });

  it("surfaces the day's gaps alongside the next obligation", () => {
    // welly 11:00 → review 11:30 window is 30 min; 8-min leg leaves 22 spare ≥ 15.
    const s = computeDayState({ anchors, nowMs: T("09:00") });
    expect(s.gaps.some((g) => g.beforeStopId === "review" && g.spareMinutes === 22)).toBe(true);
  });
});
