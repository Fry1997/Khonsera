import { describe, it, expect } from "vitest";
import { parse } from "../parse";
import { nullResolver } from "../slots";

// Regression tests for natural-phrasing fixes surfaced in capture UX testing.
const REF = new Date("2026-05-30T09:00:00"); // a Saturday
const run = (t: string) => parse(t, { ref: REF, resolver: nullResolver });

function placeLabel(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "label" in value) return String((value as { label: unknown }).label);
  return null;
}

describe("place extraction — lowercase venues after an article", () => {
  it("captures 'at the cheese factory' as a place, not stopping on 'the'", async () => {
    const p = await run("meeting Chris at the cheese factory Thursday");
    const event = p.facts.find((f) => f.fact_type === "scheduled_event");
    expect(placeLabel(event?.slots.place?.value)).toBe("cheese factory");
  });

  it("does not treat a sentence-initial modal verb as a place", async () => {
    const p = await run("Will need to check in at the premier inn");
    for (const f of p.facts) {
      expect(placeLabel(f.slots.place?.value)).not.toBe("Will need");
    }
  });
});

describe("segmentation — a connector inside a date span doesn't split", () => {
  it("keeps 'next Thursday meeting Chris ...' as one dated meeting", async () => {
    const p = await run("next Thursday meeting Chris at the cheese factory");
    // No orphan 'next' note.
    expect(p.facts.some((f) => f.fact_type === "note" && f.slots.label?.value === "next")).toBe(false);
    const event = p.facts.find((f) => f.fact_type === "scheduled_event");
    expect(event).toBeDefined();
    // The date attaches to the meeting, not a stray note. "next Thursday" → 4 June.
    expect(event!.slots.date?.value).toBe("2026-06-04");
    expect(placeLabel(event!.slots.place?.value)).toBe("cheese factory");
  });
});
