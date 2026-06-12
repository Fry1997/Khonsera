import { describe, it, expect } from "vitest";
import { computeGaps, totalSpareMinutes, type GapStop } from "./gaps";

const T = (hhmm: string) => new Date(`2026-06-11T${hhmm}:00Z`).getTime();

const stops: GapStop[] = [
  { id: "a", title: "Dentist", startMs: T("09:00"), endMs: T("09:30") },
  { id: "b", title: "Leicester station", startMs: T("11:00"), endMs: T("11:00") },
  { id: "c", title: "Meeting", startMs: T("11:20"), endMs: T("12:00") },
];

describe("computeGaps", () => {
  it("surfaces spare time once travel is taken out of the window", () => {
    // a→b window is 90 min; a 30-min leg leaves 60 min spare.
    const gaps = computeGaps(stops, [30, 8]);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({ afterStopId: "a", beforeStopId: "b", spareMinutes: 60, travelMinutes: 30 });
  });

  it("ignores windows where travel leaves less than the minimum spare", () => {
    // b→c window is 20 min; an 8-min leg leaves 12 — below the 15 default.
    const gaps = computeGaps(stops, [30, 8]);
    expect(gaps.find((g) => g.beforeStopId === "c")).toBeUndefined();
  });

  it("treats unknown travel as zero (surfaces the window to be re-checked once routed)", () => {
    const gaps = computeGaps(stops, [null, 8]);
    expect(gaps[0].spareMinutes).toBe(90);
    expect(gaps[0].travelMinutes).toBe(0);
  });

  it("skips pairs with no resolved times", () => {
    const partial: GapStop[] = [
      { id: "x", startMs: null, endMs: null },
      { id: "y", startMs: T("10:00"), endMs: null },
    ];
    expect(computeGaps(partial, [10])).toEqual([]);
  });

  it("totals the genuinely free minutes across the day", () => {
    const gaps = computeGaps(stops, [30, 8]);
    expect(totalSpareMinutes(gaps)).toBe(60);
  });
});
