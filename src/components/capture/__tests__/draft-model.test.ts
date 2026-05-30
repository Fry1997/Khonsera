import { describe, it, expect } from "vitest";
import {
  applyCorrections,
  buildConfirmPayload,
  factTypeLabel,
  formatDateHuman,
  formatSlotValue,
  includedFacts,
  pruneCorrections,
  slotEntityStatus,
  factAnchor,
  sortCandidatesByProximity,
  type Corrections,
} from "../draft-model";
import type { ParsedFact, ParsedPayload, Slot } from "@/lib/parser/types";

const slot = (value: unknown, extra: Partial<Slot> = {}): Slot => ({
  value,
  source_text: "x",
  source_range: { start: 0, end: 1 },
  confidence: "medium",
  inferred: false,
  ...extra,
});

const fact = (local_id: string, fact_type: string, slots: Record<string, Slot>): ParsedFact => ({
  local_id,
  fact_type,
  slots,
  links: [],
  warnings: [],
  confidence: "medium",
  source_range: { start: 0, end: 1 },
});

const payload = (facts: ParsedFact[]): ParsedPayload => ({
  parser_version: "test",
  original_text: "t",
  facts,
  input_level_warnings: [],
  ambiguities: [],
  unmatched_text: [],
  intent_type: null,
});

describe("labels + formatting", () => {
  it("maps fact-types to human labels", () => {
    expect(factTypeLabel("train_journey")).toBe("Train journey");
    expect(factTypeLabel("scheduled_event")).toBe("Meeting");
    expect(factTypeLabel("note")).toBe("Loose thought");
    expect(factTypeLabel("unknown_type")).toBe("Note");
  });

  it("formats dates and values voice-safely", () => {
    expect(formatDateHuman("2026-06-11")).toBe("Thu 11 June");
    expect(formatSlotValue(slot("2026-06-11"))).toBe("Thu 11 June");
    expect(formatSlotValue(slot("14:00"))).toBe("14:00");
    expect(formatSlotValue(slot({ hub_id: "h", label: "Derby", code: "DER" }))).toBe("Derby (DER)");
    expect(formatSlotValue(slot({ amount: 38.5, currency: "GBP", constraint: "approximate" }))).toBe("around £38.50");
    expect(formatSlotValue(slot(null))).toBe("not set");
  });
});

describe("correction model", () => {
  it("prunes corrections whose fact vanished, signalling a rebuild", () => {
    const p = payload([fact("fact_1", "train_journey", {})]);
    const corr: Corrections = {
      fact_1: { origin: slot("Derby") },
      fact_2: { place: slot("Soho") },
    };
    const { corrections, dropped } = pruneCorrections(p, corr);
    expect(corrections.fact_1).toBeDefined();
    expect(corrections.fact_2).toBeUndefined();
    expect(dropped).toBe(true);
  });

  it("applies corrections and drops dismissed facts", () => {
    const p = payload([
      fact("fact_1", "scheduled_event", { place: slot("Derby") }),
      fact("fact_2", "train_journey", { origin: slot("WLE") }),
    ]);
    const corr: Corrections = { fact_1: { place: slot({ location_id: "loc", label: "ACME HQ" }, { confidence: "high" }) } };
    const dismissed = new Set(["fact_2"]);
    const out = buildConfirmPayload(p, corr, dismissed);
    expect(out.facts).toHaveLength(1);
    expect(out.facts[0].local_id).toBe("fact_1");
    expect(formatSlotValue(out.facts[0].slots.place)).toBe("ACME HQ");
  });

  it("includedFacts respects dismiss", () => {
    const p = payload([fact("fact_1", "note", {}), fact("fact_2", "note", {})]);
    expect(includedFacts(p, new Set(["fact_1"])).map((f) => f.local_id)).toEqual(["fact_2"]);
  });

  it("applyCorrections is non-mutating", () => {
    const original = fact("fact_1", "meal_plan", { place: slot("George") });
    const p = payload([original]);
    applyCorrections(p, { fact_1: { place: slot("Crown") } }, new Set());
    expect(formatSlotValue(p.facts[0].slots.place)).toBe("George");
  });
});

describe("slotEntityStatus", () => {
  it("returns null for non-entity slots", () => {
    expect(slotEntityStatus(slot("2026-06-10"), "date")).toBeNull();
    expect(slotEntityStatus(slot("hello"), "text")).toBeNull();
  });
  it("is bound when the value carries a resolved id", () => {
    expect(slotEntityStatus(slot({ hub_id: "h1", label: "Derby" }), "hub")).toBe("bound");
    expect(slotEntityStatus(slot({ location_id: "l1", label: "Office" }), "place")).toBe("bound");
    expect(slotEntityStatus(slot({ contact_id: "c1", label: "Sam" }), "person")).toBe("bound");
  });
  it("is ambiguous when flagged", () => {
    expect(slotEntityStatus(slot("Liverpool", { ambiguous: true }), "hub")).toBe("ambiguous");
  });
  it("is unknown for a verbatim entity label", () => {
    expect(slotEntityStatus(slot("Nando's"), "place")).toBe("unknown");
  });
  it("is null when the slot is absent", () => {
    expect(slotEntityStatus(undefined, "hub")).toBeNull();
  });
});

describe("factAnchor", () => {
  it("finds the first slot value carrying coordinates", () => {
    const f = fact("fact_1", "scheduled_event", {
      date: slot("2026-06-10"),
      place: slot({ location_id: "l1", label: "Office", latitude: 52.9, longitude: -1.47 }),
    });
    expect(factAnchor(f)).toEqual({ lat: 52.9, lng: -1.47 });
  });
  it("returns null when no slot has coordinates", () => {
    expect(factAnchor(fact("fact_1", "note", { label: slot("hi") }))).toBeNull();
  });
});

describe("sortCandidatesByProximity", () => {
  const near = { lat: 53.4084, lng: -2.9916 }; // Liverpool
  it("preserves order without an anchor and maps shape", () => {
    const out = sortCandidatesByProximity(
      [{ id: "a", name: "Liverpool Lime Street", code: "LIV" }],
      null,
    );
    expect(out[0]).toMatchObject({ id: "a", name: "Liverpool Lime Street", code: "LIV" });
    expect(out[0].distanceLabel).toBeUndefined();
  });
  it("sorts nearest-first and labels distance when anchored", () => {
    const out = sortCandidatesByProximity(
      [
        { id: "man", name: "Manchester Piccadilly", latitude: 53.4775, longitude: -2.2309 },
        { id: "liv", name: "Liverpool Lime Street", latitude: 53.4075, longitude: -2.9778 },
      ],
      near,
    );
    expect(out[0].id).toBe("liv");
    expect(out[0].distanceLabel).toMatch(/mi|here/);
  });
});
