import { describe, expect, it } from "vitest";
import {
  defaultCandidateLadder,
  suggestAlternatives,
} from "./alternatives";

const PROPOSED = new Date("2026-05-21T09:00:00.000Z");

describe("suggestAlternatives", () => {
  it("returns only acceptable candidates, in order", () => {
    const candidates = [
      { id: "a", appointmentStart: new Date("2026-05-21T09:30:00.000Z") },
      { id: "b", appointmentStart: new Date("2026-05-21T10:00:00.000Z") },
      { id: "c", appointmentStart: new Date("2026-05-21T10:30:00.000Z") },
    ];
    const result = suggestAlternatives(candidates, (c) => {
      if (c.id === "a") return { status: "not_possible" };
      if (c.id === "b") return { status: "recommended" };
      return { status: "tight" };
    });
    expect(result.map((r) => r.candidate.id)).toEqual(["b", "c"]);
  });

  it("respects the limit", () => {
    const candidates = Array.from({ length: 10 }, (_, i) => ({
      id: i,
      appointmentStart: new Date(PROPOSED.getTime() + i * 60 * 60_000),
    }));
    const result = suggestAlternatives(
      candidates,
      () => ({ status: "recommended" }),
      2,
    );
    expect(result).toHaveLength(2);
  });

  it("drops not_recommended and not_possible", () => {
    const result = suggestAlternatives(
      [{ appointmentStart: PROPOSED }],
      () => ({ status: "not_recommended" }),
    );
    expect(result).toEqual([]);
  });
});

describe("defaultCandidateLadder", () => {
  it("emits same-day steps followed by two follow-up days", () => {
    const ladder = defaultCandidateLadder(PROPOSED, {
      stepMinutes: 60,
      window: 3,
    });
    expect(ladder).toHaveLength(5); // 3 same-day + 2 follow-up
    expect(ladder[0].appointmentStart.getTime()).toBe(PROPOSED.getTime() + 60 * 60_000);
    expect(ladder[2].appointmentStart.getTime()).toBe(PROPOSED.getTime() + 3 * 60 * 60_000);
    // Day +1 at same clock time.
    const dayPlusOne = new Date(PROPOSED);
    dayPlusOne.setDate(dayPlusOne.getDate() + 1);
    expect(ladder[3].appointmentStart.getTime()).toBe(dayPlusOne.getTime());
  });
});
