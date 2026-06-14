import { describe, it, expect } from "vitest";
import { decisionClock, delayConsequence, slackMinutes, cascade, fragility, type Connection } from "./engine";

const conn = (over: Partial<Connection> = {}): Connection => ({
  id: "c1",
  intoName: "the 09:40 to Derby",
  arriveIso: "2026-07-01T09:30:00Z",
  deadlineIso: "2026-07-01T09:40:00Z",
  kind: "connection",
  ...over,
});

describe("live engine", () => {
  it("slack is arrival-to-deadline minutes", () => {
    expect(slackMinutes(conn())).toBe(10);
  });

  it("a delay within slack is reassuring, not broken", () => {
    const c = delayConsequence(conn(), 6);
    expect(c.broken).toBe(false);
    expect(c.text).toContain("still fine");
  });

  it("a delay beyond slack breaks the connection with an act-by", () => {
    const c = delayConsequence(conn(), 12); // 9:30 + 12 = 9:42 > 9:40
    expect(c.broken).toBe(true);
    expect(c.lateMin).toBe(2);
    expect(c.text).toContain("miss");
    expect(c.actByLabel).toBe("10:40"); // 09:40 UTC rendered Europe/London (BST)
  });

  it("a commitment runs late rather than 'missed'", () => {
    const c = delayConsequence(conn({ intoName: "your 10:00 meeting", kind: "commitment", deadlineIso: "2026-07-01T10:00:00Z", arriveIso: "2026-07-01T09:55:00Z" }), 15);
    expect(c.broken).toBe(true);
    expect(c.text).toContain("late for your 10:00 meeting");
    expect(c.text).not.toContain("miss");
  });

  it("decision-clock picks the thinnest-slack upcoming deadline", () => {
    const comfy = conn({ id: "a", intoName: "lunch", deadlineIso: "2026-07-01T12:00:00Z", arriveIso: "2026-07-01T11:00:00Z", kind: "commitment" });
    const tight = conn({ id: "b", intoName: "the 09:40", deadlineIso: "2026-07-01T09:40:00Z", arriveIso: "2026-07-01T09:35:00Z" });
    const dc = decisionClock([comfy, tight], "2026-07-01T09:00:00Z");
    expect(dc?.for).toBe("the 09:40");
    expect(dc?.tight).toBe(true);
  });

  it("fragility flags the thinnest connection as one delay from collapse", () => {
    expect(fragility([25, 8, 40]).fragile).toBe(true);
    expect(fragility([25, 8, 40]).weakestSlackMin).toBe(8);
    expect(fragility([25, 40]).fragile).toBe(false);
    expect(fragility([]).fragile).toBe(false);
  });

  it("cascade carries a missed hard connection's lateness onward", () => {
    const legs: Connection[] = [
      conn({ id: "1", intoName: "the 09:40", arriveIso: "2026-07-01T09:30:00Z", deadlineIso: "2026-07-01T09:40:00Z", kind: "connection" }),
      conn({ id: "2", intoName: "your 10:30 meeting", arriveIso: "2026-07-01T10:15:00Z", deadlineIso: "2026-07-01T10:30:00Z", kind: "commitment" }),
    ];
    const res = cascade(legs, 18); // miss the 09:40 by 8 → cascades
    expect(res.some((c) => c.broken)).toBe(true);
  });
});
