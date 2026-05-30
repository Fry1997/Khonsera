// Stage 6 — fact classification. Concept word wins; otherwise the §9 decision
// tree on the presence/absence of anchors. Verbatim shapes (note/task/intent)
// hold the subject verbatim — they are never "interpreted".

import type { Token } from "./tokenise";
import type { Clause } from "./segment";
import type { LookupResult } from "./lookup";
import type { PatternBundle } from "./recognisers";
import { findPlaces } from "./place";

function inClause(item: { start: number; end: number }, c: Clause): boolean {
  return item.start >= c.start && item.start < c.end;
}
// Pattern matches carry their span on source_range.
function patIn(p: { source_range: { start: number; end: number } }, c: Clause): boolean {
  return p.source_range.start >= c.start && p.source_range.start < c.end;
}

export function classifyClause(
  clause: Clause,
  tokens: Token[],
  lookup: LookupResult,
  patterns: PatternBundle,
): string {
  // Concept word present → registry fact-type (first by position).
  const concepts = lookup.concepts
    .filter((c) => inClause(c, clause))
    .sort((a, b) => a.start - b.start);
  if (concepts.length > 0) return concepts[0].factType;

  const hasDate = patterns.dates.some((p) => patIn(p, clause));
  const hasTime = patterns.times.some((p) => patIn(p, clause));
  const hasPerson = patterns.people.some((p) => patIn(p, clause));
  // Only operator-introduced places count as an anchor — a bare sentence-initial
  // capital ("Broken greenhouse") must not look like a place.
  const places = findPlaces(clause, tokens, lookup, patterns);
  const hasPlace = places.some((p) => p.viaOperator);

  if (hasDate && hasTime && (hasPerson || hasPlace)) return "scheduled_event";
  if (hasDate && !hasTime && !hasPlace) return "note"; // dated note ("Mum's scan, 22nd")
  if (!hasDate && !hasTime && !hasPlace) return hasPerson ? "intent" : "task";
  return "note";
}
