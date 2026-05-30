// Stage 10 — orchestrator. Runs stages 1–9 and returns a ParsedPayload. NO
// persistence (brief §0c, §13). Pure given a Dictionary + PlaceResolver.
// Bounded ambition + stage isolation keep it from ever crashing the caller.

import { getDictionary, type Dictionary } from "@/lib/dictionary/dictionary";
import { tokenise, type Token } from "./tokenise";
import { recognisePatterns } from "./recognisers";
import { lookup } from "./lookup";
import { routeImperative } from "./imperatives";
import { segment } from "./segment";
import { classifyClause } from "./classify";
import { populateSlots, rollupConfidence, nullResolver, type PlaceResolver } from "./slots";
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
    return { ...base, intent_type: routing.intent_type };
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
      facts.push({
        local_id: `fact_${i + 1}`,
        fact_type: factType,
        slots: fill.slots,
        links: [],
        warnings: [],
        confidence: rollupConfidence(fill, modifier),
        source_range: { start: clause.start, end: clause.end },
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
