import { describe, it, expect } from "vitest";
import { factTypeRegistry } from "./registry";
import { getDictionary } from "./dictionary";
import type { SlotTier } from "./types";

const VALID_TIERS: SlotTier[] = [
  "essential_to_work",
  "essential_to_use",
  "nice_to_have",
];

describe("fact-type mapping registry", () => {
  const mappings = factTypeRegistry.listMappings();

  it("has unique fact-type names", () => {
    const names = mappings.map((m) => m.factType);
    expect(new Set(names).size).toBe(names.length);
  });

  it("covers the 15 YAML + verbatim fact-types", () => {
    const names = mappings.map((m) => m.factType);
    for (const expected of [
      "train_journey",
      "flight_journey",
      "accommodation_booking",
      "meal_plan",
      "scheduled_event",
      "scheduled_call",
      "taxi_journey",
      "walking_leg",
      "driving_leg",
      "ferry_journey",
      "bus_journey",
      "coach_journey",
      "business_event",
      "appointment",
      "note",
      "task",
      "intent",
    ]) {
      expect(names).toContain(expected);
    }
  });

  it("every mapping has at least one target", () => {
    for (const m of mappings) expect(m.targets.length).toBeGreaterThan(0);
  });
});

describe("loaded dictionary (YAML + registry fused)", () => {
  const dict = getDictionary();

  it("builds a merged schema for every concept fact-type", () => {
    expect(dict.schemas.get("train_journey")?.slots.length).toBeGreaterThan(0);
    expect(dict.schemas.get("accommodation_booking")).toBeDefined();
    // meal_plan is referenced by dinner/lunch/breakfast — slots unioned, one schema.
    expect(dict.schemas.get("meal_plan")?.conceptWords).toEqual(
      expect.arrayContaining(["dinner", "lunch", "breakfast"]),
    );
  });

  it("indexes concept words to fact-types", () => {
    expect(dict.conceptIndex.get("train")).toBe("train_journey");
    expect(dict.conceptIndex.get("hotel")).toBe("accommodation_booking");
    expect(dict.conceptIndex.get("flight")).toBe("flight_journey");
    expect(dict.conceptIndex.get("demo")).toBe("scheduled_event");
    expect(dict.conceptIndex.get("by train")).toBe("train_journey");
  });

  it("carries multi-category operators (the disambiguation set)", () => {
    const by = dict.operatorIndex.get("by");
    expect(by).toEqual(
      expect.arrayContaining(["positioner", "narrower", "method_marker"]),
    );
    const via = dict.operatorIndex.get("via");
    expect(via).toEqual(
      expect.arrayContaining(["method_marker", "journey_breaker"]),
    );
  });

  it("resolves confidence modifiers and quantifiers", () => {
    expect(dict.confidenceModifiers.get("booked")).toBe("high");
    expect(dict.confidenceModifiers.get("maybe")).toBe("low");
    expect(dict.confidenceModifiers.get("probably")).toBe("medium");
    expect(dict.quantifiers.get("a")).toBe("indefinite_creation");
    expect(dict.quantifiers.get("the")).toBe("definite_reference");
  });

  it("routes imperatives with their engine-note flags", () => {
    expect(dict.imperativeIndex.get("remind")?.intent).toBe("create_intent");
    expect(dict.imperativeIndex.get("find")?.intent).toBe("search_request");
    expect(dict.imperativeIndex.get("book")?.intent).toBe("booking_request");
    expect(dict.imperativeIndex.get("what")?.questionShaped).toBe(true);
    expect(dict.imperativeIndex.get("plan")?.positional).toBe(true);
  });

  it("dated events carry an essential_to_work slot; verbatim shapes don't", () => {
    for (const schema of dict.schemas.values()) {
      const keys = schema.slots.map((s) => s.key);
      expect(new Set(keys).size).toBe(keys.length);
      for (const slot of schema.slots) expect(VALID_TIERS).toContain(slot.tier);

      const hasEssential = schema.slots.some(
        (s) => s.tier === "essential_to_work",
      );
      if (schema.verbatimHold) {
        expect(hasEssential).toBe(false);
        expect(schema.conceptWords.length).toBe(0);
      } else {
        expect(hasEssential).toBe(true);
      }
    }
  });
});
