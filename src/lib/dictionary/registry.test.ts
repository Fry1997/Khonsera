import { describe, it, expect } from "vitest";
import { factTypeRegistry } from "./registry";
import type { SlotTier } from "./types";

const VALID_TIERS: SlotTier[] = [
  "essential_to_work",
  "essential_to_use",
  "nice_to_have",
];

describe("fact-type registry", () => {
  const schemas = factTypeRegistry.listSchemas();

  it("exposes the core travel set", () => {
    const names = schemas.map((s) => s.factType);
    for (const expected of [
      "train_journey",
      "flight",
      "accommodation",
      "meeting",
      "meal",
      "event",
    ]) {
      expect(names).toContain(expected);
    }
  });

  it("has unique fact-type names", () => {
    const names = schemas.map((s) => s.factType);
    expect(new Set(names).size).toBe(names.length);
  });

  it("getSchema resolves a known type and returns undefined otherwise", () => {
    expect(factTypeRegistry.getSchema("train_journey")?.factType).toBe(
      "train_journey",
    );
    expect(factTypeRegistry.getSchema("nope")).toBeUndefined();
  });

  describe.each(schemas)("schema $factType", (schema) => {
    it("has at least one target and uniquely-keyed slots with valid tiers", () => {
      expect(schema.targets.length).toBeGreaterThan(0);
      const keys = schema.slots.map((s) => s.key);
      expect(new Set(keys).size).toBe(keys.length);
      for (const slot of schema.slots) {
        expect(VALID_TIERS).toContain(slot.tier);
      }
    });

    it("dated events carry an essential_to_work slot; verbatim shapes don't", () => {
      const hasEssential = schema.slots.some(
        (s) => s.tier === "essential_to_work",
      );
      if (schema.verbatimHold) {
        // Verbatim-hold shapes are always valid as-is — no blocking slot.
        expect(hasEssential).toBe(false);
      } else {
        expect(hasEssential).toBe(true);
      }
    });
  });

  it("indexes concept words to fact-types without collisions", () => {
    const index = factTypeRegistry.conceptWordIndex();
    expect(index.get("train")).toBe("train_journey");
    expect(index.get("hotel")).toBe("accommodation");
    expect(index.get("flight")).toBe("flight");

    // Each concept word maps to exactly one fact-type across the registry.
    const seen = new Map<string, string>();
    for (const schema of schemas) {
      for (const word of schema.conceptWords) {
        const key = word.toLowerCase();
        expect(seen.has(key)).toBe(false);
        seen.set(key, schema.factType);
      }
    }
  });
});
