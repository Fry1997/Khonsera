import { describe, it, expect } from "vitest";
import { projectToday, type ProjectionStop } from "./today";

const day = "2026-06-10";
const at = (hhmm: string) => `${day}T${hhmm}:00.000Z`;
const now = (hhmm: string) => new Date(`${day}T${hhmm}:00.000Z`).getTime();

const plan: ProjectionStop[] = [
  { id: "home", title: "Home", start: at("09:00"), end: at("09:00"), hasLegAfter: true },
  { id: "mtg", title: "Client meeting", start: at("11:00"), end: at("16:00"), hasLegAfter: true },
  { id: "back", title: "Home", start: at("18:00"), end: at("18:00") },
];

describe("projectToday", () => {
  it("is dormant when there is no plan", () => {
    expect(projectToday([], now("10:00")).state).toBe("dormant");
  });

  it("is readiness before the day starts (same day)", () => {
    const p = projectToday(plan, now("07:30"));
    expect(p.state).toBe("readiness");
    expect(p.leaveByIso).toBe(at("09:00"));
  });

  it("is dormant before a future day's plan", () => {
    const earlier = projectToday(plan, new Date(`2026-06-09T07:30:00.000Z`).getTime());
    expect(earlier.state).toBe("dormant");
  });

  it("is in-transit between a departed stop and the next arrival", () => {
    // 09:00 home departs (has leg), 11:00 meeting — at 10:00 we're mid-leg.
    const p = projectToday(plan, now("10:00"));
    expect(p.state).toBe("in-transit");
    expect(p.nextIndex).toBe(1);
  });

  it("is arrived while at an anchor with time still ahead", () => {
    const p = projectToday(plan, now("12:00"));
    expect(p.state).toBe("arrived");
    expect(p.currentIndex).toBe(1);
  });

  it("is breach when past the leave-by but still pre-departure", () => {
    // meeting ends 16:00 (leave-by); at 17:00 we're past it, before 18:00 home.
    const p = projectToday(plan, now("17:00"));
    expect(p.state).toBe("in-transit");
    expect(p.urgency).toBe("comfortable");
  });

  it("is dormant after the day ends", () => {
    expect(projectToday(plan, now("19:00")).state).toBe("dormant");
  });
});
