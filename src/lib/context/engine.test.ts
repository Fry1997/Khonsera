import { describe, it, expect } from "vitest";
import {
  weatherLeaveEarlier,
  runningLateExpedite,
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

describe("evaluateContext", () => {
  it("collects fired rules most-urgent first", () => {
    const nudges = evaluateContext({
      nowIso: now,
      weatherLegs: [leg(calm), leg(heavy, { legId: "L2", departIso: "2026-07-01T11:00:00Z" })],
      flightBuffers: [
        { flightStopId: "F1", airport: "LGW", flightDepartIso: "2026-07-01T06:30:00Z", arriveAirportIso: "2026-07-01T05:40:00Z" },
      ],
    });
    expect(nudges).toHaveLength(2); // calm leg dropped
    expect(nudges[0].urgency).toBe("now"); // the imminent flight buffer leads
    expect(nudges[0].rule).toBe("running-late-expedite");
  });
});
