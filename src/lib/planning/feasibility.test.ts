import { describe, expect, it } from "vitest";
import { evaluateFeasibility } from "./feasibility";

// Anchor date so test output is stable. Thursday at 10:00 BST.
const ANCHOR = new Date("2026-05-21T09:00:00.000Z"); // 10:00 Europe/London

function at(offsetMinutes: number) {
  return new Date(ANCHOR.getTime() + offsetMinutes * 60_000);
}

const baseInput = {
  appointmentStart: at(0), // 10:00
  appointmentEnd: at(120), // 12:00
  arriveSiteAt: at(-30), // 09:30 (30 min before)
  leaveSiteAt: at(125),
  arrivalBufferMinutes: 15,
  returnBufferMinutes: 15,
  timezone: "Europe/London",
};

describe("evaluateFeasibility", () => {
  it("recommends when arrival has plenty of buffer and no return constraint", () => {
    const v = evaluateFeasibility(baseInput);
    expect(v.status).toBe("recommended");
    expect(v.reasons).toEqual([]);
  });

  it("blocks when arrival is after appointment start", () => {
    const v = evaluateFeasibility({ ...baseInput, arriveSiteAt: at(12) });
    expect(v.status).toBe("not_possible");
    expect(v.reasons[0].code).toBe("arrival_after_appointment");
    expect(v.suggestedWording).toMatch(/can't realistically make/);
  });

  it("flags tight when arrival buffer < target", () => {
    const v = evaluateFeasibility({
      ...baseInput,
      arriveSiteAt: at(-5), // 09:55, only 5 min buffer
    });
    expect(v.status).toBe("tight");
    expect(v.reasons[0].code).toBe("arrival_buffer_low");
  });

  it("blocks when return is past latest return time", () => {
    const v = evaluateFeasibility({
      ...baseInput,
      arriveReturnLocationAt: at(360), // 16:00
      latestReturnTime: at(300), // 15:00
    });
    expect(v.status).toBe("not_possible");
    expect(v.reasons[0].code).toBe("return_after_latest");
  });

  it("flags tight when return buffer is too small", () => {
    const v = evaluateFeasibility({
      ...baseInput,
      arriveReturnLocationAt: at(300),
      latestReturnTime: at(305), // only 5 min buffer
    });
    expect(v.status).toBe("tight");
    expect(v.reasons[0].code).toBe("return_buffer_low");
  });

  it("downgrades to not_recommended when calendar conflicts exist", () => {
    const v = evaluateFeasibility({
      ...baseInput,
      conflictTitles: ["1:1 with Sam"],
    });
    expect(v.status).toBe("not_recommended");
    expect(v.reasons[0].code).toBe("calendar_conflict");
  });

  it("downgrades to not_recommended with two minor issues", () => {
    const v = evaluateFeasibility({
      ...baseInput,
      arriveSiteAt: at(-5),
      arriveReturnLocationAt: at(300),
      latestReturnTime: at(305),
    });
    expect(v.status).toBe("not_recommended");
    expect(v.reasons).toHaveLength(2);
  });

  it("includes day-of-week in suggested wording", () => {
    const v = evaluateFeasibility(baseInput);
    expect(v.suggestedWording).toMatch(/Thursday/);
  });
});
