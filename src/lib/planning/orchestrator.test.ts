import { describe, expect, it } from "vitest";
import {
  buildDriveOption,
  buildRailOption,
  rankBuiltOptions,
  type PlanningInput,
} from "./orchestrator";

const APPT = new Date("2026-05-21T09:00:00.000Z"); // 10:00 Europe/London

const baseInput: PlanningInput = {
  appointmentStart: APPT,
  meetingDurationMinutes: 120,
  arrivalBufferMinutes: 15,
  returnBufferMinutes: 15,
  preferredMode: "compare",
  timezone: "Europe/London",
};

describe("buildRailOption", () => {
  it("assembles legs and a recommended verdict for a comfortable journey", () => {
    const opt = buildRailOption(baseInput, {
      outboundDepartAt: new Date(APPT.getTime() - 150 * 60_000),
      outboundArriveAt: new Date(APPT.getTime() - 30 * 60_000),
      outboundDurationMinutes: 120,
      outboundChanges: 1,
      outboundEstimatedPrice: 42,
      outboundServiceNumbers: ["EMR-1A23"],
      outboundOriginStation: "Wellingborough",
      outboundDestinationStation: "Derby",
      returnDepartAt: new Date(APPT.getTime() + 145 * 60_000),
      returnArriveAt: new Date(APPT.getTime() + 285 * 60_000),
      returnDurationMinutes: 140,
      returnChanges: 1,
      returnEstimatedPrice: 42,
      walkToSiteMinutes: 9,
      walkFromSiteMinutes: 9,
    });

    expect(opt.mode).toBe("rail");
    expect(opt.feasibilityStatus).toBe("recommended");
    expect(opt.totalCostEstimate).toBe(84);
    expect(opt.legs[0].legType).toBe("walk");
    expect(opt.legs[1].legType).toBe("train");
    expect(opt.legs[3].legType).toBe("meeting");
    expect(opt.legs[5].legType).toBe("train");
  });

  it("marks the visit not_possible when the rail arrival is past the appointment start", () => {
    const opt = buildRailOption(baseInput, {
      outboundDepartAt: new Date(APPT.getTime() - 30 * 60_000),
      outboundArriveAt: new Date(APPT.getTime() + 15 * 60_000), // arrives AFTER meeting starts
      outboundDurationMinutes: 45,
      outboundChanges: 0,
      outboundServiceNumbers: [],
      outboundOriginStation: "A",
      outboundDestinationStation: "B",
      returnDepartAt: new Date(APPT.getTime() + 200 * 60_000),
      returnArriveAt: new Date(APPT.getTime() + 320 * 60_000),
      returnDurationMinutes: 120,
      returnChanges: 0,
      walkToSiteMinutes: 9,
      walkFromSiteMinutes: 9,
    });
    expect(opt.feasibilityStatus).toBe("not_possible");
  });
});

describe("buildDriveOption", () => {
  it("computes total cost from mileage + parking", () => {
    const opt = buildDriveOption(baseInput, {
      leaveOriginAt: new Date(APPT.getTime() - 168 * 60_000),
      arriveSiteAt: new Date(APPT.getTime() - 15 * 60_000),
      durationMinutes: 153,
      distanceMiles: 100,
      mileageRate: 0.45,
      parkingCostEstimate: 8,
      returnDurationMinutes: 160,
    });
    expect(opt.totalCostEstimate).toBeCloseTo(53);
    expect(opt.feasibilityStatus).toBe("recommended");
    expect(opt.legs[0].legType).toBe("drive");
    expect(opt.legs[1].legType).toBe("meeting");
    expect(opt.legs[2].legType).toBe("drive");
  });
});

describe("rankBuiltOptions", () => {
  it("puts the more-feasible option first; preference breaks ties", () => {
    const rail = buildRailOption(baseInput, {
      outboundDepartAt: new Date(APPT.getTime() - 150 * 60_000),
      outboundArriveAt: new Date(APPT.getTime() - 30 * 60_000),
      outboundDurationMinutes: 120,
      outboundChanges: 1,
      outboundEstimatedPrice: 84,
      outboundServiceNumbers: [],
      outboundOriginStation: "A",
      outboundDestinationStation: "B",
      returnDepartAt: new Date(APPT.getTime() + 145 * 60_000),
      returnArriveAt: new Date(APPT.getTime() + 285 * 60_000),
      returnDurationMinutes: 140,
      returnChanges: 1,
      walkToSiteMinutes: 9,
      walkFromSiteMinutes: 9,
    });
    const drive = buildDriveOption(baseInput, {
      leaveOriginAt: new Date(APPT.getTime() - 168 * 60_000),
      arriveSiteAt: new Date(APPT.getTime() - 15 * 60_000),
      durationMinutes: 153,
      distanceMiles: 178,
      mileageRate: 0.45,
      returnDurationMinutes: 160,
    });

    expect(rankBuiltOptions([rail, drive], "rail")[0].mode).toBe("rail");
    expect(rankBuiltOptions([rail, drive], "drive")[0].mode).toBe("drive");
  });
});
