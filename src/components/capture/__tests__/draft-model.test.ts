import { describe, it, expect } from "vitest";
import {
  applyCorrections,
  buildConfirmPayload,
  factTypeLabel,
  formatDateHuman,
  formatSlotValue,
  includedFacts,
  pruneCorrections,
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
