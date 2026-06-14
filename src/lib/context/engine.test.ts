import { describe, it, expect } from "vitest";
import {
  weatherLeaveEarlier,
  runningLateExpedite,
  loungeForLayover,
  parkingLikelyFull,
  gateChangeReroute,
  evaluateContext,
  type CorridorWeather,
  type WeatherLegInput,
  type FlightBufferInput,
} from "./engine";

const now = "2026-07-01T06:00:00Z";
const calm: CorridorWeather = { severity: "none", headline: "Clear", maxPrecipMm: 0, maxGustKmh: 8, snow: false };
const heavy: CorridorWeather = { severity: "severe", headline: "Heavy rain", maxPrecipMm: 6, maxGustKmh: 30, snow: false };

const leg = (weather: CorridorWeather, over: Partial<WeatherLegInput> = {}): WeatherLegInput => ({
  legId: "L1",
  mode: "drive",
  toLabel: "Gatwick",
  departIso: "2026-07-01T07:00:00Z",
  weather,
  ...over,
});

describe("context engine — weather → leave earlier", () => {
  it("stays silent in calm weather", () => {
    expect(weatherLeaveEarlier(leg(calm), now)).toBeNull();
  });

  it("proposes a bigger margin for a severe drive than a walk", () => {
    const drive = weatherLeaveEarlier(leg(heavy, { mode: "drive" }), now)!;
    const walk = weatherLeaveEarlier(leg(heavy, { mode: "walk" }), now)!;
    expect(drive.action).toEqual({ kind: "leave-earlier", minutes: 20, reason: expect.stringContaining("heavy rain") });
    expect(walk.action).toMatchObject({ minutes: 10 });
    expect(drive.actionLabel).toBe("Leave 20 min earlier");
    expect(drive.message).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u); // no emoji, ever
  });
});

describe("context engine — running late → expedite", () => {
  const fb = (arriveAirportIso: string): FlightBufferInput => ({
    flightStopId: "F1",
    airport: "Gatwick (LGW)",
    flightDepartIso: "2026-07-01T09:00:00Z",
    arriveAirportIso,
  });

  it("stays quiet when the buffer is comfortable", () => {
    expect(runningLateExpedite(fb("2026-07-01T07:30:00Z"), now)).toBeNull(); // 90 min
  });

  it("fires fast-track when the buffer is thin", () => {
    const n = runningLateExpedite(fb("2026-07-01T08:00:00Z"), now)!; // 60 min < 75
    expect(n.action).toEqual({ kind: "expedite-security", airport: "Gatwick (LGW)", provider: "dragonpass" });
    expect(n.message).toContain("60 min");
  });

  it("does not fire once departure has passed (recovery's job)", () => {
    expect(runningLateExpedite(fb("2026-07-01T09:30:00Z"), now)).toBeNull();
  });
});

describe("context engine — long layover → lounge", () => {
  it("offers a lounge only when the buffer is generous (the fast-track mirror)", () => {
    const base = { flightStopId: "F1", airport: "Gatwick (LGW)", boardingIso: "2026-07-01T09:00:00Z" };
    expect(loungeForLayover({ ...base, dwellMin: 60 }, now)).toBeNull(); // short → fast-track territory
    const n = loungeForLayover({ ...base, dwellMin: 150 }, now)!;
    expect(n.action).toMatchObject({ kind: "book-lounge", windowMin: 150 });
    expect(n.message).toContain("2h 30m");
  });
});

describe("context engine — parking likely full", () => {
  const base = { legId: "L1", site: "Gatwick North car park", departIso: "2026-07-01T07:00:00Z", untilIso: "2026-07-03T18:00:00Z" };
  it("stays quiet with spaces, fires when likely full", () => {
    expect(parkingLikelyFull({ ...base, predictedOccupancyPct: 60 }, now)).toBeNull();
    const n = parkingLikelyFull({ ...base, predictedOccupancyPct: 90 }, now)!;
    expect(n.action).toEqual({ kind: "prebook-parking", site: base.site, fromIso: base.departIso, toIso: base.untilIso, provider: "parkopedia" });
    expect(n.message).toContain("90%");
  });
});

describe("context engine — gate change", () => {
  const base = { flightStopId: "F1", airport: "LGW", fromGate: "12", walkMin: 8, boardingIso: "2026-07-01T06:40:00Z" };
  it("ignores a non-change, restates the walk + time in hand on a real change", () => {
    expect(gateChangeReroute({ ...base, toGate: "12" }, now)).toBeNull();
    const n = gateChangeReroute({ ...base, toGate: "55" }, now)!; // boarding 40m out, 8m walk → 32 in hand
    expect(n.urgency).toBe("now");
    expect(n.message).toContain("12 to 55");
    expect(n.message).toContain("32 min in hand");
  });
});

describe("evaluateContext", () => {
  const noExtras = { lounges: [], parkings: [], gateChanges: [] };
  it("collects fired rules most-urgent first", () => {
    const nudges = evaluateContext({
      nowIso: now,
      weatherLegs: [leg(calm), leg(heavy, { legId: "L2", departIso: "2026-07-01T11:00:00Z" })],
      flightBuffers: [
        { flightStopId: "F1", airport: "LGW", flightDepartIso: "2026-07-01T06:30:00Z", arriveAirportIso: "2026-07-01T05:40:00Z" },
      ],
      ...noExtras,
    });
    expect(nudges).toHaveLength(2); // calm leg dropped
    expect(nudges[0].urgency).toBe("now"); // the imminent flight buffer leads
    expect(nudges[0].rule).toBe("running-late-expedite");
  });

  it("runs the P13 rules through the same framework", () => {
    const nudges = evaluateContext({
      nowIso: now,
      weatherLegs: [],
      flightBuffers: [],
      lounges: [{ flightStopId: "F1", airport: "LGW", dwellMin: 120, boardingIso: "2026-07-01T10:00:00Z" }],
      parkings: [{ legId: "L1", site: "LGW car park", predictedOccupancyPct: 92, departIso: "2026-07-01T07:00:00Z", untilIso: "2026-07-03T18:00:00Z" }],
      gateChanges: [{ flightStopId: "F1", airport: "LGW", fromGate: "1", toGate: "9", walkMin: 6, boardingIso: "2026-07-01T10:00:00Z" }],
    });
    expect(nudges.map((n) => n.rule).sort()).toEqual(["gate-change", "layover-lounge", "parking-prebook"]);
  });
});
