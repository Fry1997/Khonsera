import { describe, it, expect } from "vitest";
import { buildValhallaRequest, mapValhallaTrip, type ValhallaTrip } from "./valhalla";
import { decodeShape } from "./shape";

const origin = { lat: 52.302, lng: -0.687, name: "Wellingborough" };
const destination = { lat: 52.631, lng: -1.125, name: "Leicester" };

describe("buildValhallaRequest", () => {
  it("maps modes to Valhalla costings", () => {
    expect(buildValhallaRequest(origin, destination, "walk").costing).toBe("pedestrian");
    expect(buildValhallaRequest(origin, destination, "cycle").costing).toBe("bicycle");
    expect(buildValhallaRequest(origin, destination, "drive").costing).toBe("auto");
  });

  it("sends lat/lon break locations in order", () => {
    const req = buildValhallaRequest(origin, destination, "walk");
    expect(req.locations).toEqual([
      { lat: 52.302, lon: -0.687, type: "break" },
      { lat: 52.631, lon: -1.125, type: "break" },
    ]);
  });
});

describe("decodeShape precision 6", () => {
  it("round-trips a known Valhalla-style shape", () => {
    // "_p~iF~ps|U_ulLnnqC" is the canonical Google example at precision 5:
    // (38.5, -120.2) (40.7, -120.95). At precision 6 the same string decodes
    // to coordinates 10x smaller — verify the factor is actually applied.
    const p5 = decodeShape("_p~iF~ps|U_ulLnnqC", 5);
    const p6 = decodeShape("_p~iF~ps|U_ulLnnqC", 6);
    expect(p5[0][0]).toBeCloseTo(38.5, 5);
    expect(p6[0][0]).toBeCloseTo(3.85, 6);
  });
});

describe("mapValhallaTrip", () => {
  const fixture: ValhallaTrip = {
    trip: {
      status: 0,
      summary: { length: 1.234, time: 950 },
      legs: [
        {
          // Two points, precision 6.
          shape: "_p~iF~ps|U_ulLnnqC",
          maneuvers: [
            {
              type: 2,
              instruction: "Walk east on Station Road.",
              verbal_pre_transition_instruction: "Walk east on Station Road for half a mile.",
              street_names: ["Station Road"],
              length: 0.8,
              time: 600,
              begin_shape_index: 0,
              end_shape_index: 1,
            },
            {
              type: 4,
              instruction: "You have arrived at your destination.",
              length: 0,
              time: 0,
              begin_shape_index: 1,
              end_shape_index: 1,
            },
          ],
        },
      ],
    },
  };

  it("maps the trip into a NavRoute", () => {
    const route = mapValhallaTrip(fixture, origin, destination, "walk");
    expect(route).not.toBeNull();
    expect(route!.distance_m).toBe(1234);
    expect(route!.duration_s).toBe(950);
    expect(route!.geometry).toHaveLength(2);
    expect(route!.maneuvers).toHaveLength(2);
    expect(route!.maneuvers[0].kind).toBe("depart");
    expect(route!.maneuvers[0].street).toBe("Station Road");
    expect(route!.maneuvers[0].distance_m).toBe(800);
    expect(route!.maneuvers[1].kind).toBe("arrive");
    expect(route!.provider).toBe("valhalla");
  });

  it("returns null for an empty or shapeless response", () => {
    expect(mapValhallaTrip({} as ValhallaTrip, origin, destination, "walk")).toBeNull();
    const noShape = { trip: { status: 0, summary: { length: 0, time: 0 }, legs: [{ shape: "", maneuvers: [] }] } };
    expect(mapValhallaTrip(noShape as ValhallaTrip, origin, destination, "walk")).toBeNull();
  });

  it("collapses unknown maneuver types onto 'other'", () => {
    const weird = structuredClone(fixture);
    weird.trip.legs[0].maneuvers[0].type = 99;
    const route = mapValhallaTrip(weird, origin, destination, "walk");
    expect(route!.maneuvers[0].kind).toBe("other");
  });
});
