import { describe, it, expect } from "vitest";
import {
  doorToDoorMinutes,
  connectionBufferMinutes,
  isExcluded,
  rankByDoorToDoor,
  topViable,
  type DoorToDoorOption,
} from "./door-to-door";

const opt = (id: string, subLegs: DoorToDoorOption["subLegs"], extra: Partial<DoorToDoorOption> = {}): DoorToDoorOption => ({
  id,
  subLegs,
  ...extra,
});

describe("connectionBufferMinutes", () => {
  it("charges the cost of catching the NEXT mode; walk is free", () => {
    expect(connectionBufferMinutes("train", "walk")).toBe(0);
    expect(connectionBufferMinutes("walk", "train")).toBe(10);
    expect(connectionBufferMinutes("train", "tube")).toBe(6);
    expect(connectionBufferMinutes("walk", "taxi")).toBe(5);
  });
});

describe("doorToDoorMinutes", () => {
  it("sums sub-legs + inter-leg buffers (no buffer before the first leg)", () => {
    // walk 10 → train 80 (+10 board) → walk 12  = 10 + 10 + 80 + 0 + 12
    const d = doorToDoorMinutes(
      opt("x", [
        { mode: "walk", minutes: 10 },
        { mode: "train", minutes: 80 },
        { mode: "walk", minutes: 12 },
      ]),
    );
    expect(d).toBe(112);
  });

  it("a single leg has no connection buffer", () => {
    expect(doorToDoorMinutes(opt("x", [{ mode: "drive", minutes: 45 }]))).toBe(45);
  });
});

describe("rankByDoorToDoor — one criterion: speed", () => {
  it("ranks ascending by door-to-door total", () => {
    const ranked = rankByDoorToDoor([
      opt("slow", [{ mode: "train", minutes: 120 }]),
      opt("fast", [{ mode: "drive", minutes: 70 }]),
      opt("mid", [{ mode: "train", minutes: 95 }]),
    ]);
    expect(ranked.map((o) => o.id)).toEqual(["fast", "mid", "slow"]);
  });

  it("does NOT apply a mode preference (no scorecard) — pure speed", () => {
    const ranked = rankByDoorToDoor([
      opt("train", [{ mode: "train", minutes: 60 }]),
      opt("drive", [{ mode: "drive", minutes: 90 }]),
    ]);
    expect(ranked[0].id).toBe("train"); // faster wins regardless of mode
  });

  it("breaks ties by cost then earliest arrival", () => {
    const ranked = rankByDoorToDoor([
      opt("pricey", [{ mode: "train", minutes: 60 }], { cost: 4800, arrival: "2026-06-18T09:00" }),
      opt("cheap", [{ mode: "train", minutes: 60 }], { cost: 1900, arrival: "2026-06-18T09:10" }),
    ]);
    expect(ranked.map((o) => o.id)).toEqual(["cheap", "pricey"]);
  });
});

describe("exclusions filter, never down-rank", () => {
  it("removes options that use an excluded mode entirely", () => {
    const options = [
      opt("flighty", [{ mode: "flight", minutes: 90 }]),
      opt("rail", [{ mode: "train", minutes: 200 }]),
    ];
    expect(isExcluded(options[0], new Set(["flight"]))).toBe(true);
    const ranked = rankByDoorToDoor(options, { exclude: ["flight"] });
    expect(ranked.map((o) => o.id)).toEqual(["rail"]); // flight gone, not just last
  });

  it("excludes if ANY sub-leg uses the excluded mode", () => {
    const ranked = rankByDoorToDoor(
      [opt("mixed", [{ mode: "drive", minutes: 20 }, { mode: "flight", minutes: 90 }])],
      { exclude: ["flight"] },
    );
    expect(ranked).toHaveLength(0);
  });
});

describe("topViable", () => {
  it("returns the top 4 fastest by default", () => {
    const options = Array.from({ length: 7 }, (_, i) =>
      opt(`o${i}`, [{ mode: "train", minutes: 100 - i }]),
    );
    const top = topViable(options);
    expect(top).toHaveLength(4);
    expect(top[0].id).toBe("o6"); // shortest minutes
  });
});
