import { describe, it, expect } from "vitest";
import { parse } from "../parse";
import { factsToBrief, factIsBooked } from "../materialise";
import type { PlaceResolver, ResolvedHub } from "../slots";

const REF = new Date("2026-05-30T09:00:00");
const HUBS: Record<string, ResolvedHub> = {
  derby: { id: "hub-der", name: "Derby", code: "DER" },
  wellingborough: { id: "hub-wle", name: "Wellingborough", code: "WLE" },
};
const resolver: PlaceResolver = {
  async resolveHub(n) {
    const h = HUBS[n.trim().toLowerCase()];
    return { match: h ?? null, candidates: h ? [h] : [] };
  },
  async resolveLocation() {
    return null;
  },
};
const run = (t: string) => parse(t, { ref: REF, resolver });

describe("materialisation — transition vs travel_booking (§16)", () => {
  it("bare 'train to Derby tomorrow' → a planned transition, NOT a travel_booking", async () => {
    const plan = factsToBrief(await run("Train to Derby tomorrow"));
    expect(plan.brief.transport_bookings).toHaveLength(0);
    expect(plan.brief.transitions.some((t) => t.mode === "train")).toBe(true);
  });

  it("'booked train to Derby tomorrow, ref ABC123' → a travel_booking", async () => {
    const payload = await run("Booked train to Derby tomorrow, ref ABC123");
    expect(payload.facts.some((f) => factIsBooked(f, payload.original_text))).toBe(true);
    const plan = factsToBrief(payload);
    expect(plan.brief.transport_bookings.length).toBeGreaterThanOrEqual(1);
    expect(plan.brief.transport_bookings[0].mode).toBe("train");
  });

  it("'Meeting with Sarah at 2pm Thursday' → an appointment anchor", async () => {
    const plan = factsToBrief(await run("Meeting with Sarah at 2pm Thursday"));
    expect(plan.brief.anchors.some((a) => a.kind === "appointment" && a.time === "14:00")).toBe(true);
  });

  it("'remind me to water the plants' → an intent draft, no anchors", async () => {
    const plan = factsToBrief(await run("Remind me to water the plants"));
    expect(plan.intents.map((i) => i.label)).toContain("water the plants");
    expect(plan.brief.anchors).toHaveLength(0);
  });

  it("accommodation → an accommodation_booking with check-in/out", async () => {
    const plan = factsToBrief(await run("Hotel in Derby Thursday and Friday"));
    expect(plan.brief.accommodation_bookings.length).toBeGreaterThanOrEqual(1);
  });

  it("a bound contact on an event flows to the anchor's contact_id", async () => {
    const payload = await run("Meeting with Sarah at 2pm Thursday");
    // Simulate the user binding the person slot to a real contact (as the
    // capture screen's PersonEditor does via corrections).
    const event = payload.facts.find((f) => f.fact_type === "scheduled_event")!;
    event.slots.contact = {
      value: { contact_id: "contact-123", label: "Sarah" },
      source_text: "Sarah",
      source_range: { start: 0, end: 5 },
      confidence: "high",
      inferred: false,
    };
    const plan = factsToBrief(payload);
    const anchor = plan.brief.anchors.find((a) => a.kind === "appointment")!;
    expect(anchor.contact_id).toBe("contact-123");
  });
});
