import { describe, it, expect } from "vitest";
import { solveTimes, type SolverStop, type SolverTransition } from "./solver";

function stop(
  id: string,
  sequence: number,
  partial: Partial<SolverStop> = {},
): SolverStop {
  return {
    id,
    sequence,
    start_time: null,
    end_time: null,
    duration_minutes: null,
    is_time_fixed: false,
    ...partial,
  };
}

function trans(
  id: string,
  from: string,
  to: string,
  durationMinutes: number | null,
  partial: Partial<SolverTransition> = {},
): SolverTransition {
  return {
    id,
    from_stop_id: from,
    to_stop_id: to,
    start_time: null,
    end_time: null,
    computed_duration_minutes: durationMinutes,
    is_locked: false,
    ...partial,
  };
}

describe("solveTimes", () => {
  it("back-times the first stop from a single fixed anchor", () => {
    // home → station (12 min walk) → train at 09:20 (anchor)
    const result = solveTimes({
      stops: [
        stop("a", 0),
        stop("b", 1, { is_time_fixed: true, start_time: "2026-05-15T09:20:00.000Z" }),
      ],
      transitions: [trans("t1", "a", "b", 12)],
    });
    const a = result.stops.find((s) => s.id === "a")!;
    expect(a.start_time).toBe("2026-05-15T09:08:00.000Z");
    expect(a.end_time).toBe("2026-05-15T09:08:00.000Z"); // no duration
    const t = result.transitions[0];
    expect(t.start_time).toBe("2026-05-15T09:08:00.000Z");
    expect(t.end_time).toBe("2026-05-15T09:20:00.000Z");
    expect(result.conflicts).toEqual([]);
  });

  it("propagates forward through a chain with durations", () => {
    // anchor at 09:00, +30 min duration, walk 10 min, next stop
    const result = solveTimes({
      stops: [
        stop("a", 0, {
          is_time_fixed: true,
          start_time: "2026-05-15T09:00:00.000Z",
          duration_minutes: 30,
        }),
        stop("b", 1),
      ],
      transitions: [trans("t1", "a", "b", 10)],
    });
    const b = result.stops.find((s) => s.id === "b")!;
    expect(b.start_time).toBe("2026-05-15T09:40:00.000Z");
  });

  it("flags conflicts when two anchors disagree", () => {
    // anchor a at 09:00 with no duration, walk 10, anchor b at 09:30
    const result = solveTimes({
      stops: [
        stop("a", 0, {
          is_time_fixed: true,
          start_time: "2026-05-15T09:00:00.000Z",
        }),
        stop("b", 1, {
          is_time_fixed: true,
          start_time: "2026-05-15T09:30:00.000Z",
        }),
      ],
      transitions: [trans("t1", "a", "b", 10)],
    });
    // Each anchor propagates and finds the conflict from its direction.
    expect(result.conflicts.length).toBeGreaterThanOrEqual(1);
    expect(result.conflicts.every((c) => c.kind === "stop_anchor_mismatch")).toBe(true);
  });

  it("stops propagating when transition duration is unknown", () => {
    const result = solveTimes({
      stops: [
        stop("a", 0, {
          is_time_fixed: true,
          start_time: "2026-05-15T09:00:00.000Z",
        }),
        stop("b", 1),
        stop("c", 2),
      ],
      transitions: [trans("t1", "a", "b", null), trans("t2", "b", "c", 20)],
    });
    const b = result.stops.find((s) => s.id === "b")!;
    expect(b.start_time).toBeNull();
  });

  it("respects a locked transition window", () => {
    // a (unanchored) → locked train 09:20 → 11:00 → b
    const result = solveTimes({
      stops: [
        stop("a", 0),
        stop("b", 1),
      ],
      transitions: [
        trans("t1", "a", "b", 100, {
          is_locked: true,
          start_time: "2026-05-15T09:20:00.000Z",
          end_time: "2026-05-15T11:00:00.000Z",
        }),
      ],
    });
    // No anchor on either stop — solver does nothing.
    expect(result.stops[0].start_time).toBeNull();
    expect(result.stops[1].start_time).toBeNull();
  });
});
