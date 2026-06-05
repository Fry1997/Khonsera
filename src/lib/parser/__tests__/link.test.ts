import { describe, it, expect } from "vitest";
import { linkFacts } from "../link";
import { nullResolver } from "../slots";
import type { ParsedFact, Slot } from "../types";

function slot(value: unknown): Slot {
  return { value, source_text: String(value), source_range: { start: 0, end: 0 }, confidence: "high", inferred: false };
}

function fact(local_id: string, fact_type: string, slots: Record<string, Slot>): ParsedFact {
  return { local_id, fact_type, slots, links: [], warnings: [], confidence: "high", source_range: { start: 0, end: 0 } };
}

const eventSpan = fact("fact_1", "business_event", {
  date: slot({ start: "2026-06-09", end: "2026-06-11" }),
});

describe("event_day linking", () => {
  it("links a dated fact within the span with a 1-based day index", async () => {
    const meeting = fact("fact_2", "scheduled_event", { date: slot("2026-06-10") });
    const { facts } = await linkFacts([eventSpan, meeting], nullResolver);
    const link = facts.find((f) => f.local_id === "fact_2")!.links.find((l) => l.kind === "event_day");
    expect(link).toBeDefined();
    expect(link!.target).toBe("fact_1");
    expect(link!.day_index).toBe(2);
  });

  it("treats the event's start date as Day 1", async () => {
    const meeting = fact("fact_2", "scheduled_event", { date: slot("2026-06-09") });
    const { facts } = await linkFacts([eventSpan, meeting], nullResolver);
    const link = facts.find((f) => f.local_id === "fact_2")!.links.find((l) => l.kind === "event_day");
    expect(link!.day_index).toBe(1);
  });

  it("does not link a fact outside the span", async () => {
    const meeting = fact("fact_2", "scheduled_event", { date: slot("2026-06-15") });
    const { facts } = await linkFacts([eventSpan, meeting], nullResolver);
    const link = facts.find((f) => f.local_id === "fact_2")!.links.find((l) => l.kind === "event_day");
    expect(link).toBeUndefined();
  });

  it("ignores single-day events (no range)", async () => {
    const single = fact("fact_1", "business_event", { date: slot("2026-06-09") });
    const meeting = fact("fact_2", "scheduled_event", { date: slot("2026-06-09") });
    const { facts } = await linkFacts([single, meeting], nullResolver);
    const link = facts.find((f) => f.local_id === "fact_2")!.links.find((l) => l.kind === "event_day");
    expect(link).toBeUndefined();
  });
});
