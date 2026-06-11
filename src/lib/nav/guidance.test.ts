import { describe, it, expect } from "vitest";
import {
  cumulativeDistances,
  snapToRoute,
  guidanceTick,
  formatNavDistance,
  formatNavDuration,
} from "./guidance";
import type { NavRoute } from "./types";

// A straight ~1.1km northbound walk: 11 points, ~111m apart (0.001° lat).
const geometry: [number, number][] = Array.from({ length: 11 }, (_, i) => [52.0 + i * 0.001, -1.0]);

const route: NavRoute = {
  mode: "walk",
  origin: { lat: 52.0, lng: -1.0, name: "A" },
  destination: { lat: 52.01, lng: -1.0, name: "B" },
  distance_m: 1112,
  duration_s: 800,
  geometry,
  maneuvers: [
    { kind: "depart", instruction: "Walk north", distance_m: 556, time_s: 400, begin_shape_index: 0, end_shape_index: 5 },
    { kind: "left", instruction: "Turn left", distance_m: 556, time_s: 400, begin_shape_index: 5, end_shape_index: 10 },
    { kind: "arrive", instruction: "You have arrived", distance_m: 0, time_s: 0, begin_shape_index: 10, end_shape_index: 10 },
  ],
  provider: "valhalla",
  fetched_at: "2026-06-11T09:00:00Z",
};

const cumulative = cumulativeDistances(geometry);

describe("cumulativeDistances", () => {
  it("starts at zero and grows monotonically to the route length", () => {
    expect(cumulative[0]).toBe(0);
    for (let i = 1; i < cumulative.length; i++) expect(cumulative[i]).toBeGreaterThan(cumulative[i - 1]);
    expect(cumulative[cumulative.length - 1]).toBeGreaterThan(1000);
    expect(cumulative[cumulative.length - 1]).toBeLessThan(1250);
  });
});

describe("snapToRoute", () => {
  it("snaps a fix beside the line onto the line", () => {
    // 30m east of the midpoint (0.00044° lng ≈ 30m at lat 52).
    const snap = snapToRoute(geometry, cumulative, { lat: 52.005, lng: -0.99956 });
    expect(snap.off_route_m).toBeGreaterThan(20);
    expect(snap.off_route_m).toBeLessThan(45);
    expect(Math.abs(snap.along_m - cumulative[5])).toBeLessThan(15);
  });

  it("does not rewind behind the last-known segment", () => {
    // A fix equidistant from an early and a late pass would be ambiguous on a
    // self-crossing route; from segment 7 the search starts at 5.
    const snap = snapToRoute(geometry, cumulative, { lat: 52.0072, lng: -1.0 }, 7);
    expect(snap.segment_index).toBeGreaterThanOrEqual(5);
  });
});

describe("guidanceTick", () => {
  it("points at the upcoming maneuver with the distance to it", () => {
    const tick = guidanceTick(route, cumulative, { lat: 52.003, lng: -1.0 });
    expect(tick.maneuver_index).toBe(1); // heading toward "Turn left" at index 5
    expect(tick.to_maneuver_m).toBeGreaterThan(180);
    expect(tick.to_maneuver_m).toBeLessThan(260);
    expect(tick.arrived).toBe(false);
  });

  it("scales remaining time by remaining distance", () => {
    const tick = guidanceTick(route, cumulative, { lat: 52.005, lng: -1.0 });
    expect(tick.remaining_s).toBeGreaterThan(350);
    expect(tick.remaining_s).toBeLessThan(450);
  });

  it("declares arrival near the destination", () => {
    const tick = guidanceTick(route, cumulative, { lat: 52.00995, lng: -1.0 });
    expect(tick.arrived).toBe(true);
  });

  it("flags a fix far from the line as off-route", () => {
    // ~140m east of the line.
    const tick = guidanceTick(route, cumulative, { lat: 52.005, lng: -0.998 });
    expect(tick.off_route_m).toBeGreaterThan(100);
  });
});

describe("formatters", () => {
  it("reads close distances in metres, far in miles", () => {
    expect(formatNavDistance(8)).toBe("now");
    expect(formatNavDistance(94)).toBe("90 m");
    expect(formatNavDistance(460)).toBe("450 m");
    expect(formatNavDistance(2500)).toBe("1.6 mi");
    expect(formatNavDistance(20000)).toBe("12 mi");
  });

  it("reads durations naturally", () => {
    expect(formatNavDuration(30)).toBe("under a minute");
    expect(formatNavDuration(540)).toBe("9 min");
    expect(formatNavDuration(4500)).toBe("1h 15m");
  });
});
