// Stage 7 — slot population with slot-aware place resolution (brief §10).
// Patterns and place candidates within the clause are assigned to the fact-type's
// schema slots. Transit slots resolve against transport_hubs; event slots stay as
// plain labels unless an explicit station is named. Nothing is guessed: an
// unresolved value is held verbatim at low confidence.

import type { Token } from "./tokenise";
import type { Clause } from "./segment";
import type { LookupResult } from "./lookup";
import type { PatternBundle, PatternMatch } from "./recognisers";
import type { FactTypeSchema, SlotDef } from "@/lib/dictionary/types";
import type { Confidence, Slot } from "./types";
import { findPlaces, type PlaceCandidate, type PlaceRole } from "./place";

export interface ResolvedHub {
  id: string;
  name: string;
  code: string | null;
}
export interface ResolvedLocation {
  id: string;
  name: string;
}

// The DB-backed resolution seam (injected so the pipeline stays unit-testable).
export interface PlaceResolver {
  resolveHub(name: string): Promise<{ match: ResolvedHub | null; candidates: ResolvedHub[] }>;
  resolveLocation(name: string): Promise<ResolvedLocation | null>;
}

// A resolver that resolves nothing — everything is held verbatim (used when no
// workspace context is available, and as the unit-test default).
export const nullResolver: PlaceResolver = {
  async resolveHub() {
    return { match: null, candidates: [] };
  },
  async resolveLocation() {
    return null;
  },
};

// Pattern matches carry their span on source_range.
function inClause(p: { source_range: { start: number; end: number } }, c: Clause): boolean {
  return p.source_range.start >= c.start && p.source_range.start < c.end;
}

function slotFromPattern(p: PatternMatch, inferred = false): Slot {
  return {
    value: p.normalised_value,
    source_text: p.source_text,
    source_range: p.source_range,
    confidence: p.confidence,
    inferred,
    fuzzy: p.fuzzy,
    range: p.range,
    granularity: p.granularity,
  };
}

function roleForKey(key: string): PlaceRole | null {
  if (key === "origin" || key === "pickup_place") return "origin";
  if (key === "destination" || key === "dropoff_place") return "destination";
  if (key === "place") return "place";
  return null;
}

export interface SlotFillResult {
  slots: Record<string, Slot>;
  // essential_to_work coverage, for fact-confidence rollup.
  essentialFilled: number;
  essentialTotal: number;
}

export async function populateSlots(
  clause: Clause,
  schema: FactTypeSchema,
  tokens: Token[],
  lookup: LookupResult,
  patterns: PatternBundle,
  resolver: PlaceResolver,
): Promise<SlotFillResult> {
  const slots: Record<string, Slot> = {};

  // Verbatim shapes: hold the clause text as the label; attach a date/person if present.
  if (schema.verbatimHold) {
    slots.label = {
      value: clause.text,
      source_text: clause.text,
      source_range: { start: clause.start, end: clause.end },
      confidence: "high",
      inferred: false,
    };
    const date = patterns.dates.find((p) => inClause(p, clause));
    if (date && schema.slots.some((s) => s.key === "date")) slots.date = slotFromPattern(date);
    const person = patterns.people.find((p) => inClause(p, clause));
    if (person && schema.slots.some((s) => s.key === "person")) slots.person = slotFromPattern(person);
    return { slots, essentialFilled: 0, essentialTotal: 0 };
  }

  const dates = patterns.dates.filter((p) => inClause(p, clause));
  const times = patterns.times.filter((p) => inClause(p, clause));
  const money = patterns.money.filter((p) => inClause(p, clause));
  const durations = patterns.durations.filter((p) => inClause(p, clause));
  const party = patterns.party.filter((p) => inClause(p, clause));
  const people = patterns.people.filter((p) => inClause(p, clause));
  const places = findPlaces(clause, tokens, lookup, patterns);

  let dateIdx = 0;
  let timeIdx = 0;
  const usedPlaces = new Set<PlaceCandidate>();

  const pickPlace = (role: PlaceRole): PlaceCandidate | null => {
    let cand = places.find((p) => p.role === role && !usedPlaces.has(p));
    // Only the generic "place" slot may fall back to a bare candidate — origin and
    // destination must come from their own from/to operator, never each other's.
    if (!cand && role === "place") {
      cand = places.find((p) => (p.role === "place") && !usedPlaces.has(p));
    }
    if (cand) usedPlaces.add(cand);
    return cand ?? null;
  };

  const resolvePlaceSlot = async (def: SlotDef): Promise<Slot | null> => {
    const role = roleForKey(def.key) ?? "place";
    const cand = pickPlace(role);
    if (!cand) return null;
    const base = {
      source_text: cand.text,
      source_range: { start: cand.start, end: cand.end },
      inferred: false,
    };
    if (def.placePref === "transit" || cand.explicitStation) {
      const { match, candidates } = await resolver.resolveHub(cand.text);
      if (match) return { ...base, value: { hub_id: match.id, label: match.name, code: match.code }, confidence: "high" };
      if (candidates.length > 1) {
        return { ...base, value: cand.text, confidence: "medium", ambiguous: true, candidates };
      }
      // No hub: for a transit slot, hold verbatim (low); the gap engine asks later.
      return { ...base, value: cand.text, confidence: "low" };
    }
    // Event place: prefer a saved location; otherwise keep the plain label.
    const loc = await resolver.resolveLocation(cand.text);
    if (loc) return { ...base, value: { location_id: loc.id, label: loc.name }, confidence: "high" };
    return { ...base, value: cand.text, confidence: "medium" };
  };

  // Special-case accommodation check-in/check-out from a date range.
  const dateRange = dates.find((d) => d.range);

  for (const def of schema.slots) {
    if (slots[def.key]) continue;
    switch (def.dataType) {
      case "date": {
        if (def.key === "check_in_date" && dateRange) {
          const v = dateRange.normalised_value as { start: string };
          slots[def.key] = { ...slotFromPattern(dateRange), value: v.start };
          break;
        }
        if (def.key === "check_out_date" && dateRange) {
          const v = dateRange.normalised_value as { end: string };
          slots[def.key] = { ...slotFromPattern(dateRange), value: v.end };
          break;
        }
        if (dateIdx < dates.length) slots[def.key] = slotFromPattern(dates[dateIdx++]);
        break;
      }
      case "time":
        if (timeIdx < times.length) slots[def.key] = slotFromPattern(times[timeIdx++]);
        break;
      case "money":
        if (money[0]) slots[def.key] = slotFromPattern(money[0]);
        break;
      case "duration":
        if (durations[0]) slots[def.key] = slotFromPattern(durations[0]);
        break;
      case "party_size":
        if (party[0]) slots[def.key] = slotFromPattern(party[0]);
        break;
      case "person":
        if (people[0]) slots[def.key] = slotFromPattern(people[0]);
        break;
      case "hub":
      case "place": {
        const filled = await resolvePlaceSlot(def);
        if (filled) slots[def.key] = filled;
        break;
      }
      default:
        break;
    }
  }

  const essential = schema.slots.filter((s) => s.tier === "essential_to_work");
  const essentialFilled = essential.filter((s) => slots[s.key]).length;
  return { slots, essentialFilled, essentialTotal: essential.length };
}

// Fact confidence rollup: a confidence_modifier in the clause overrides; otherwise
// full essential coverage → high, partial → medium.
export function rollupConfidence(
  fill: SlotFillResult,
  modifier: Confidence | null,
): Confidence {
  if (modifier) return modifier;
  if (fill.essentialTotal === 0) return "medium";
  return fill.essentialFilled === fill.essentialTotal ? "high" : "medium";
}
