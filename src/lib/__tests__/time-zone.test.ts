import { describe, expect, it } from "vitest";
import { wallClockToIso } from "@/lib/time-zone";

// The bug this guards: wallClockToIso runs both server-side (UTC) and client-side
// (the user's browser, already Europe/London). It must give the SAME, correct UTC
// instant regardless of the runtime zone — a 09:00 entry in BST is 08:00Z, not
// 09:00Z (which rendered as 10:00).
describe("wallClockToIso (Europe/London)", () => {
  it("treats a summer (BST) wall clock as UTC+1", () => {
    expect(wallClockToIso("2026-06-11", "09:00")).toBe("2026-06-11T08:00:00.000Z");
    expect(wallClockToIso("2026-06-11", "17:00")).toBe("2026-06-11T16:00:00.000Z");
  });

  it("treats a winter (GMT) wall clock as UTC+0", () => {
    expect(wallClockToIso("2026-01-15", "09:00")).toBe("2026-01-15T09:00:00.000Z");
  });

  it("returns empty string for missing input", () => {
    expect(wallClockToIso("", "09:00")).toBe("");
    expect(wallClockToIso("2026-06-11", "")).toBe("");
  });
});
