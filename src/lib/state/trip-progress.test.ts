import { describe, expect, it } from "vitest";
import { annotateLegs, pacing, type Leg } from "./trip-progress";

const anchor = new Date("2026-05-21T08:00:00.000Z"); // 09:00 BST
const at = (offsetMin: number) =>
  new Date(anchor.getTime() + offsetMin * 60_000);

const leg = (
  seq: number,
  startMin: number,
  endMin: number,
  type = "walk",
): Leg => ({
  id: `leg-${seq}`,
  sequence: seq,
  leg_type: type,
  start_location_name: "A",
  end_location_name: "B",
  start_time: at(startMin).toISOString(),
  end_time: at(endMin).toISOString(),
  duration_minutes: endMin - startMin,
  distance_miles: null,
  instructions: null,
  provider: null,
  service_number: null,
});

describe("annotateLegs", () => {
  it("marks legs past/current/next based on wall clock", () => {
    const legs = [
      leg(0, -30, -10), // 08:30–08:50, past
      leg(1, -5, 15), // 08:55–09:15, current at 09:00
      leg(2, 20, 60), // 09:20–10:00, future
    ];
    const out = annotateLegs(legs, anchor);
    expect(out[0].phase).toBe("past");
    expect(out[1].phase).toBe("current");
    expect(out[2].phase).toBe("future");
  });

  it("promotes the first future leg to 'next' when there's no current", () => {
    const legs = [leg(0, -30, -10), leg(1, 10, 30)];
    const out = annotateLegs(legs, anchor);
    expect(out[0].phase).toBe("past");
    expect(out[1].phase).toBe("next");
  });
});

describe("pacing", () => {
  it("reports time-to-leave before the trip starts", () => {
    const legs = annotateLegs([leg(0, 30, 60)], anchor);
    const p = pacing(legs, anchor);
    expect(p.status).toBe("before");
    expect(p.minutesUntilLeave).toBe(30);
  });

  it("reports on_track during the current leg", () => {
    const legs = annotateLegs([leg(0, -10, 10)], anchor);
    expect(pacing(legs, anchor).status).toBe("on_track");
  });

  it("reports running_late when past the next leg's start", () => {
    const legs = annotateLegs(
      [
        leg(0, -30, -10), // past
        leg(1, -5, 5), // ended at 09:05, but we're past with no current
      ],
      at(15), // 09:15 — past both
    );
    // First leg = past, second leg = past too because nowMs > endMs.
    // pacing falls to the complete branch.
    expect(pacing(legs, at(15)).status).toBe("complete");
  });

  it("reports complete when the last leg has ended", () => {
    const legs = annotateLegs([leg(0, -60, -10)], anchor);
    expect(pacing(legs, anchor).status).toBe("complete");
  });
});
