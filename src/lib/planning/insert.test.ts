import { describe, expect, it } from "vitest";
import { planInsertionByTime, type TimedStop } from "./insert";

const t = (id: string, sequence: number, start_time: string | null): TimedStop => ({
  id,
  sequence,
  start_time,
});

// A simple day: home 08:00, appointment 10:00, home 17:00.
const chain = [
  t("home-out", 0, "2026-06-03T07:00:00.000Z"),
  t("appt", 1, "2026-06-03T09:00:00.000Z"),
  t("home-back", 2, "2026-06-03T16:00:00.000Z"),
];

describe("planInsertionByTime", () => {
  it("slots a mid-morning fact between the stops either side of it", () => {
    const plan = planInsertionByTime(chain, "2026-06-03T08:00:00.000Z");
    expect(plan.beforeStopId).toBe("home-out");
    expect(plan.afterStopId).toBe("appt");
    expect(plan.sequence).toBe(1); // takes appt's slot; appt+later shift up
  });

  it("appends a late fact at the end", () => {
    const plan = planInsertionByTime(chain, "2026-06-03T18:00:00.000Z");
    expect(plan.beforeStopId).toBe("home-back");
    expect(plan.afterStopId).toBeNull();
    expect(plan.sequence).toBe(3);
  });

  it("prepends an early fact at the front", () => {
    const plan = planInsertionByTime(chain, "2026-06-03T06:00:00.000Z");
    expect(plan.beforeStopId).toBeNull();
    expect(plan.afterStopId).toBe("home-out");
    expect(plan.sequence).toBe(0);
  });

  it("handles an empty itinerary", () => {
    const plan = planInsertionByTime([], "2026-06-03T09:00:00.000Z");
    expect(plan).toEqual({ sequence: 0, beforeStopId: null, afterStopId: null });
  });

  it("does not let a stop with unknown time push the new fact past a known later one", () => {
    const withNull = [
      t("a", 0, "2026-06-03T07:00:00.000Z"),
      t("floating", 1, null),
      t("c", 2, "2026-06-03T12:00:00.000Z"),
    ];
    // New fact at 09:00 must land before the 12:00 stop; the null-time stop
    // keeps its place ahead of it.
    const plan = planInsertionByTime(withNull, "2026-06-03T09:00:00.000Z");
    expect(plan.afterStopId).toBe("c");
    expect(plan.sequence).toBe(2);
  });

  it("a same-time fact slots after the existing stop, not before it", () => {
    // Inserting at exactly the appointment's start (09:00): the strictly-after
    // test means we don't break on the equal-time stop, so the new fact lands
    // after appt and before the next later stop. Same-time facts keep their
    // insertion order rather than jumping ahead.
    const plan = planInsertionByTime(chain, "2026-06-03T09:00:00.000Z");
    expect(plan.beforeStopId).toBe("appt");
    expect(plan.afterStopId).toBe("home-back");
    expect(plan.sequence).toBe(2);
  });
});
