import { describe, expect, it } from "vitest";
import { computeItinerarySummary } from "./summary";

describe("computeItinerarySummary", () => {
  it("sums distance and duration across transitions", () => {
    const s = computeItinerarySummary({
      stopCount: 7,
      transitions: [
        { distanceMiles: 56.5, durationMinutes: 95 },
        { distanceMiles: 57.0, durationMinutes: 100 },
        { distanceMiles: null, durationMinutes: null },
      ],
      costs: [],
    });
    expect(s.stopCount).toBe(7);
    expect(s.totalDistanceMi).toBe(113.5);
    expect(s.totalDurationMin).toBe(195);
  });

  it("groups costs by category, highest first, and totals them", () => {
    const s = computeItinerarySummary({
      stopCount: 3,
      transitions: [],
      costs: [
        { category: "rail", amountPence: 6400 },
        { category: "taxi", amountPence: 800 },
        { category: "rail", amountPence: 0 },
        { category: "parking", amountPence: 800 },
      ],
    });
    expect(s.totalCostPence).toBe(8000);
    expect(s.costBreakdown.map((c) => c.category)).toEqual([
      "rail",
      "taxi",
      "parking",
    ]);
    expect(s.costBreakdown[0].amountPence).toBe(6400);
  });

  it("omits zero-total categories from the breakdown", () => {
    const s = computeItinerarySummary({
      stopCount: 1,
      transitions: [],
      costs: [{ category: "food", amountPence: 0 }],
    });
    expect(s.costBreakdown).toEqual([]);
    expect(s.totalCostPence).toBe(0);
  });
});
