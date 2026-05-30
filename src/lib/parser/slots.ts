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

// Per-meal typical hours for bare-hour disambiguation (stress-test Fix 7). The
// meal_plan schema covers breakfast/lunch/dinner/drinks — narrow by the word.
function mealTypicalHours(text: string): [number, number] | null {
  const t = text.toLowerCase();
  if (/\bbreakfast|brekkie|morning meal\b/.test(t)) return [6, 10];
  if (/\blunch|lunchtime\b/.test(t)) return [12, 14];
  if (/\bdinner|supper|evening meal\b/.test(t)) return [18, 22];
  if (/\bdrinks\b/.test(t)) return [17, 23];
  return null;
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
  const usedPlaces = new Set<PlaceCandidate>();

  // Bare-hour meridiem disambiguation by event type (stress-test Fix 7). A time
  // flagged ambiguousMeridiem ("at 3", "from 7") is resolved against the fact's
  // typical-hours window; meal_plan narrows further by the meal word present.
  const typicalHours = mealTypicalHours(clause.text) ?? schema.typicalHours ?? null;
  const resolveBareHour = (p: PatternMatch): PatternMatch => {
    const meta = p.meta as { ambiguousMeridiem?: boolean; bareHour?: number } | undefined;
    if (!meta?.ambiguousMeridiem || typeof meta.bareHour !== "number") return p;
    if (!typicalHours) return p; // trains/flights: no inference, stays flagged (medium)
    const [lo, hi] = typicalHours;
    const h12 = meta.bareHour % 12; // 12 → 0
    const am = h12;
    const pm = h12 + 12;
    const within = (h: number) => h >= lo && h <= hi;
    let chosen: number;
    if (within(pm) && !within(am)) chosen = pm;
    else if (within(am) && !within(pm)) chosen = am;
    else chosen = within(pm) ? pm : am; // both/neither → prefer the window's side
    const mm = String(p.normalised_value).split(":")[1] ?? "00";
    return { ...p, normalised_value: `${String(chosen).padStart(2, "0")}:${mm}`, confidence: "medium" };
  };

  // Route times to a slot by an adjacent direction word: "arriving at 09:30" →
  // arrival_time, "leaving/departing at 09:00" → departure_time (handback §2.3).
  // Direction-less times fill the remaining time slots in schema order.
  const timeSlotKeys = schema.slots.filter((s) => s.dataType === "time").map((s) => s.key);
  const directionFor = (t: PatternMatch): "arrival_time" | "departure_time" | null => {
    const before = clause.text.slice(0, Math.max(0, t.source_range.start - clause.start)).toLowerCase();
    if (timeSlotKeys.includes("arrival_time") && /\barriv\w*\s*(?:at\s*)?$/.test(before)) return "arrival_time";
    if (timeSlotKeys.includes("departure_time") && /\b(?:leav\w*|depart\w*)\s*(?:at\s*)?$/.test(before)) return "departure_time";
    return null;
  };
  const timeBySlot: Record<string, PatternMatch> = {};
  const leftoverTimes: PatternMatch[] = [];
  for (const raw of times) {
    const t = resolveBareHour(raw);
    const dir = directionFor(t);
    if (dir && !timeBySlot[dir]) timeBySlot[dir] = t;
    else leftoverTimes.push(t);
  }
  let timeIdx = 0;

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
        if (timeBySlot[def.key]) slots[def.key] = slotFromPattern(timeBySlot[def.key]);
        else if (timeIdx < leftoverTimes.length) slots[def.key] = slotFromPattern(leftoverTimes[timeIdx++]);
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

// Fact confidence rollup (handback §3). Confidence is fact-completeness-and-
// correctness, NOT fact-classification: the pill must honestly reflect the
// worst-confident slot or any empty essential slot. A confidence_modifier
// ("definitely"/"maybe") still overrides — the user spoke to their own certainty.
//
// Otherwise the fact confidence is the MINIMUM of:
//   - every filled slot's confidence (a low/`?` slot caps the fact at low), and
//   - a penalty for missing essential slots (any missing → at most medium).
const RANK: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };
const BY_RANK: Confidence[] = ["low", "medium", "high"];

export function rollupConfidence(
  fill: SlotFillResult,
  modifier: Confidence | null,
): Confidence {
  if (modifier) return modifier;

  let worst: Confidence = "high";
  for (const slot of Object.values(fill.slots)) {
    if (slot.inferred) continue; // inferred slots carry their own (already-capped) confidence but shouldn't drag a fact below its stated parts
    if (RANK[slot.confidence] < RANK[worst]) worst = slot.confidence;
  }

  // Any missing essential slot caps the fact at medium (can't be high).
  const essentialGap = fill.essentialTotal > 0 && fill.essentialFilled < fill.essentialTotal;
  if (essentialGap && RANK[worst] > RANK.medium) worst = "medium";

  // No essential slots defined + nothing low → a plain medium (unchanged behaviour).
  if (fill.essentialTotal === 0 && worst === "high") return "medium";

  return BY_RANK[RANK[worst]];
}
