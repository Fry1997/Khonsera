import { describe, it, expect } from "vitest";
import { haversineMeters, formatMiles, rankByProximity } from "./geo";

describe("haversineMeters", () => {
  it("is ~0 for the same point", () => {
    expect(haversineMeters(52.3, -0.66, 52.3, -0.66)).toBeLessThan(1);
  });

  it("matches a known distance (London ↔ Birmingham ≈ 163km)", () => {
    const m = haversineMeters(51.5074, -0.1278, 52.4862, -1.8904);
    expect(m).toBeGreaterThan(160_000);
    expect(m).toBeLessThan(166_000);
  });

  it("is symmetric", () => {
    const a = haversineMeters(52.3, -0.66, 52.9, -1.47);
    const b = haversineMeters(52.9, -1.47, 52.3, -0.66);
    expect(Math.abs(a - b)).toBeLessThan(0.01);
  });
});

describe("formatMiles", () => {
  it("reads 'here' under 50m", () => {
    expect(formatMiles(20)).toBe("here");
  });
  it("keeps one decimal under 10 miles", () => {
    expect(formatMiles(644)).toBe("0.4 mi");
  });
  it("rounds to whole miles past 10", () => {
    expect(formatMiles(20_000)).toBe("12 mi");
  });
});

describe("rankByProximity", () => {
  const near = { lat: 53.4084, lng: -2.9916 }; // Liverpool
  it("sorts nearest-first and attaches distance_m", () => {
    const rows = [
      { id: "manchester", latitude: 53.4808, longitude: -2.2426 },
      { id: "lime-street", latitude: 53.4075, longitude: -2.9778 },
    ];
    const out = rankByProximity(rows, near);
    expect(out[0].id).toBe("lime-street");
    expect(out[0].distance_m).toBeGreaterThan(0);
    expect(out[1].distance_m!).toBeGreaterThan(out[0].distance_m!);
  });

  it("sinks coordinate-less rows to the end, preserving their order", () => {
    const rows = [
      { id: "no-coords-1", latitude: null, longitude: null },
      { id: "lime-street", latitude: 53.4075, longitude: -2.9778 },
      { id: "no-coords-2", latitude: null, longitude: null },
    ];
    const out = rankByProximity(rows, near);
    expect(out.map((r) => r.id)).toEqual(["lime-street", "no-coords-1", "no-coords-2"]);
  });
});
