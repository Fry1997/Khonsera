// People-reference recognition (Layer 5). Recognises the SHAPE of a person
// reference, never the identity — resolution belongs to contacts/standing-facts
// at runtime. Every match carries requires_runtime_resolution.

import type { PatternMatch } from "./types";

type PersonKind =
  | "named_person"
  | "possessive_person"
  | "family_reference"
  | "work_reference"
  | "role_reference";

const FAMILY = ["my wife", "my husband", "my partner", "my son", "my daughter", "my mum", "my dad", "my mother", "my father"];
const WORK = ["the client", "the customer", "the team", "the sales team", "my manager", "my colleague", "my boss"];
const ROLE = ["the organiser", "the organizer", "the driver", "the host"];
const POSSESSIVE_RE = /\b([A-Z][a-z]+)['’]s\s+(mum|dad|mother|father|wife|husband|partner|son|daughter|colleague|manager|boss)\b/g;
// A capitalised name introduced by "with"/"meet"/"meeting"/"&".
const NAMED_RE = /\b(?:with|meet|meeting|and|&|see|seeing)\s+([A-Z][a-z]+)\b/g;

function phraseMatches(
  input: string,
  phrases: string[],
  kind: PersonKind,
  confidence: PatternMatch["confidence"],
): PatternMatch[] {
  const out: PatternMatch[] = [];
  const lower = input.toLowerCase();
  for (const phrase of phrases) {
    let idx = lower.indexOf(phrase);
    while (idx !== -1) {
      const end = idx + phrase.length;
      const before = idx === 0 || /\W/.test(input[idx - 1]);
      const after = end === input.length || /\W/.test(input[end]);
      if (before && after) {
        out.push({
          type: "person",
          source_text: input.slice(idx, end),
          source_range: { start: idx, end },
          normalised_value: input.slice(idx, end),
          confidence,
          fuzzy: false,
          range: false,
          granularity: "exact",
          meta: { kind, requires_runtime_resolution: true },
        });
      }
      idx = lower.indexOf(phrase, end);
    }
  }
  return out;
}

export function recognisePeople(input: string): PatternMatch[] {
  const out: PatternMatch[] = [
    ...phraseMatches(input, FAMILY, "family_reference", "high"),
    ...phraseMatches(input, WORK, "work_reference", "medium"),
    ...phraseMatches(input, ROLE, "role_reference", "medium"),
  ];

  let m: RegExpExecArray | null;
  POSSESSIVE_RE.lastIndex = 0;
  while ((m = POSSESSIVE_RE.exec(input)) !== null) {
    out.push({
      type: "person",
      source_text: m[0],
      source_range: { start: m.index, end: m.index + m[0].length },
      normalised_value: m[0],
      confidence: "medium",
      fuzzy: false,
      range: false,
      granularity: "exact",
      meta: { kind: "possessive_person" as PersonKind, requires_runtime_resolution: true },
    });
  }

  NAMED_RE.lastIndex = 0;
  while ((m = NAMED_RE.exec(input)) !== null) {
    // Capture group is the name; range covers just the name token.
    const name = m[1];
    const start = m.index + m[0].lastIndexOf(name);
    out.push({
      type: "person",
      source_text: name,
      source_range: { start, end: start + name.length },
      normalised_value: name,
      confidence: "medium",
      fuzzy: false,
      range: false,
      granularity: "exact",
      meta: { kind: "named_person" as PersonKind, requires_runtime_resolution: true },
    });
  }

  return out;
}
