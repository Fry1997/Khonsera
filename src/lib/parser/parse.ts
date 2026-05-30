// Stage 10 — orchestrator. Runs stages 1–9 and returns a ParsedPayload. NO
// persistence (brief §0c, §13). Pure given a Dictionary + PlaceResolver.
// Bounded ambition + stage isolation keep it from ever crashing the caller.

import { getDictionary, type Dictionary } from "@/lib/dictionary/dictionary";
import { tokenise, type Token } from "./tokenise";
import { recognisePatterns, type PatternBundle } from "./recognisers";
import { lookup, type LookupResult } from "./lookup";
import { routeImperative } from "./imperatives";
import { routeNegation } from "./negation";
import { detectRecurrence } from "./recurrence";
import { segment } from "./segment";
import { classifyClause } from "./classify";
import { populateSlots, rollupConfidence, nullResolver, type PlaceResolver } from "./slots";
import { findPlaces } from "./place";
import { linkFacts } from "./link";
import { validateFacts } from "./validate";
import {
  PARSER_VERSION,
  type Confidence,
  type ParsedFact,
  type ParsedPayload,
  type Slot,
} from "./types";

const MAX_LEN = 1000;

export interface ParseOptions {
  ref?: Date; // reference instant for relative dates (user's local "now")
  resolver?: PlaceResolver;
  dictionary?: Dictionary;
}

// Stub intents (everything bar create_intent) are recorded but produce no facts
// in v1 — the UI shows an honest "I saw this but can't act yet" (brief §7).
const STUB_INTENTS = new Set([
  "search_request",
  "booking_request",
  "cancellation_request",
  "modification_request",
  "information_request",
  "comparison_request",
  "itinerary_request",
  "communication_request",
]);

function verbatimNote(input: string): ParsedFact {
  const slot: Slot = {
    value: input,
    source_text: input,
    source_range: { start: 0, end: input.length },
    confidence: "high",
    inferred: false,
  };
  return {
    local_id: "fact_1",
    fact_type: "note",
    slots: { label: slot },
    links: [],
    warnings: [],
    confidence: "medium",
    source_range: { start: 0, end: input.length },
  };
}

// Extracts the metadata slots (date/time/place/person/party/money/duration) from a
// content region for an INTENT (not a positive fact) — stress-test Fix 5. The
// intent stays an intent; these slots ride along as payload metadata so a future
// handler has the details. Place candidates are resolved best-effort (event-style:
// saved location else verbatim label).
async function extractIntentSlots(
  input: string,
  region: { start: number; end: number },
  tokens: Token[],
  matches: LookupResult,
  patterns: PatternBundle,
  resolver: PlaceResolver,
): Promise<Record<string, Slot>> {
  const inRegion = (s: number, e: number) => s >= region.start && s < region.end;
  const slots: Record<string, Slot> = {};
  const fromPattern = (key: string, p: { normalised_value: unknown; source_text: string; source_range: { start: number; end: number }; confidence: Confidence }) => {
    if (slots[key]) return;
    slots[key] = { value: p.normalised_value, source_text: p.source_text, source_range: p.source_range, confidence: p.confidence, inferred: false };
  };

  const date = patterns.dates.find((p) => inRegion(p.source_range.start, p.source_range.end));
  if (date) fromPattern("date", date);
  const time = patterns.times.find((p) => inRegion(p.source_range.start, p.source_range.end));
  if (time) fromPattern("time", time);
  const person = patterns.people.find((p) => inRegion(p.source_range.start, p.source_range.end));
  if (person) fromPattern("contact", person);
  const party = patterns.party.find((p) => inRegion(p.source_range.start, p.source_range.end));
  if (party) fromPattern("party_size", party);
  const money = patterns.money.find((p) => inRegion(p.source_range.start, p.source_range.end));
  if (money) fromPattern("price", money);
  const duration = patterns.durations.find((p) => inRegion(p.source_range.start, p.source_range.end));
  if (duration) fromPattern("duration", duration);

  // A single place candidate, resolved event-style (saved location else label).
  const tokenStart = tokens.findIndex((t) => t.start >= region.start);
  let tokenEnd = -1;
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (tokens[i].end <= region.end) { tokenEnd = i; break; }
  }
  if (tokenStart !== -1 && tokenEnd >= tokenStart) {
    const cands = findPlaces({ tokenStart, tokenEnd }, tokens, matches, patterns);
    const cand = cands.find((c) => c.viaOperator) ?? cands[0];
    if (cand) {
      const loc = await resolver.resolveLocation(cand.text);
      slots.place = loc
        ? { value: { location_id: loc.id, label: loc.name }, source_text: cand.text, source_range: { start: cand.start, end: cand.end }, confidence: "high", inferred: false }
        : { value: cand.text, source_text: cand.text, source_range: { start: cand.start, end: cand.end }, confidence: "medium", inferred: false };
    }
  }
  return slots;
}

function clauseConfidenceModifier(
  dict: Dictionary,
  tokens: Token[],
  start: number,
  end: number,
): Confidence | null {
  for (const t of tokens) {
    if (t.start < start || t.end > end) continue;
    const level = dict.confidenceModifiers.get(t.lower);
    if (level) return level;
  }
  return null;
}

export async function parse(
  input: string,
  opts: ParseOptions = {},
): Promise<ParsedPayload> {
  const dict = opts.dictionary ?? getDictionary();
  const resolver = opts.resolver ?? nullResolver;
  const ref = opts.ref ?? new Date();

  const base: ParsedPayload = {
    parser_version: PARSER_VERSION,
    original_text: input,
    facts: [],
    input_level_warnings: [],
    ambiguities: [],
    unmatched_text: [],
    intent_type: null,
  };

  const trimmed = input.trim();
  if (trimmed.length === 0) return base;

  // Bounded ambition: don't attempt structured parsing of essays.
  if (input.length > MAX_LEN) {
    return { ...base, facts: [verbatimNote(input)] };
  }

  const tokens = tokenise(input);
  const patterns = recognisePatterns(input, ref);
  const matches = lookup(tokens, dict);

  // Stage 4a — negation / correction routing (PRIORITY 1, stress-test Fix 1).
  // A sentence-leading negation must NEVER create a positive fact. Runs before
  // imperative routing + classification so "No meeting Monday" can't become a
  // meeting. Mid-sentence retractions are untouched (they flow to the fact engine).
  const neg = routeNegation(input);
  if (neg) {
    const intentType = neg.kind === "correction" ? "correction_intent" : "cancellation_request";
    const region = { start: 0, end: input.length };
    const slots = await extractIntentSlots(input, region, tokens, matches, patterns, resolver);
    slots.label = {
      value: neg.text,
      source_text: neg.text,
      source_range: { start: 0, end: input.length },
      confidence: "high",
      inferred: false,
    };
    return {
      ...base,
      intent_type: intentType,
      facts: [
        {
          local_id: "fact_1",
          fact_type: "intent",
          slots,
          links: [],
          warnings: [],
          confidence: "medium",
          source_range: { start: 0, end: input.length },
        },
      ],
    };
  }

  // Stage 4 — imperative routing.
  const routing = routeImperative(input, tokens, matches);
  if (routing.intent_type === "create_intent") {
    const rest = input
      .slice(routing.consumedEnd)
      .trim()
      .replace(/^(me\s+|us\s+)?(to\s+|that\s+)/i, "")
      .trim();
    const label = rest.length > 0 ? rest : input.trim();
    return {
      ...base,
      intent_type: "create_intent",
      facts: [
        {
          local_id: "fact_1",
          fact_type: "intent",
          slots: {
            label: {
              value: label,
              source_text: label,
              source_range: { start: input.length - label.length, end: input.length },
              confidence: "high",
              inferred: false,
            },
          },
          links: [],
          warnings: [],
          confidence: "medium",
          source_range: { start: 0, end: input.length },
        },
      ],
    };
  }
  if (routing.intent_type && STUB_INTENTS.has(routing.intent_type)) {
    // Stub intents (book/find/cancel/email/...) — Khonsera can't action these yet,
    // but we extract the content slots so a future handler has the details, and
    // hold the verbatim text. The intent STAYS an intent — never a positive fact
    // (stress-test Fix 5). The content region is everything after the trigger.
    const region = { start: routing.consumedEnd, end: input.length };
    const slots = await extractIntentSlots(input, region, tokens, matches, patterns, resolver);
    slots.label = {
      value: input.trim(),
      source_text: input.trim(),
      source_range: { start: 0, end: input.length },
      confidence: "high",
      inferred: false,
    };
    return {
      ...base,
      intent_type: routing.intent_type,
      facts: [
        {
          local_id: "fact_1",
          fact_type: "intent",
          slots,
          links: [],
          warnings: [],
          confidence: "medium",
          source_range: { start: 0, end: input.length },
        },
      ],
    };
  }

  // Stages 5–7 — segment, classify, fill.
  const clauses = segment(input, tokens, matches, patterns);
  const facts: ParsedFact[] = [];
  for (let i = 0; i < clauses.length; i++) {
    const clause = clauses[i];
    try {
      const factType = classifyClause(clause, tokens, matches, patterns);
      const schema = dict.schemas.get(factType);
      if (!schema) continue;
      const fill = await populateSlots(clause, schema, tokens, matches, patterns, resolver);
      const modifier = clauseConfidenceModifier(dict, tokens, clause.start, clause.end);
      // Recurrence is detected + surfaced, never expanded (stress-test Fix 8).
      const recurrence = detectRecurrence(clause.text);
      facts.push({
        local_id: `fact_${i + 1}`,
        fact_type: factType,
        slots: fill.slots,
        links: [],
        warnings: [],
        confidence: rollupConfidence(fill, modifier),
        source_range: { start: clause.start, end: clause.end },
        ...(recurrence ? { recurrence_pattern: recurrence } : {}),
      });
    } catch {
      // Stage isolation: a clause that fails to classify is still held verbatim.
      facts.push({
        local_id: `fact_${i + 1}`,
        fact_type: "note",
        slots: {
          label: {
            value: clause.text,
            source_text: clause.text,
            source_range: { start: clause.start, end: clause.end },
            confidence: "high",
            inferred: false,
          },
        },
        links: [],
        warnings: [],
        confidence: "low",
        source_range: { start: clause.start, end: clause.end },
      });
    }
  }

  // Stages 8–9 — link + validate.
  const linked = await linkFacts(facts, resolver);
  const validated = validateFacts(linked.facts);

  // Re-number local_ids after any return-leg transforms kept stable ids; collect
  // ambiguities from low-confidence dates + ambiguous place slots.
  const ambiguities: string[] = [...linked.ambiguities];
  for (const f of validated.facts) {
    for (const [key, slot] of Object.entries(f.slots)) {
      if (key === "date" && slot.confidence === "low" && !slot.fuzzy) {
        ambiguities.push(`"${slot.source_text}" — month assumed; confirm the date.`);
      }
      if (slot.ambiguous) {
        ambiguities.push(`"${slot.source_text}" matches more than one place — pick which.`);
      }
    }
  }

  return {
    ...base,
    facts: validated.facts,
    input_level_warnings: validated.inputWarnings,
    ambiguities,
    unmatched_text: computeUnmatched(input, tokens, matches, patterns),
  };
}

// Coarse unmatched-text: significant word runs covered by no match — the signal
// for dictionary improvement (brief §20). Stopwords excluded to cut noise.
const STOP = new Set([
  "the", "a", "an", "to", "of", "and", "or", "in", "on", "at", "for", "with",
  "is", "are", "be", "i", "we", "my", "me", "it", "this", "that",
]);

function computeUnmatched(
  input: string,
  tokens: Token[],
  matches: ReturnType<typeof lookup>,
  patterns: ReturnType<typeof recognisePatterns>,
): { text: string; source_range: { start: number; end: number } }[] {
  const covered = (s: number, e: number) =>
    matches.concepts.some((m) => m.start <= s && m.end >= e) ||
    matches.operators.some((m) => m.start <= s && m.end >= e) ||
    matches.imperatives.some((m) => m.start <= s && m.end >= e) ||
    patterns.all.some((m) => m.source_range.start <= s && m.source_range.end >= e);

  const spans: { text: string; source_range: { start: number; end: number } }[] = [];
  for (const t of tokens) {
    if (t.kind !== "word" || t.text.length < 3 || STOP.has(t.lower)) continue;
    if (covered(t.start, t.end)) continue;
    spans.push({ text: t.text, source_range: { start: t.start, end: t.end } });
  }
  return spans;
}
