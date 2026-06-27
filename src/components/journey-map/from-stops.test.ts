import { describe, it, expect } from "vitest";
import {
  buildJourneyFromStops,
  polylineOrientation,
  type StopForMap,
  type TransitionForMap,
} from "./from-stops";
import type { LatLng } from "./types";

// Real-ish UK coords for the bug scenario: a leg Leicester → Derby whose stored
// polyline actually traces Leicester → Birmingham (the phantom western branch).
const LEICESTER = { lat: 52.6309, lng: -1.1326 };
const DERBY = { lat: 52.9163, lng: -1.4638 };
const BIRMINGHAM = { lat: 52.4779, lng: -1.8989 };

describe("polylineOrientation — the phantom-branch guard", () => {
  it("accepts a polyline whose ends match the leg (forward)", () => {
    const track: LatLng[] = [
      [LEICESTER.lat, LEICESTER.lng],
      [52.75, -1.3],
      [DERBY.lat, DERBY.lng],
    ];
    expect(polylineOrientation(track, LEICESTER, DERBY)).toBe("forward");
  });

  it("accepts a reversed polyline and flags it for reversal", () => {
    const track: LatLng[] = [
      [DERBY.lat, DERBY.lng],
      [52.75, -1.3],
      [LEICESTER.lat, LEICESTER.lng],
    ];
    expect(polylineOrientation(track, LEICESTER, DERBY)).toBe("reverse");
  });

  it("rejects a polyline that wanders to the wrong city (the phantom branch)", () => {
    // Cached under the wrong key: starts at Leicester but ends at Birmingham,
    // not Derby. Must be rejected so it isn't drawn.
    const track: LatLng[] = [
      [LEICESTER.lat, LEICESTER.lng],
      [52.5, -1.6],
      [BIRMINGHAM.lat, BIRMINGHAM.lng],
    ];
    expect(polylineOrientation(track, LEICESTER, DERBY)).toBeNull();
  });

  it("tolerates small rail-node snapping at the ends", () => {
    // ~0.3 mi off each end — a legitimately snapped rail node, not an error.
    const track: LatLng[] = [
      [LEICESTER.lat + 0.004, LEICESTER.lng],
      [DERBY.lat - 0.004, DERBY.lng],
    ];
    expect(polylineOrientation(track, LEICESTER, DERBY)).toBe("forward");
  });

  it("rejects a degenerate (<2 point) track", () => {
    expect(polylineOrientation([[LEICESTER.lat, LEICESTER.lng]], LEICESTER, DERBY)).toBeNull();
  });
});

describe("buildJourneyFromStops — straight-line fallback", () => {
  const stops: StopForMap[] = [
    { id: "a", title: "Leicester", location: { name: "Leicester", latitude: LEICESTER.lat, longitude: LEICESTER.lng } },
    { id: "b", title: "Derby", location: { name: "Derby", latitude: DERBY.lat, longitude: DERBY.lng } },
  ];

  it("uses a straight line when a leg has no stored polyline", () => {
    const transitions: TransitionForMap[] = [{ from_stop_id: "a", mode: "train" }];
    const journey = buildJourneyFromStops(stops, transitions, { id: "j", eyebrow: "TEST" });
    expect(journey).not.toBeNull();
    expect(journey!.legs).toHaveLength(1);
    // Two-point straight track from Leicester to Derby.
    expect(journey!.legs[0].track).toHaveLength(2);
    expect(journey!.legs[0].track[0]).toEqual([LEICESTER.lat, LEICESTER.lng]);
    expect(journey!.legs[0].track[1]).toEqual([DERBY.lat, DERBY.lng]);
  });
});
