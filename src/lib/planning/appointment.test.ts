import { describe, expect, it } from "vitest";
import {
  resolveAppointment,
  appointmentMicrocopy,
  arriveAttribution,
  type ArriveValue,
  type DurationValue,
  type LeaveValue,
} from "./appointment";

// 14:00 BST = 13:00Z; 16:00 BST = 15:00Z.
const at1400: ArriveValue = { time: "2026-06-03T13:00:00.000Z", kind: "precise" };
const dur120: DurationValue = { minutes: 120, kind: "precise" };
const leave1600: LeaveValue = { time: "2026-06-03T15:00:00.000Z", kind: "precise" };
const TZ = { timezone: "Europe/London" };

describe("resolveAppointment", () => {
  it("fixed-duration: arrive + duration derives leave", () => {
    const r = resolveAppointment({ arrive: at1400, duration: dur120 });
    expect(r.mode).toBe("fixed");
    expect(r.leave.time).toBe("2026-06-03T15:00:00.000Z");
    expect(r.leave.kind).toBe("derived");
    expect(r.leave.source).toBe("derived_from_duration");
    expect(r.arrive.source).toBe("user_set");
  });

  it("window-fitting: arrive + leave derives duration", () => {
    const r = resolveAppointment({ arrive: at1400, leave: leave1600 });
    expect(r.mode).toBe("window");
    expect(r.duration.minutes).toBe(120);
    expect(r.duration.kind).toBe("derived");
    expect(r.duration.source).toBe("derived_from_window");
  });

  it("duration + leave derives arrive", () => {
    const r = resolveAppointment({ duration: dur120, leave: leave1600 });
    expect(r.mode).toBe("fixed");
    expect(r.arrive.time).toBe("2026-06-03T13:00:00.000Z");
    expect(r.arrive.kind).toBe("derived");
  });

  it("maximise pulls arrive + leave to the outer bounds, duration is the consequence", () => {
    const r = resolveAppointment({
      duration: { minutes: null, kind: "maximise" },
      bounds: {
        earliestArrive: "2026-06-03T08:19:00.000Z",
        latestLeave: "2026-06-03T13:21:00.000Z",
      },
    });
    expect(r.mode).toBe("maximise");
    expect(r.arrive.time).toBe("2026-06-03T08:19:00.000Z");
    expect(r.arrive.source).toBe("outbound_train");
    expect(r.leave.time).toBe("2026-06-03T13:21:00.000Z");
    expect(r.leave.source).toBe("return_train");
    expect(r.duration.minutes).toBe(5 * 60 + 2); // 08:19 → 13:21
    expect(r.duration.source).toBe("maximise");
  });

  it("maximise honours a user-set arrive over the bound", () => {
    const r = resolveAppointment({
      arrive: at1400,
      duration: { minutes: null, kind: "maximise" },
      bounds: { earliestArrive: "2026-06-03T08:19:00.000Z", latestLeave: "2026-06-03T15:00:00.000Z" },
    });
    expect(r.arrive.time).toBe(at1400.time);
    expect(r.arrive.source).toBe("user_set");
  });

  it("over-constrained arrive+duration+leave prefers arrive+duration (leave recomputed)", () => {
    const r = resolveAppointment({
      arrive: at1400,
      duration: { minutes: 90, kind: "precise" },
      leave: leave1600, // ignored; leave recomputed to 15:30
    });
    expect(r.mode).toBe("fixed");
    expect(r.leave.time).toBe("2026-06-03T14:30:00.000Z");
    expect(r.leave.kind).toBe("derived");
  });

  it("partial: only one value set derives nothing", () => {
    const r = resolveAppointment({ arrive: at1400 });
    expect(r.mode).toBe("partial");
    expect(r.duration.minutes).toBeNull();
    expect(r.leave.time).toBeNull();
    expect(r.arrive.source).toBe("user_set");
  });

  it("attribution source defaults to home_by when the bound says so", () => {
    const r = resolveAppointment({
      duration: { minutes: null, kind: "maximise" },
      bounds: {
        earliestArrive: "2026-06-03T08:19:00.000Z",
        latestLeave: "2026-06-03T16:00:00.000Z",
        latestLeaveSource: "home_by",
      },
    });
    expect(r.leave.source).toBe("home_by");
  });
});

describe("appointmentMicrocopy", () => {
  it("fixed-duration line", () => {
    const r = resolveAppointment({ arrive: at1400, duration: dur120 });
    expect(appointmentMicrocopy(r, TZ)).toBe("2h from 14:00. Leave by 16:00.");
  });

  it("window-fitting line names the duration", () => {
    const r = resolveAppointment({ arrive: at1400, leave: leave1600 });
    expect(appointmentMicrocopy(r, TZ)).toBe(
      "On-site 14:00 – 16:00 (2h). You set the trains.",
    );
  });

  it("maximise line points at the return train when known", () => {
    const r = resolveAppointment({
      duration: { minutes: null, kind: "maximise" },
      bounds: {
        earliestArrive: "2026-06-03T08:19:00.000Z",
        latestLeave: "2026-06-03T13:21:00.000Z",
      },
    });
    expect(appointmentMicrocopy(r, { ...TZ, returnService: "15:08" })).toBe(
      "Stay as long as you need — leave by 14:21 to make the 15:08.",
    );
  });

  it("returns null when there's not enough to say", () => {
    const r = resolveAppointment({ arrive: at1400 });
    expect(appointmentMicrocopy(r, TZ)).toBeNull();
  });
});

describe("arriveAttribution", () => {
  it("names the outbound train", () => {
    const r = resolveAppointment({
      duration: { minutes: null, kind: "maximise" },
      bounds: { earliestArrive: "2026-06-03T08:19:00.000Z", latestLeave: "2026-06-03T13:21:00.000Z" },
    });
    expect(arriveAttribution(r, { ...TZ, outboundService: "07:13 train" })).toBe(
      "Arriving 09:19 — set by your 07:13 train.",
    );
  });

  it("stays quiet for a plain user-set arrival", () => {
    const r = resolveAppointment({ arrive: at1400, duration: dur120 });
    expect(arriveAttribution(r, TZ)).toBeNull();
  });
});
