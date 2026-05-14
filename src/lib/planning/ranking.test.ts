import { describe, expect, it } from "vitest";
import { rankOptions, pickRecommended, type RankableOption } from "./ranking";

const opt = (overrides: Partial<RankableOption> & { id: string }): RankableOption => ({
  mode: "rail",
  feasibilityStatus: "recommended",
  totalCostEstimate: 50,
  totalDurationMinutes: 120,
  ...overrides,
});

describe("rankOptions", () => {
  it("puts recommended ahead of tight, tight ahead of not_recommended", () => {
    const ranked = rankOptions([
      opt({ id: "a", feasibilityStatus: "not_recommended" }),
      opt({ id: "b", feasibilityStatus: "tight" }),
      opt({ id: "c", feasibilityStatus: "recommended" }),
    ]);
    expect(ranked.map((o) => o.id)).toEqual(["c", "b", "a"]);
  });

  it("filters not_possible to the bottom", () => {
    const ranked = rankOptions([
      opt({ id: "blocked", feasibilityStatus: "not_possible" }),
      opt({ id: "fine", feasibilityStatus: "recommended" }),
    ]);
    expect(ranked[0].id).toBe("fine");
    expect(ranked[1].id).toBe("blocked");
  });

  it("prefers the user's preferred mode at the same feasibility tier", () => {
    const ranked = rankOptions(
      [
        opt({ id: "rail", mode: "rail" }),
        opt({ id: "drive", mode: "drive" }),
      ],
      "drive",
    );
    expect(ranked[0].id).toBe("drive");
  });

  it("breaks ties by cost, then duration", () => {
    const ranked = rankOptions([
      opt({ id: "cheap-slow", totalCostEstimate: 30, totalDurationMinutes: 200 }),
      opt({ id: "expensive-fast", totalCostEstimate: 80, totalDurationMinutes: 90 }),
      opt({ id: "cheap-fast", totalCostEstimate: 30, totalDurationMinutes: 90 }),
    ]);
    expect(ranked.map((o) => o.id)).toEqual([
      "cheap-fast",
      "cheap-slow",
      "expensive-fast",
    ]);
  });

  it("treats null cost as worse than known cost", () => {
    const ranked = rankOptions([
      opt({ id: "unknown", totalCostEstimate: null }),
      opt({ id: "known", totalCostEstimate: 100 }),
    ]);
    expect(ranked[0].id).toBe("known");
  });

  it("pickRecommended returns null on empty input", () => {
    expect(pickRecommended([])).toBeNull();
  });
});
