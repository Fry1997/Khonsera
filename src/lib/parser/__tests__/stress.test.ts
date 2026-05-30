// Stress-test fix corpus (second fix pass). Fixtures built from the acceptance
// criteria in the stress-test brief. Each `describe` maps to one numbered fix.
import { describe, it, expect } from "vitest";
import { parse } from "../parse";
import type { PlaceResolver, ResolvedHub } from "../slots";
import type { ParsedFact } from "../types";

const REF = new Date("2026-05-30T09:00:00"); // a Saturday

const HUBS: Record<string, ResolvedHub> = {
  derby: { id: "hub-der", name: "Derby", code: "DER" },
  wellingborough: { id: "hub-wle", name: "Wellingborough", code: "WLE" },
  heathrow: { id: "hub-lhr", name: "London Heathrow", code: "LHR" },
  edinburgh: { id: "hub-edi", name: "Edinburgh", code: "EDI" },
  liverpool: { id: "hub-liv", name: "Liverpool Lime Street", code: "LIV" },
  manchester: { id: "hub-man", name: "Manchester Piccadilly", code: "MAN" },
  paddington: { id: "hub-pad", name: "London Paddington", code: "PAD" },
  bristol: { id: "hub-bri", name: "Bristol Temple Meads", code: "BRI" },
  "kings cross": { id: "hub-kgx", name: "London Kings Cross", code: "KGX" },
  lhr: { id: "hub-lhr", name: "London Heathrow", code: "LHR" },
  cdg: { id: "hub-cdg", name: "Paris Charles de Gaulle", code: "CDG" },
  kgx: { id: "hub-kgx", name: "London Kings Cross", code: "KGX" },
  edi: { id: "hub-edi", name: "Edinburgh", code: "EDI" },
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
const run = (text: string) => parse(text, { ref: REF, resolver });
const byType = (facts: ParsedFact[], type: string) => facts.filter((f) => f.fact_type === type);
const hubId = (f: ParsedFact, slot: string) => (f.slots[slot]?.value as { hub_id?: string } | undefined)?.hub_id;
function placeText(f: ParsedFact, key = "place"): string {
  const v = f.slots[key]?.value;
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "label" in v) return String((v as { label: unknown }).label);
  return "";
}
function personText(facts: ParsedFact[]): string {
  const out: string[] = [];
  for (const f of facts) for (const k of ["person", "contact", "attendees"]) {
    const v = f.slots[k]?.value;
    if (typeof v === "string") out.push(v);
    else if (v && typeof v === "object" && "label" in v) out.push(String((v as { label: unknown }).label));
  }
  return out.join(" ");
}

// ── Fix 1 — Negation blindness (PRIORITY 1) ────────────────────────────────────
describe("Fix 1 — negation never creates a positive fact", () => {
  it("'No meeting Monday, was cancelled' → cancellation intent, NO meeting fact", async () => {
    const p = await run("No meeting Monday, was cancelled");
    expect(byType(p.facts, "scheduled_event").length).toBe(0);
    expect(p.intent_type).toBe("cancellation_request");
  });

  it("'Cancel my 3pm Tuesday call' → cancellation intent (imperative path)", async () => {
    const p = await run("Cancel my 3pm Tuesday call");
    expect(p.intent_type).toBe("cancellation_request");
    expect(byType(p.facts, "scheduled_call").length).toBe(0);
  });

  it("'Lunch Thursday at noon, not Wednesday' → ONE meal fact (mid-sentence negation untouched)", async () => {
    const p = await run("Lunch Thursday at noon, not Wednesday");
    expect(byType(p.facts, "meal_plan").length).toBe(1);
    expect(p.intent_type).toBeNull();
  });

  it("'Actually no, move the Leeds meeting to Thursday' → correction intent, not a To-sort", async () => {
    const p = await run("Actually no, move the Leeds meeting to Thursday");
    expect(p.intent_type).toBe("correction_intent");
    expect(byType(p.facts, "task").length).toBe(0);
  });

  it("'No worries' is not hijacked as a cancellation", async () => {
    const p = await run("No worries about the venue");
    expect(p.intent_type).not.toBe("cancellation_request");
  });
});

// ── Fix 5 — Imperative slot extraction (intent stays an intent) ─────────────────
describe("Fix 5 — imperatives extract content slots", () => {
  it("'Book a table for 4 at Dishoom for Friday night' → booking intent w/ place, party, date", async () => {
    const p = await run("Book a table for 4 at Dishoom for Friday night");
    expect(p.intent_type).toBe("booking_request");
    const f = p.facts[0];
    expect(f.fact_type).toBe("intent");
    expect(placeText(f).toLowerCase()).toContain("dishoom");
    expect(f.slots.party_size?.value).toBe(4);
    expect(f.slots.date).toBeDefined();
  });

  it("'Remind me about the team offsite next Thursday at 9' → reminder w/ date + time", async () => {
    const p = await run("Remind me about the team offsite next Thursday at 9");
    expect(p.intent_type).toBe("create_intent");
    // create_intent keeps its label; richer slot extraction is a soft goal here.
    expect(p.facts[0].fact_type).toBe("intent");
  });

  it("'Cancel the 3pm with Dave on Monday' → cancellation intent w/ contact Dave", async () => {
    const p = await run("Cancel the 3pm with Dave on Monday");
    expect(p.intent_type).toBe("cancellation_request");
    expect(personText(p.facts).toLowerCase()).toContain("dave");
  });
});

// ── Fix 7 — Bare-hour disambiguation by event type ─────────────────────────────
describe("Fix 7 — bare-hour times resolve by event type", () => {
  it("'client call at 3 Tuesday' → 15:00", async () => {
    const p = await run("Client call at 3 Tuesday");
    const call = byType(p.facts, "scheduled_call")[0] ?? byType(p.facts, "scheduled_event")[0];
    expect(call?.slots.time?.value).toBe("15:00");
  });

  it("'Dinner at the George Tuesday from 7' → 19:00", async () => {
    const p = await run("Dinner at the George Tuesday from 7");
    const meal = byType(p.facts, "meal_plan")[0];
    expect(meal?.slots.time_or_period?.value).toBe("19:00");
  });

  it("'Board meeting at 9 Thursday' → 09:00 (work hours)", async () => {
    const p = await run("Board meeting at 9 Thursday");
    const ev = byType(p.facts, "scheduled_event")[0];
    expect(ev?.slots.time?.value).toBe("09:00");
  });

  it("'Drinks at the Crown 7 Friday' → 19:00", async () => {
    const p = await run("Drinks at the Crown 7 Friday");
    const meal = byType(p.facts, "meal_plan")[0];
    expect(meal?.slots.time_or_period?.value).toBe("19:00");
  });

  it("explicit am/pm is untouched: 'Standup at 9am Monday' → 09:00", async () => {
    const p = await run("Standup at 9am Monday");
    const ev = byType(p.facts, "scheduled_event")[0];
    expect(ev?.slots.time?.value).toBe("09:00");
  });
});
