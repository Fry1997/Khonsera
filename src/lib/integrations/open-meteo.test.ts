import { describe, it, expect } from "vitest";
import { summarizeCorridor, type OpenMeteoResponse } from "./open-meteo";

// Hourly fixture with zoneless local times, mirroring Open-Meteo's shape.
const res: OpenMeteoResponse = {
  hourly: {
    time: ["2026-07-01T06:00", "2026-07-01T07:00", "2026-07-01T08:00", "2026-07-01T09:00"],
    precipitation: [0, 5.2, 0.4, 0],
    wind_gusts_10m: [12, 22, 18, 15],
    snowfall: [0, 0, 0, 0],
  },
};

describe("summarizeCorridor", () => {
  it("picks the worst conditions inside the travel window", () => {
    const w = summarizeCorridor(res, "2026-07-01T06:30", "2026-07-01T07:30");
    expect(w.severity).toBe("severe"); // 5.2mm/h precip ≥ severe
    expect(w.headline).toBe("Heavy rain");
    expect(w.maxPrecipMm).toBe(5.2);
  });

  it("is calm when the window misses the bad hour", () => {
    const w = summarizeCorridor(res, "2026-07-01T08:00", "2026-07-01T09:00");
    expect(w.severity).toBe("none");
    expect(w.headline).toBe("Clear");
  });

  it("flags snow as severe regardless of precip rate", () => {
    const snowy: OpenMeteoResponse = {
      hourly: { time: ["2026-07-01T07:00"], precipitation: [0.2], wind_gusts_10m: [10], snowfall: [0.5] },
    };
    const w = summarizeCorridor(snowy, "2026-07-01T06:00", "2026-07-01T08:00");
    expect(w.severity).toBe("severe");
    expect(w.headline).toBe("Snow");
    expect(w.snow).toBe(true);
  });
});
