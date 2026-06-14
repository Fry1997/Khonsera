import { describe, it, expect } from "vitest";
import { buildOtpPlanQuery, mapOtpItineraries, type OtpResponse } from "./otp";

describe("OTP adapter", () => {
  it("builds a planConnection query with coords + departure time", () => {
    const { query, variables } = buildOtpPlanQuery({ lat: 51.5, lng: -0.1 }, { lat: 52.9, lng: -1.5 }, "2026-07-01T11:10:00Z");
    expect(query).toContain("planConnection");
    expect(variables).toMatchObject({ fromLat: 51.5, fromLon: -0.1, toLat: 52.9, toLon: -1.5, when: "2026-07-01T11:10:00Z" });
  });

  it("maps a multi-leg detour into a RecoveryCandidate with via + changes", () => {
    const res: OtpResponse = {
      data: {
        planConnection: {
          edges: [
            {
              node: {
                start: "2026-07-01T11:25:00Z",
                end: "2026-07-01T13:05:00Z",
                numberOfTransfers: 1,
                legs: [
                  { mode: "WALK", from: { name: "Origin" }, to: { name: "London Euston" }, start: { scheduledTime: "2026-07-01T11:25:00Z" }, end: { scheduledTime: "2026-07-01T11:30:00Z" } },
                  { mode: "RAIL", from: { name: "London Euston" }, to: { name: "Coventry" }, start: { scheduledTime: "2026-07-01T11:30:00Z" }, end: { scheduledTime: "2026-07-01T12:20:00Z" }, route: { shortName: "WMT", longName: null } },
                  { mode: "RAIL", from: { name: "Coventry" }, to: { name: "Derby" }, start: { scheduledTime: "2026-07-01T12:30:00Z" }, end: { scheduledTime: "2026-07-01T13:05:00Z" }, route: { shortName: "XC", longName: null } },
                ],
              },
            },
          ],
        },
      },
    };
    const [c] = mapOtpItineraries(res, "Derby");
    expect(c.mode).toBe("rail");
    expect(c.changes).toBe(1);
    expect(c.note).toContain("via Coventry");
    expect(c.departIso).toBe("2026-07-01T11:25:00Z");
    expect(c.arriveIso).toBe("2026-07-01T13:05:00Z");
  });

  it("flags a mixed-mode itinerary (rail + tube) as mixed", () => {
    const res: OtpResponse = {
      data: {
        planConnection: {
          edges: [
            {
              node: {
                start: "2026-07-01T11:25:00Z",
                end: "2026-07-01T12:40:00Z",
                numberOfTransfers: 1,
                legs: [
                  { mode: "SUBWAY", from: { name: "A" }, to: { name: "King's Cross" }, start: { scheduledTime: "2026-07-01T11:25:00Z" }, end: { scheduledTime: "2026-07-01T11:40:00Z" } },
                  { mode: "RAIL", from: { name: "King's Cross" }, to: { name: "Derby" }, start: { scheduledTime: "2026-07-01T11:45:00Z" }, end: { scheduledTime: "2026-07-01T12:40:00Z" } },
                ],
              },
            },
          ],
        },
      },
    };
    const [c] = mapOtpItineraries(res, "Derby");
    expect(c.mode).toBe("mixed");
  });

  it("returns nothing for an empty plan", () => {
    expect(mapOtpItineraries({ data: { planConnection: { edges: [] } } }, "Derby")).toEqual([]);
  });
});
