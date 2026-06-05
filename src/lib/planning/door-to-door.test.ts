import { describe, expect, it } from "vitest";
import {
  composeDoorToDoor,
  rankDoorToDoor,
  recommendedDoorToDoor,
  type DoorToDoorJourney,
} from "./door-to-door";
import { boardingBufferMinutes } from "./buffers";

const railJourney: DoorToDoorJourney = {
  id: "rail",
  mode: "rail",
  legs: [
    { mode: "taxi", durationMinutes: 7, costEstimate: 8 },
    { mode: "train", durationMinutes: 79, costEstimate: 64 },
    { mode: "walk", durationMinutes: 9 },
  ],
};

describe("composeDoorToDoor", () => {
  it("sums leg durations plus the connection buffer into the train", () => {
    const c = composeDoorToDoor(railJourney);
    // taxi→train adds one boarding buffer; train→walk adds none.
    expect(c.travelMinutes).toBe(7 + 79 + 9);
    expect(c.connectionBufferMinutes).toBe(boardingBufferMinutes("train"));
    expect(c.totalDurationMinutes).toBe(
      7 + 79 + 9 + boardingBufferMinutes("train"),
    );
  });

  it("sums known leg costs and ignores legs with no cost", () => {
    const c = composeDoorToDoor(railJourney);
    expect(c.totalCostEstimate).toBe(8 + 64);
  });

  it("returns null cost when no leg carried a cost (unknown, not free)", () => {
    const c = composeDoorToDoor({
      id: "x",
      mode: "drive",
      legs: [{ mode: "drive", durationMinutes: 95 }],
    });
    expect(c.totalCostEstimate).toBeNull();
  });

  it("a single flexible leg has no connection buffer", () => {
    const c = composeDoorToDoor({
      id: "drive",
      mode: "drive",
      legs: [{ mode: "drive", durationMinutes: 95, costEstimate: 30 }],
    });
    expect(c.connectionBufferMinutes).toBe(0);
    expect(c.totalDurationMinutes).toBe(95);
  });
});

describe("rankDoorToDoor", () => {
  it("ranks on the composed door-to-door total, fastest first", () => {
    const drive: DoorToDoorJourney = {
      id: "drive",
      mode: "drive",
      legs: [{ mode: "drive", durationMinutes: 95, costEstimate: 30 }],
    };
    // rail total = 95 + boarding buffer > 95, so drive wins on speed.
    const ranked = rankDoorToDoor([railJourney, drive]);
    expect(ranked[0].id).toBe("drive");
  });

  it("recommendedDoorToDoor returns the fastest viable journey", () => {
    const slowDrive: DoorToDoorJourney = {
      id: "drive",
      mode: "drive",
      legs: [{ mode: "drive", durationMinutes: 200, costEstimate: 30 }],
    };
    const rec = recommendedDoorToDoor([railJourney, slowDrive]);
    expect(rec?.id).toBe("rail");
  });

  it("honours feasibility tier over raw speed", () => {
    const fastButTight: DoorToDoorJourney = {
      id: "fast",
      mode: "drive",
      feasibilityStatus: "not_recommended",
      legs: [{ mode: "drive", durationMinutes: 60 }],
    };
    const slowerOk: DoorToDoorJourney = {
      id: "slow",
      mode: "rail",
      feasibilityStatus: "recommended",
      legs: [{ mode: "train", durationMinutes: 90 }],
    };
    const ranked = rankDoorToDoor([fastButTight, slowerOk]);
    expect(ranked[0].id).toBe("slow");
  });
});
