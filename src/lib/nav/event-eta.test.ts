import { describe, expect, it } from "vitest";
import {
  projectEventETA,
  projectDay,
  deriveMinutesFromNow,
  type CommitmentInput,
} from "./event-eta";

// A fixed "now" for deterministic projection.
const NOW = "2026-06-25T13:00:00.000Z";

const commitment = (over: Partial<CommitmentInput> = {}): CommitmentInput => ({
  id: "c1",
  name: "Dancing Duck visit",
  place: "Dancing Duck",
  neededByIso: "2026-06-25T14:00:00.000Z", // 60 min away
  bufferMin: 15,
  minutesFromNow: 40,
  ...over,
});

describe("projectEventETA", () => {
  it("on_track: lands with the full comfort buffer in hand", () => {
    // 40 min travel → arrive 13:40; needed 14:00 → 20 min spare ≥ 15 buffer.
    const e = projectEventETA(NOW, commitment());
    expect(e.projectedArrivalIso).toBe("2026-06-25T13:40:00.000Z");
    expect(e.spareMin).toBe(20);
    expect(e.slackMin).toBe(5); // 20 − 15
    expect(e.state).toBe("on_track");
  });

  it("thinning: makes it, but tighter than the comfort buffer", () => {
    // 52 min travel → arrive 13:52; 8 min spare, < 15 buffer, ≥ 0.
    const e = projectEventETA(NOW, commitment({ minutesFromNow: 52 }));
    expect(e.spareMin).toBe(8);
    expect(e.slackMin).toBe(-7);
    expect(e.state).toBe("thinning");
  });

  it("will_miss: arrives after the needed-by", () => {
    // 75 min travel → arrive 14:15; 15 min late.
    const e = projectEventETA(NOW, commitment({ minutesFromNow: 75 }));
    expect(e.spareMin).toBe(-15);
    expect(e.state).toBe("will_miss");
  });

  it("the boundary: spare exactly equals the buffer is on_track", () => {
    const e = projectEventETA(NOW, commitment({ minutesFromNow: 45 })); // 15 spare == buffer
    expect(e.spareMin).toBe(15);
    expect(e.state).toBe("on_track");
  });
});

describe("projectDay", () => {
  it("names the earliest BREAK as the pinch", () => {
    const { etas, pinch } = projectDay(NOW, [
      commitment({ id: "late-meeting", neededByIso: "2026-06-25T15:00:00.000Z", minutesFromNow: 30 }), // fine
      commitment({ id: "train", name: "the 13:50 train", neededByIso: "2026-06-25T13:50:00.000Z", minutesFromNow: 60 }), // miss
    ]);
    expect(etas).toHaveLength(2);
    // sorted by neededBy → train first
    expect(etas[0].commitmentId).toBe("train");
    expect(pinch?.commitmentId).toBe("train");
    expect(pinch?.state).toBe("will_miss");
  });

  it("falls back to the THINNEST connection when nothing is outright missed", () => {
    const { pinch } = projectDay(NOW, [
      commitment({ id: "a", neededByIso: "2026-06-25T14:00:00.000Z", minutesFromNow: 50, bufferMin: 15 }), // spare 10, slack -5
      commitment({ id: "b", neededByIso: "2026-06-25T15:00:00.000Z", minutesFromNow: 110, bufferMin: 15 }), // spare 10, slack -5 too
      commitment({ id: "c", neededByIso: "2026-06-25T16:00:00.000Z", minutesFromNow: 175, bufferMin: 15 }), // spare 5, slack -10 (thinnest)
    ]);
    expect(pinch?.commitmentId).toBe("c");
    expect(pinch?.state).toBe("thinning");
  });

  it("no pinch when the whole day is on track", () => {
    const { pinch } = projectDay(NOW, [
      commitment({ id: "a", minutesFromNow: 30 }),
      commitment({ id: "b", neededByIso: "2026-06-25T16:00:00.000Z", minutesFromNow: 60 }),
    ]);
    expect(pinch).toBeNull();
  });
});

describe("deriveMinutesFromNow", () => {
  it("sums active-leg remaining + downstream + delay, flooring negatives", () => {
    expect(deriveMinutesFromNow({ activeLegRemainingMin: 12, downstreamMin: 8, downstreamDelayMin: 5 })).toBe(25);
    expect(deriveMinutesFromNow({ activeLegRemainingMin: 12 })).toBe(12);
    expect(deriveMinutesFromNow({ activeLegRemainingMin: -3, downstreamMin: -2 })).toBe(0);
  });
});
