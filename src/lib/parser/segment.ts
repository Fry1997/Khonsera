// Stage 5 — clause segmentation. Permissive: prefer fewer clauses (brief §8).
// Hard splits on , ; . ! ? and line breaks. A connector (and/then/plus...) splits
// only when a concept word follows it (a second concept ≈ a second fact) — so
// "dinner and drinks at the George" stays one, "..., dinner with Mark" splits.
// A final merge pass folds any fragment with no concept and no anchor into its
// neighbour, so spurious splits collapse.

import type { Token } from "./tokenise";
import type { LookupResult } from "./lookup";
import type { PatternBundle } from "./recognisers";

export interface Clause {
  index: number;
  tokenStart: number;
  tokenEnd: number; // inclusive
  start: number;
  end: number;
  text: string;
}

function spanHas(
  items: Array<{ start: number; end: number }>,
  start: number,
  end: number,
): boolean {
  return items.some((i) => i.start < end && i.end > start);
}

export function segment(
  input: string,
  tokens: Token[],
  lookup: LookupResult,
  patterns: PatternBundle,
): Clause[] {
  const boundaryAfter = new Set<number>();

  // Next significant (non-punct) token index after position i.
  const nextSig = (i: number): number => {
    for (let j = i + 1; j < tokens.length; j++) if (tokens[j].kind !== "punct") return j;
    return -1;
  };
  const startsConcept = (idx: number) => lookup.concepts.some((c) => c.tokenStart === idx);
  const startsImperative = (idx: number) => lookup.imperatives.some((m) => m.tokenStart === idx);
  // Imperative-ish verbs that signal a new clause even without a dictionary entry
  // ("..., need to sort tickets"). Kept small + conservative.
  const SOFT_VERB = /^(need|sort|book|find|remember|remind|check|grab|get|pick|call|email|send|bring|arrange)$/i;
  // Return-leg markers after a comma open a new (return) clause — the link stage
  // turns these into the mirrored journey ("..., returning Friday").
  const RETURN_WORD = /^(returning|return|back|coming|home)$/i;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.kind !== "punct") continue;
    // Hard boundaries: sentence terminators always split.
    if (/[;.!?\n]/.test(t.text)) {
      boundaryAfter.add(i);
      continue;
    }
    // Comma (stress-test Fix 2): a SOFT boundary. Split only when the text to the
    // right opens a new fact — a new concept word, a new imperative/soft-verb, or a
    // bare capitalised subject that isn't a date/place/person continuation.
    if (t.text === ",") {
      const n = nextSig(i);
      if (n === -1) continue;
      if (startsConcept(n) || startsImperative(n)) {
        boundaryAfter.add(i);
        continue;
      }
      if (SOFT_VERB.test(tokens[n].lower) || RETURN_WORD.test(tokens[n].lower)) {
        boundaryAfter.add(i);
        continue;
      }
      // Otherwise the comma is emphasis/list punctuation INSIDE one fact — keep going.
    }
  }
  for (const op of lookup.operators) {
    if (!op.categories.includes("connector")) continue;
    // Concept immediately AFTER the connector, and the nearest one BEFORE it.
    const after = lookup.concepts
      .filter((c) => c.tokenStart > op.tokenEnd)
      .sort((a, b) => a.tokenStart - b.tokenStart)[0];
    if (!after) continue;
    const before = lookup.concepts
      .filter((c) => c.tokenEnd < op.tokenStart)
      .sort((a, b) => b.tokenEnd - a.tokenEnd)[0];
    // Same fact-type on both sides of "and" composes at one anchor ("dinner and
    // drinks at the George") — DON'T split. But only when the LEFT concept hasn't
    // already formed its own complete fact: if a place/date anchor sits between
    // the left concept and the connector, these are two separate facts
    // ("dinner at the George Tuesday and drinks at the Crown") (stress-test Fix 3).
    if (before && before.factType === after.factType) {
      const anchorBetween =
        spanHas(patterns.all.map((p) => p.source_range), tokens[before.tokenEnd].end, tokens[op.tokenStart].start);
      if (!anchorBetween) continue; // compose
    }
    boundaryAfter.add(op.tokenEnd);
  }

  // Build raw token-index ranges between boundaries.
  type Raw = { from: number; to: number };
  const raw: Raw[] = [];
  let from = 0;
  for (let i = 0; i < tokens.length; i++) {
    if (boundaryAfter.has(i)) {
      if (i >= from) raw.push({ from, to: i });
      from = i + 1;
    }
  }
  if (from < tokens.length) raw.push({ from, to: tokens.length - 1 });

  // Trim to significant tokens + compute char ranges; drop empty.
  const trimmed = raw
    .map(({ from, to }) => {
      let a = from;
      let b = to;
      while (a <= b && tokens[a].kind === "punct") a++;
      while (b >= a && tokens[b].kind === "punct") b--;
      return a <= b ? { from: a, to: b } : null;
    })
    .filter((x): x is Raw => x !== null);

  // Merge fragments with neither a concept nor any anchor into the previous clause
  // — UNLESS the fragment opens with an imperative trigger ("Remember to ...",
  // "Book ..."), which is its own (reminder/intent) fact and must survive.
  const merged: Raw[] = [];
  for (const seg of trimmed) {
    const start = tokens[seg.from].start;
    const end = tokens[seg.to].end;
    const hasConcept = spanHas(lookup.concepts, start, end);
    const hasAnchor = spanHas(
      patterns.all.map((p) => p.source_range),
      start,
      end,
    );
    const startsImperative = lookup.imperatives.some((m) => m.tokenStart === seg.from);
    if (!hasConcept && !hasAnchor && !startsImperative && merged.length > 0) {
      merged[merged.length - 1].to = seg.to; // absorb the fragment
    } else {
      merged.push({ ...seg });
    }
  }

  return merged.map((seg, index) => ({
    index,
    tokenStart: seg.from,
    tokenEnd: seg.to,
    start: tokens[seg.from].start,
    end: tokens[seg.to].end,
    text: input.slice(tokens[seg.from].start, tokens[seg.to].end),
  }));
}
