import { describe, it, expect } from "vitest";
import { hmrcAmountPence, passengerAmountPence, metersToMiles, trackDistanceMeters, taxYearOf, buildReport, type TripForReport } from "./engine";

describe("HMRC AMAP rates (year-effective)", () => {
  it("values car miles at the 2026/27 rate of 55p under the 10k threshold", () => {
    expect(hmrcAmountPence(100, 0, "car", "2026/27")).toBe(5500); // 100 mi × 55p
  });
  it("uses the old 45p for the 2025/26 tax year", () => {
    expect(hmrcAmountPence(100, 0, "car", "2025/26")).toBe(4500);
  });
  it("crosses to 25p past 10,000 business miles in the year", () => {
    // 9,950 prior + a 100-mile trip → 50 at 55p, 50 at 25p (2026/27)
    expect(hmrcAmountPence(100, 9_950, "car", "2026/27")).toBe(50 * 55 + 50 * 25);
  });
  it("values all car miles at 25p once over the threshold", () => {
    expect(hmrcAmountPence(100, 12_000, "car", "2026/27")).toBe(2500);
  });
  it("motorcycle is a flat 24p, bicycle 20p, no tier", () => {
    expect(hmrcAmountPence(100, 20_000, "motorcycle", "2026/27")).toBe(2400);
    expect(hmrcAmountPence(100, 20_000, "bicycle", "2026/27")).toBe(2000);
  });
  it("unknown future years fall back to the latest table", () => {
    expect(hmrcAmountPence(10, 0, "car", "2099/00")).toBe(550);
  });
});

describe("passenger payments", () => {
  it("is 5p per mile per passenger, on top", () => {
    expect(passengerAmountPence(100, 2, "2026/27")).toBe(1000); // 100 mi × 2 pax × 5p
    expect(passengerAmountPence(100, 0, "2026/27")).toBe(0);
  });
});

describe("track distance", () => {
  it("sums haversine hops along a GPS track", () => {
    const d = trackDistanceMeters([{ lat: 51.5, lng: 0 }, { lat: 51.51, lng: 0 }, { lat: 51.52, lng: 0 }]);
    expect(metersToMiles(d)).toBeCloseTo(1.38, 1);
  });
});

describe("UK tax year", () => {
  it("splits on 6 April", () => {
    expect(taxYearOf("2026-04-05T12:00:00Z")).toBe("2025/26");
    expect(taxYearOf("2026-04-06T12:00:00Z")).toBe("2026/27");
    expect(taxYearOf("2026-12-01T12:00:00Z")).toBe("2026/27");
  });
});

describe("buildReport", () => {
  const trip = (id: string, miles: number, cls: TripForReport["classification"], over: Partial<TripForReport> = {}): TripForReport => ({
    id,
    startedAt: "2026-05-01T09:00:00Z",
    distanceMeters: miles * 1609.344,
    classification: cls,
    vehicle: "car",
    purpose: "Client visit",
    ...over,
  });

  it("values business trips at the year rate, counts personal, ignores other years", () => {
    const report = buildReport(
      [
        trip("a", 100, "business"),
        trip("b", 40, "personal"),
        trip("c", 10, "unset"),
        trip("d", 999, "business", { startedAt: "2024-05-01T09:00:00Z" }),
      ],
      "2026/27",
    );
    expect(report.businessMiles).toBe(100);
    expect(report.personalMiles).toBe(40);
    expect(report.claimablePence).toBe(5500); // 100 × 55p
    expect(report.trips).toHaveLength(3);
  });

  it("adds passenger payments and flags trips missing a purpose", () => {
    const report = buildReport([trip("a", 100, "business", { passengers: 1, purpose: null })], "2026/27");
    expect(report.claimablePence).toBe(5500 + 500); // mileage + 1 pax × 100mi × 5p
    expect(report.passengerPence).toBe(500);
    expect(report.needsPurposeCount).toBe(1);
  });

  it("accumulates the 10k tier chronologically across trips", () => {
    const report = buildReport(
      [trip("a", 9_960, "business", { startedAt: "2026-05-01T09:00:00Z" }), trip("b", 80, "business", { startedAt: "2026-06-01T09:00:00Z" })],
      "2026/27",
    );
    // first trip all at 55p; second: 40 at 55p + 40 at 25p
    expect(report.claimablePence).toBe(9_960 * 55 + 40 * 55 + 40 * 25);
  });
});
