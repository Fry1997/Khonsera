import { describe, it, expect } from "vitest";
import { parse } from "../parse";
import type { PlaceResolver, ResolvedHub } from "../slots";
import type { ParsedFact } from "../types";

// Fixed reference instant so relative dates ("tomorrow") are deterministic.
const REF = new Date("2026-05-30T09:00:00");

// Fake resolver: a handful of known stations/airports resolve to hubs; saved
// locations resolve to nothing (so event places stay as plain labels).
const HUBS: Record<string, ResolvedHub> = {
  derby: { id: "hub-der", name: "Derby", code: "DER" },
  wellingborough: { id: "hub-wle", name: "Wellingborough", code: "WLE" },
  heathrow: { id: "hub-lhr", name: "London Heathrow", code: "LHR" },
  edinburgh: { id: "hub-edi", name: "Edinburgh", code: "EDI" },
  liverpool: { id: "hub-liv", name: "Liverpool Lime Street", code: "LIV" },
  "liverpool lime street": { id: "hub-liv", name: "Liverpool Lime Street", code: "LIV" },
};
const resolver: PlaceResolver = {
  async resolveHub(name) {
    const hub = HUBS[name.trim().toLowerCase()];
    return { match: hub ?? null, candidates: hub ? [hub] : [] };
  },
  async resolveLocation() {
    return null;
  },
};

const run = (text: string) => parse(text, { ref: REF, resolver });

function byType(facts: ParsedFact[], type: string): ParsedFact[] {
  return facts.filter((f) => f.fact_type === type);
}
function hubId(f: ParsedFact, slot: string): string | undefined {
  const v = f.slots[slot]?.value as { hub_id?: string } | undefined;
  return v?.hub_id;
}
function label(f: ParsedFact, slot: string): unknown {
  return f.slots[slot]?.value;
}

describe("parser corpus — single-fact", () => {
  it("train to Derby tomorrow morning → one train_journey, destination is a hub", async () => {
    const p = await run("Train to Derby tomorrow morning");
    expect(p.facts).toHaveLength(1);
    expect(p.facts[0].fact_type).toBe("train_journey");
    expect(hubId(p.facts[0], "destination")).toBe("hub-der");
    expect(p.facts[0].slots.date).toBeDefined();
  });

  it("meeting with Sarah at 2pm Thursday → scheduled_event with time + person", async () => {
    const p = await run("Meeting with Sarah at 2pm Thursday");
    expect(p.facts).toHaveLength(1);
    expect(p.facts[0].fact_type).toBe("scheduled_event");
    expect(p.facts[0].slots.time?.value).toBe("14:00");
    expect(p.facts[0].slots.date).toBeDefined();
  });

  it("broken greenhouse — sort → undated task held verbatim, NOT a booking_request", async () => {
    const p = await run("Broken greenhouse — sort");
    expect(p.intent_type).toBeNull();
    expect(p.facts).toHaveLength(1);
    expect(p.facts[0].fact_type).toBe("task");
    expect(String(p.facts[0].slots.label.value).toLowerCase()).toContain("greenhouse");
  });

  it("Mum's scan, 22nd → dated note, 'scan' held verbatim (never interpreted)", async () => {
    const p = await run("Mum's scan, 22nd");
    const notes = byType(p.facts, "note");
    expect(notes.length).toBeGreaterThanOrEqual(1);
    const joined = p.facts.map((f) => String(f.slots.label?.value ?? "")).join(" ").toLowerCase();
    expect(joined).toContain("scan");
    // No fact should have been classified as a medical appointment etc.
    expect(p.facts.every((f) => f.fact_type !== "appointment")).toBe(true);
  });

  it("remind me to pack the charger → create_intent, label is the remainder", async () => {
    const p = await run("Remind me to pack the charger");
    expect(p.intent_type).toBe("create_intent");
    expect(p.facts).toHaveLength(1);
    expect(p.facts[0].fact_type).toBe("intent");
    expect(String(p.facts[0].slots.label.value)).toBe("pack the charger");
  });

  it("find me a hotel near the venue → search_request stub, no facts invented", async () => {
    const p = await run("Find me a hotel near the venue");
    expect(p.intent_type).toBe("search_request");
    expect(p.facts).toHaveLength(0);
  });
});

describe("parser corpus — multi-fact (load-bearing)", () => {
  it("Derby demo Wed 11 June, train from Wellingborough → event + train, linked + dated", async () => {
    const p = await run("Derby demo Wed 11 June, train from Wellingborough");
    expect(p.facts.length).toBe(2);
    const event = byType(p.facts, "scheduled_event")[0];
    const train = byType(p.facts, "train_journey")[0];
    expect(event).toBeDefined();
    expect(train).toBeDefined();
    // meeting "in Derby" is the city label, not a station
    expect(label(event, "place")).toBe("Derby");
    // train origin resolves to the WLE hub; destination inferred from the event
    expect(hubId(train, "origin")).toBe("hub-wle");
    expect(hubId(train, "destination")).toBe("hub-der");
    expect(train.slots.destination?.inferred).toBe(true);
    expect(train.links.some((l) => l.kind === "destination_of")).toBe(true);
    // both carry a date
    expect(event.slots.date).toBeDefined();
    expect(train.slots.date).toBeDefined();
  });

  it("train to Derby tomorrow, back same evening → outbound + return, return_of link", async () => {
    const p = await run("Train to Derby tomorrow, back same evening");
    const trains = byType(p.facts, "train_journey");
    expect(trains.length).toBe(2);
    expect(p.facts.some((f) => f.links.some((l) => l.kind === "return_of"))).toBe(true);
  });

  it("flight from Heathrow to Edinburgh on the 22nd, returning Friday → outbound + return flights", async () => {
    const p = await run("Flight from Heathrow to Edinburgh on the 22nd, returning Friday");
    const flights = byType(p.facts, "flight_journey");
    expect(flights.length).toBe(2);
    const outbound = flights[0];
    expect(hubId(outbound, "origin")).toBe("hub-lhr");
    expect(hubId(outbound, "destination")).toBe("hub-edi");
    expect(p.facts.some((f) => f.links.some((l) => l.kind === "return_of"))).toBe(true);
  });

  it("hotel + dinner → at least an accommodation and a meal", async () => {
    const p = await run("Hotel in Soho Thursday and Friday, dinner with Mark Friday at 8");
    expect(byType(p.facts, "accommodation_booking").length).toBeGreaterThanOrEqual(1);
    expect(byType(p.facts, "meal_plan").length).toBeGreaterThanOrEqual(1);
  });
});

describe("parser corpus — place resolution discipline", () => {
  it("'meeting in Derby' keeps Derby as a label, not a hub", async () => {
    const p = await run("Meeting in Derby Tuesday at 10am");
    const event = byType(p.facts, "scheduled_event")[0];
    expect(event).toBeDefined();
    expect(label(event, "place")).toBe("Derby");
  });

  it("'meeting at Derby station' resolves Derby to a hub (explicit station)", async () => {
    const p = await run("Meeting at Derby station Tuesday at 10am");
    const event = byType(p.facts, "scheduled_event")[0];
    expect(event).toBeDefined();
    const v = event.slots.place?.value as { hub_id?: string } | string;
    expect(typeof v === "object" && v.hub_id).toBe("hub-der");
  });

  it("'train to Derby' resolves Derby to a hub", async () => {
    const p = await run("Train to Derby tomorrow");
    expect(hubId(byType(p.facts, "train_journey")[0], "destination")).toBe("hub-der");
  });
});

// Helper: did any fact capture this person name in a person/contact slot?
function personValues(facts: ParsedFact[]): string[] {
  const out: string[] = [];
  for (const f of facts) {
    for (const key of ["person", "contact", "attendees"]) {
      const v = f.slots[key]?.value;
      if (typeof v === "string") out.push(v);
      else if (v && typeof v === "object" && "label" in v) out.push(String((v as { label: unknown }).label));
    }
  }
  return out;
}
const hasPerson = (facts: ParsedFact[], name: string) =>
  personValues(facts).some((v) => v.toLowerCase().includes(name.toLowerCase()));

// First-input test findings (handback §5). Each fixture locks in a fix.
describe("parser corpus — first-input fixes (handback §5)", () => {
  // §5.1 — person extraction adjacent to an event verb; venue held verbatim.
  it("Meeting John Brooks at Frankie & Benny's tomorrow → meeting w/ contact, venue not a person", async () => {
    const p = await run("Meeting John Brooks at Frankie & Benny's tomorrow");
    const event = byType(p.facts, "scheduled_event")[0];
    expect(event).toBeDefined();
    expect(hasPerson(p.facts, "John Brooks")).toBe(true);
    // The venue must NOT have been swallowed into the place as "Be"/empty, and
    // John Brooks must not be the place.
    const place = event.slots.place?.value;
    const placeStr = typeof place === "string" ? place : place && typeof place === "object" && "label" in place ? String((place as { label: unknown }).label) : "";
    expect(placeStr.toLowerCase()).not.toContain("john");
  });

  // §5.2 — operator-cued person ("with John"); multi-token venue survives "&".
  it("Meeting at Franky & Bennies with John tomorrow evening → contact John, low conf from period", async () => {
    const p = await run("Meeting at Franky & Bennies with John tomorrow evening");
    const event = byType(p.facts, "scheduled_event")[0];
    expect(event).toBeDefined();
    expect(hasPerson(p.facts, "John")).toBe(true);
    // "evening" is a soft period → low-confidence time, so the fact can't be high.
    expect(event.confidence).not.toBe("high");
  });

  // §5.3 — be-somewhere with a deadline; "Be" must never be the place.
  it("Be in Liverpool by 10am on Wednesday → place is Liverpool, never 'Be'", async () => {
    const p = await run("Be in Liverpool by 10am on Wednesday");
    expect(p.facts.length).toBeGreaterThanOrEqual(1);
    const f = p.facts[0];
    const place = f.slots.place?.value;
    const placeStr = typeof place === "string" ? place : place && typeof place === "object" && "label" in place ? String((place as { label: unknown }).label) : "";
    expect(placeStr.toLowerCase()).toContain("liverpool");
    // The word "Be" appears nowhere as a slot value.
    for (const slot of Object.values(f.slots)) {
      const v = typeof slot.value === "string" ? slot.value : "";
      expect(v.toLowerCase()).not.toBe("be");
    }
  });

  // §5.4 — clean meeting (currently passing; must stay passing).
  it("Sales demo Bristol next Friday at 13:30 → meeting, time 13:30, place Bristol", async () => {
    const p = await run("Sales demo Bristol next Friday at 13:30");
    const event = byType(p.facts, "scheduled_event")[0];
    expect(event).toBeDefined();
    expect(event.slots.time?.value).toBe("13:30");
    const place = event.slots.place?.value;
    const placeStr = typeof place === "string" ? place : "";
    expect(placeStr.toLowerCase()).toContain("bristol");
  });

  // §5.5 — communication imperative routed to a stub, recipient recognised.
  it("Email Jane tickets for Wednesday's train → communication_request, Jane recognised, NOT a train", async () => {
    const p = await run("Email Jane tickets for Wednesday's train");
    expect(p.intent_type).toBe("communication_request");
    expect(byType(p.facts, "train_journey").length).toBe(0);
    expect(hasPerson(p.facts, "Jane")).toBe(true);
  });

  // §5.6 — call with contact; subordinate clause not split into a second fact.
  it("Call Dave on Thursday morning to arrange sales demo → one call, contact Dave", async () => {
    const p = await run("Call Dave on Thursday morning to arrange sales demo");
    const calls = byType(p.facts, "scheduled_call");
    expect(calls.length).toBe(1);
    expect(hasPerson(p.facts, "Dave")).toBe(true);
    // "morning" is a soft period → call can't be high confidence.
    expect(calls[0].confidence).not.toBe("high");
  });

  // §5.7 — dated loose-thought retains the person (Form A).
  it("Collect tickets from Ricky on Tuesday → note/task w/ date + Ricky as person", async () => {
    const p = await run("Collect tickets from Ricky on Tuesday");
    expect(p.facts.length).toBeGreaterThanOrEqual(1);
    const joined = p.facts.map((f) => String(f.slots.label?.value ?? "")).join(" ").toLowerCase();
    expect(joined).toContain("ricky");
    expect(hasPerson(p.facts, "Ricky")).toBe(true);
  });

  // §5.8 — operator-confused origin: "Wellingborough arriving" → origin Wellingborough.
  it("Train ... from Wellingborough arriving at 09:30 → origin WLE clean, arrival 09:30", async () => {
    const p = await run("Train to Liverpool next Tuesday from Wellingborough arriving at 09:30");
    const train = byType(p.facts, "train_journey")[0];
    expect(train).toBeDefined();
    expect(hubId(train, "origin")).toBe("hub-wle");
    expect(train.slots.arrival_time?.value).toBe("09:30");
    expect(train.slots.departure_time).toBeUndefined();
  });

  it("Train ... from Wellingborough leaving at 09:00 → origin WLE clean, departure 09:00", async () => {
    const p = await run("Train to Liverpool next Tuesday from Wellingborough leaving at 09:00");
    const train = byType(p.facts, "train_journey")[0];
    expect(train).toBeDefined();
    expect(hubId(train, "origin")).toBe("hub-wle");
    expect(train.slots.departure_time?.value).toBe("09:00");
  });

  // §5.9 — gold-standard regression guard: clean multi-word station.
  it("Train to Liverpool Lime Street next Tuesday from Wellingborough at 09:00 → both hubs clean", async () => {
    const p = await run("Train to Liverpool Lime Street next Tuesday from Wellingborough at 09:00");
    const train = byType(p.facts, "train_journey")[0];
    expect(train).toBeDefined();
    expect(hubId(train, "origin")).toBe("hub-wle");
    expect(hubId(train, "destination")).toBe("hub-liv");
    expect(train.slots.departure_time?.value).toBe("09:00");
  });
});

describe("parser — robustness", () => {
  it("never throws and always returns a payload, even on noise", async () => {
    for (const text of ["", "   ", "asdfqwer zxcv", "!!!", "the the the"]) {
      const p = await run(text);
      expect(p.parser_version).toBeTruthy();
      expect(Array.isArray(p.facts)).toBe(true);
    }
  });

  it("an over-long input is held verbatim as a single note", async () => {
    const p = await run("x".repeat(1200));
    expect(p.facts).toHaveLength(1);
    expect(p.facts[0].fact_type).toBe("note");
  });
});
