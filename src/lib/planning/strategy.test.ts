import { describe, expect, it } from "vitest";
import { evaluateStrategies, recommendedStrategy } from "./strategy";
import type { DoorToDoorJourney } from "./door-to-door";

const rail: DoorToDoorJourney = {
  id: "rail",
  mode: "rail",
  legs: [
    { mode: "taxi", durationMinutes: 7, costEstimate: 8 },
    { mode: "train", durationMinutes: 79, costEstimate: 64 },
    { mode: "walk", durationMinutes: 9 },
  ],
};

const drive: DoorToDoorJourney = {
  id: "drive",
  mode: "drive",
  legs: [{ mode: "drive", durationMinutes: 95, costEstimate: 30 }],
};

describe("evaluateStrategies", () => {
  it("returns the top two strategies, fastest flagged recommended", () => {
    const out = evaluateStrategies([rail, drive]);
    expect(out).toHaveLength(2);
    // drive (95) beats rail (95 + boarding buffer) on speed.
    expect(out[0].strategy).toBe("drive");
    expect(out[0].recommended).toBe(true);
    expect(out[1].recommended).toBe(false);
  });

  it("carries the composed totals through", () => {
    const out = evaluateStrategies([drive]);
    expect(out[0].totalDurationMinutes).toBe(95);
    expect(out[0].totalCostEstimate).toBe(30);
  });

  it("attaches templated pros per strategy", () => {
    const out = evaluateStrategies([rail, drive]);
    const railSummary = out.find((s) => s.strategy === "rail");
    expect(railSummary?.pros).toContain("Work on the way");
    const driveSummary = out.find((s) => s.strategy === "drive");
    expect(driveSummary?.pros).toContain("Door-to-door");
  });

  it("respects the limit", () => {
    const out = evaluateStrategies([rail, drive], "compare", 1);
    expect(out).toHaveLength(1);
  });

  it("honours feasibility over raw speed", () => {
    const fastTight: DoorToDoorJourney = {
      id: "drive",
      mode: "drive",
      feasibilityStatus: "not_recommended",
      legs: [{ mode: "drive", durationMinutes: 60 }],
    };
    const out = evaluateStrategies([fastTight, rail]);
    expect(out[0].strategy).toBe("rail");
  });
});

describe("recommendedStrategy", () => {
  it("returns the engine's single pick", () => {
    expect(recommendedStrategy([rail, drive])).toBe("drive");
  });
  it("returns null when there are no journeys", () => {
    expect(recommendedStrategy([])).toBeNull();
  });
});
