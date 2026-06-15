import { describe, it, expect } from "vitest";
import { hmrcAmountPence, metersToMiles, trackDistanceMeters, taxYearOf, buildReport, type TripForReport } from "./engine";

describe("HMRC AMAP rates", () => {
  it("values car miles at 45p under the 10k threshold", () => {
    expect(hmrcAmountPence(100, 0, "car")).toBe(4500); // 100 mi × 45p
  });
  it("crosses to 25p past 10,000 business miles in the year", () => {
    // 9,950 prior + a 100-mile trip → 50 at 45p, 50 at 25p
    expect(hmrcAmountPence(100, 9_950, "car")).toBe(50 * 45 + 50 * 25);
  });
  it("values all car miles at 25p once over the threshold", () => {
    expect(hmrcAmountPence(100, 12_000, "car")).toBe(2500);
  });
  it("motorcycle is a flat 24p, bicycle 20p, no tier", () => {
    expect(hmrcAmountPence(100, 20_000, "motorcycle")).toBe(2400);
    expect(hmrcAmountPence(100, 20_000, "bicycle")).toBe(2000);
  });
});

describe("track distance", () => {
  it("sums haversine hops along a GPS track", () => {
    // ~1.11km per 0.01° of latitude
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
  const trip = (id: string, miles: number, cls: TripForReport["classification"], startedAt = "2026-05-01T09:00:00Z"): TripForReport => ({
    id,
    startedAt,
    distanceMeters: miles * 1609.344,
    classification: cls,
    vehicle: "car",
  });

  it("values business trips, counts personal, ignores other years", () => {
    const report = buildReport(
      [
        trip("a", 100, "business"),
        trip("b", 40, "personal"),
        trip("c", 10, "unset"),
        trip("d", 999, "business", "2024-05-01T09:00:00Z"), // different tax year
      ],
      "2026/27",
    );
    expect(report.businessMiles).toBe(100);
    expect(report.personalMiles).toBe(40);
    expect(report.claimablePence).toBe(4500);
    expect(report.trips).toHaveLength(3); // the 2024 trip excluded
  });

  it("accumulates the 10k tier chronologically across trips", () => {
    const report = buildReport(
      [trip("a", 9_960, "business", "2026-05-01T09:00:00Z"), trip("b", 80, "business", "2026-06-01T09:00:00Z")],
      "2026/27",
    );
    // first trip all at 45p; second: 40 at 45p + 40 at 25p
    expect(report.claimablePence).toBe(9_960 * 45 + 40 * 45 + 40 * 25);
  });
});
