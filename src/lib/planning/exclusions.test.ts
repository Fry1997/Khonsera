import { describe, expect, it } from "vitest";
import {
  applyExclusions,
  readStandingConstraints,
  type FilterableOption,
} from "./exclusions";

const opt = (o: Partial<FilterableOption> & { id: string }): FilterableOption => ({
  mode: "drive",
  ...o,
});

describe("applyExclusions", () => {
  it("keeps everything when no constraints are set", () => {
    const res = applyExclusions([opt({ id: "a" }), opt({ id: "b" })]);
    expect(res.kept).toHaveLength(2);
    expect(res.dropped).toEqual([]);
  });

  it("drops journey-excluded modes (case-insensitive)", () => {
    const res = applyExclusions(
      [opt({ id: "tube", mode: "Tube" }), opt({ id: "drive", mode: "drive" })],
      { journeyExcludedModes: ["tube"] },
    );
    expect(res.kept.map((o) => o.id)).toEqual(["drive"]);
    expect(res.dropped[0]).toMatchObject({
      reason: "journey_excluded",
      option: { id: "tube" },
    });
  });

  it("drops taxi options over the fare cap, keeps ones under", () => {
    const res = applyExclusions(
      [
        opt({ id: "cheap", mode: "taxi", taxiFarePence: 800 }),
        opt({ id: "dear", mode: "taxi", taxiFarePence: 2400 }),
      ],
      { profile: { maxTaxiFarePence: 1500 } },
    );
    expect(res.kept.map((o) => o.id)).toEqual(["cheap"]);
    expect(res.dropped[0].reason).toBe("over_taxi_cap");
  });

  it("drops walks longer than the threshold but not other modes", () => {
    const res = applyExclusions(
      [
        opt({ id: "longwalk", mode: "walk", walkMinutes: 39 }),
        opt({ id: "shortwalk", mode: "walk", walkMinutes: 8 }),
        opt({ id: "longdrive", mode: "drive", walkMinutes: 99 }),
      ],
      { profile: { walkingThresholdMinutes: 20 } },
    );
    expect(res.kept.map((o) => o.id).sort()).toEqual(["longdrive", "shortwalk"]);
    expect(res.dropped[0]).toMatchObject({
      reason: "over_walking_threshold",
      option: { id: "longwalk" },
    });
  });

  it("never filters on preferred_mode — that is a ranking hint, not a removal", () => {
    const res = applyExclusions(
      [opt({ id: "a", mode: "walk" }), opt({ id: "b", mode: "drive" })],
      { profile: { preferredMode: "drive" } },
    );
    expect(res.kept).toHaveLength(2);
  });
});

describe("readStandingConstraints", () => {
  it("extracts home_by and wake_after times", () => {
    const out = readStandingConstraints([
      { fact_kind: "home_by", details: { time: "18:00" } },
      { fact_kind: "wake_after", details: { time: "6:30" } },
    ]);
    expect(out).toEqual([
      { kind: "home_by", time: "18:00" },
      { kind: "wake_after", time: "6:30" },
    ]);
  });

  it("skips inactive facts and unparseable times", () => {
    const out = readStandingConstraints([
      { fact_kind: "home_by", active: false, details: { time: "18:00" } },
      { fact_kind: "home_by", details: { time: "not a time" } },
      { fact_kind: "home_by", details: {} },
      { fact_kind: "can_drive", details: { time: "09:00" } },
    ]);
    expect(out).toEqual([]);
  });
});
