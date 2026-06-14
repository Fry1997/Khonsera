import { describe, it, expect } from "vitest";
import { buildDaySummary, evaluateReadiness } from "./engine";

describe("readiness engine", () => {
  it("a single-day domestic day with a booked leg only nudges devices", () => {
    const s = buildDaySummary({
      dateStart: "2026-07-01",
      dateEnd: "2026-07-01",
      stops: [
        { id: "h", type: "start", start_time: null, end_time: null, title: "Home", lat: 52.0, lng: -1.0 },
        { id: "m", type: "appointment", start_time: "2026-07-01T10:00:00Z", end_time: null, title: "Client", lat: 52.5, lng: -1.5 },
      ],
      transitions: [{ from_stop_id: "h", to_stop_id: "m", mode: "train", is_locked: true }],
    });
    expect(s.isMultiDay).toBe(false);
    expect(s.isInternational).toBe(false);
    expect(s.unbookedTransitLegs).toHaveLength(0); // locked = booked
    const keys = evaluateReadiness(s).map((c) => c.key);
    expect(keys).toContain("power:charge");
    expect(keys).not.toContain("doc:passport");
    expect(keys.some((k) => k.startsWith("ticket:"))).toBe(false);
  });

  it("an unbooked train leg raises a ticket check", () => {
    const s = buildDaySummary({
      dateStart: "2026-07-01",
      dateEnd: "2026-07-01",
      stops: [
        { id: "a", type: "appointment", start_time: "2026-07-01T09:00:00Z", end_time: null, title: "Euston", lat: 51.5, lng: -0.13 },
        { id: "b", type: "appointment", start_time: "2026-07-01T12:00:00Z", end_time: null, title: "Derby", lat: 52.9, lng: -1.47 },
      ],
      transitions: [{ from_stop_id: "a", to_stop_id: "b", mode: "train", is_locked: false }],
    });
    expect(s.unbookedTransitLegs).toHaveLength(1);
    expect(evaluateReadiness(s).map((c) => c.key)).toContain("ticket:a->b");
  });

  it("an international multi-day trip with no hotel raises passport + uncovered-night checks", () => {
    const s = buildDaySummary({
      dateStart: "2026-07-01",
      dateEnd: "2026-07-03", // two nights
      stops: [
        { id: "p", type: "flight", start_time: "2026-07-01T08:00:00Z", end_time: null, title: "Paris", lat: 48.85, lng: 2.35 },
      ],
      transitions: [],
    });
    expect(s.isInternational).toBe(true);
    expect(s.hasFlight).toBe(true);
    expect(s.uncoveredNights).toEqual(["2026-07-01", "2026-07-02"]);
    const keys = evaluateReadiness(s).map((c) => c.key);
    expect(keys).toContain("doc:passport");
    expect(keys).toContain("hotel:2026-07-01");
    expect(keys).toContain("hotel:2026-07-02");
    expect(keys).toContain("trip:pack");
  });

  it("an accommodation stop covers its nights", () => {
    const s = buildDaySummary({
      dateStart: "2026-07-01",
      dateEnd: "2026-07-03",
      stops: [
        { id: "hot", type: "accommodation", start_time: "2026-07-01T15:00:00Z", end_time: "2026-07-03T11:00:00Z", title: "Hotel", lat: 52.0, lng: -1.0 },
      ],
      transitions: [],
    });
    expect(s.uncoveredNights).toEqual([]);
  });
});
