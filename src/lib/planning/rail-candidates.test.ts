import { describe, expect, it } from "vitest";
import {
  deriveOutbound,
  deriveReturn,
  pairFare,
  qualifiesForReturnFare,
  type RailCandidate,
} from "./rail-candidates";
import { boardingBufferMinutes, STATION_DWELL_MINUTES } from "./buffers";

const out: RailCandidate = {
  dep: "2026-06-03T06:13:00.000Z",
  arr: "2026-06-03T07:32:00.000Z",
  durationMinutes: 79,
  changes: 1,
  peak: false,
  pricePence: 3200,
  serviceNumbers: ["EMR-1A23"],
};

const ret: RailCandidate = {
  dep: "2026-06-03T13:08:00.000Z",
  arr: "2026-06-03T14:32:00.000Z",
  durationMinutes: 84,
  changes: 1,
  peak: false,
  pricePence: 3200,
  serviceNumbers: ["EMR-9F12"],
};

const min = (iso: string) => new Date(iso).getTime() / 60_000;

describe("deriveOutbound", () => {
  it("backs leave_home off dep by first-mile + board + station entry", () => {
    const d = deriveOutbound(out, { firstMileMinutes: 7, lastMileMinutes: 9 });
    const expected =
      min(out.dep) - (7 + boardingBufferMinutes("train") + STATION_DWELL_MINUTES);
    expect(min(d.leaveHome)).toBe(expected);
  });

  it("pushes on_site_start past arr by station exit + last-mile", () => {
    const d = deriveOutbound(out, { firstMileMinutes: 7, lastMileMinutes: 9 });
    expect(min(d.onSiteStart)).toBe(min(out.arr) + STATION_DWELL_MINUTES + 9);
  });

  it("adds the optional venue arrival margin", () => {
    const d = deriveOutbound(out, {
      firstMileMinutes: 7,
      lastMileMinutes: 9,
      venueArrivalBufferMinutes: 10,
    });
    expect(min(d.onSiteStart)).toBe(
      min(out.arr) + STATION_DWELL_MINUTES + 9 + 10,
    );
  });
});

describe("deriveReturn", () => {
  it("backs leave_appointment_by off dep by to-station + board + entry + leave margin", () => {
    const d = deriveReturn(ret, {
      toStationMinutes: 9,
      toHomeMinutes: 7,
      leaveVenueBufferMinutes: 5,
    });
    const expected =
      min(ret.dep) -
      (9 + boardingBufferMinutes("train") + STATION_DWELL_MINUTES + 5);
    expect(min(d.leaveAppointmentBy)).toBe(expected);
  });

  it("pushes arrive_home past arr by station exit + last-mile home", () => {
    const d = deriveReturn(ret, { toStationMinutes: 9, toHomeMinutes: 7 });
    expect(min(d.arriveHome)).toBe(min(ret.arr) + STATION_DWELL_MINUTES + 7);
  });
});

describe("pairFare", () => {
  it("discounts an off-peak same-operator pair ~20% off two singles", () => {
    const sameOp = { ...ret, serviceNumbers: ["EMR-9F12"] };
    const f = pairFare(out, sameOp);
    expect(f.qualifiesForReturnFare).toBe(true);
    expect(f.twoSinglesPence).toBe(6400);
    expect(f.returnTicketPricePence).toBe(5120); // round(6400 * 0.8)
    expect(f.savingsVsTwoSinglesPence).toBe(1280);
  });

  it("shows two singles honestly when a leg is peak", () => {
    const peakReturn = { ...ret, peak: true };
    const f = pairFare(out, peakReturn);
    expect(f.qualifiesForReturnFare).toBe(false);
    expect(f.returnTicketPricePence).toBe(6400);
    expect(f.savingsVsTwoSinglesPence).toBe(0);
  });

  it("does not pair across different operators", () => {
    const otherOp = { ...ret, serviceNumbers: ["XC-9F12"] };
    expect(qualifiesForReturnFare(out, otherOp)).toBe(false);
    expect(pairFare(out, otherOp).savingsVsTwoSinglesPence).toBe(0);
  });

  it("handles unknown prices without inventing a fare", () => {
    const noPrice = { ...ret, pricePence: null };
    const f = pairFare(out, noPrice);
    expect(f.twoSinglesPence).toBeNull();
    expect(f.returnTicketPricePence).toBeNull();
  });
});
