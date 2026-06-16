import { describe, expect, it } from "vitest";
import {
  comfortBufferMinutes,
  stopModeOf,
  DEFAULT_STATION_BUFFER,
  DEFAULT_AIRPORT_BUFFER,
  DEFAULT_MEETING_BUFFER,
  DEFAULT_TUBE_BUFFER,
  DEFAULT_DINING_BUFFER,
} from "./buffers";

describe("comfortBufferMinutes", () => {
  it("gives national rail the station buffer", () => {
    expect(comfortBufferMinutes({ type: "transit_departure", mode: "train" })).toBe(
      DEFAULT_STATION_BUFFER,
    );
  });

  it("gives a tube/bus board the quick buffer, not the rail one", () => {
    expect(comfortBufferMinutes({ type: "transit_departure", mode: "tube" })).toBe(
      DEFAULT_TUBE_BUFFER,
    );
    expect(comfortBufferMinutes({ type: "transit_changeover", mode: "bus" })).toBe(
      DEFAULT_TUBE_BUFFER,
    );
  });

  it("never lets the tube buffer exceed a tightened station buffer", () => {
    // A user who likes only a 3-min rail buffer shouldn't inherit a roomier tube one.
    expect(
      comfortBufferMinutes(
        { type: "transit_departure", mode: "tube" },
        { default_arrival_buffer_minutes: 3 },
      ),
    ).toBe(3);
  });

  it("gives flights the airport buffer (by type or by mode)", () => {
    expect(comfortBufferMinutes({ type: "flight" })).toBe(DEFAULT_AIRPORT_BUFFER);
    expect(comfortBufferMinutes({ type: "transit_departure", mode: "flight" })).toBe(
      DEFAULT_AIRPORT_BUFFER,
    );
  });

  it("gives appointments/events the meeting buffer and meals a grace", () => {
    expect(comfortBufferMinutes({ type: "appointment" })).toBe(DEFAULT_MEETING_BUFFER);
    expect(comfortBufferMinutes({ type: "event" })).toBe(DEFAULT_MEETING_BUFFER);
    expect(comfortBufferMinutes({ type: "meal" })).toBe(DEFAULT_DINING_BUFFER);
  });

  it("gives home/base, arrivals and check-ins no boarding buffer", () => {
    expect(comfortBufferMinutes({ type: "start" })).toBe(0);
    expect(comfortBufferMinutes({ type: "end" })).toBe(0);
    expect(comfortBufferMinutes({ type: "transit_arrival", mode: "train" })).toBe(0);
    expect(comfortBufferMinutes({ type: "accommodation" })).toBe(0);
  });

  it("honours the user's dials", () => {
    const profile = {
      default_arrival_buffer_minutes: 25,
      default_airport_buffer_minutes: 120,
      default_meeting_buffer_minutes: 5,
    };
    expect(comfortBufferMinutes({ type: "transit_departure", mode: "train" }, profile)).toBe(25);
    expect(comfortBufferMinutes({ type: "flight" }, profile)).toBe(120);
    expect(comfortBufferMinutes({ type: "appointment" }, profile)).toBe(5);
  });
});

describe("stopModeOf", () => {
  it("prefers the stop's metadata transport_mode", () => {
    expect(stopModeOf({ metadata: { transport_mode: "tube" } }, "walk")).toBe("tube");
  });

  it("falls back to the supplied leg mode", () => {
    expect(stopModeOf({ metadata: {} }, "train")).toBe("train");
    expect(stopModeOf({ metadata: null }, "drive")).toBe("drive");
    expect(stopModeOf({})).toBe(null);
  });
});
