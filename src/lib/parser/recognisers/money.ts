// Money recognition (Layer 5). Exact amounts, approximate (around/about),
// bounds (under/over), and qualitative preferences (cheap/premium). Class words
// (first/standard class) are flagged as travel-class preferences, not amounts.

import type { PatternMatch } from "./types";

type Constraint = "equals" | "approximate" | "maximum" | "minimum" | "preference";

const AMOUNT_RE = /(?:£\s?(\d+(?:\.\d{1,2})?))|(?:\b(\d+(?:\.\d{1,2})?)\s?(?:pounds|gbp)\b)/gi;
const QUALITATIVE = ["cheap", "budget", "premium", "expensive", "luxury"];
const CLASS_RE = /\b(first|standard|business|economy)\s+class\b/gi;

function constraintFor(prefix: string): Constraint {
  if (/\b(around|about|roughly|approx(?:imately)?|ish)\b\s*$/i.test(prefix)) return "approximate";
  if (/\b(no more than|under|less than|up to|max(?:imum)?)\b\s*$/i.test(prefix)) return "maximum";
  if (/\b(over|more than|at least|min(?:imum)?)\b\s*$/i.test(prefix)) return "minimum";
  return "equals";
}

export function recogniseMoney(input: string): PatternMatch[] {
  const out: PatternMatch[] = [];

  let m: RegExpExecArray | null;
  AMOUNT_RE.lastIndex = 0;
  while ((m = AMOUNT_RE.exec(input)) !== null) {
    const amount = parseFloat(m[1] ?? m[2]);
    const prefix = input.slice(Math.max(0, m.index - 24), m.index);
    const constraint = constraintFor(prefix);
    out.push({
      type: "money",
      source_text: m[0],
      source_range: { start: m.index, end: m.index + m[0].length },
      normalised_value: { amount, currency: "GBP", constraint },
      confidence: "high",
      fuzzy: constraint === "approximate",
      range: constraint === "maximum" || constraint === "minimum",
      granularity: "exact",
      meta: { constraint },
    });
  }

  // Qualitative price preferences.
  const lower = input.toLowerCase();
  for (const word of QUALITATIVE) {
    let idx = lower.indexOf(word);
    while (idx !== -1) {
      const end = idx + word.length;
      const before = idx === 0 || /\W/.test(input[idx - 1]);
      const after = end === input.length || /\W/.test(input[end]);
      if (before && after) {
        out.push({
          type: "money",
          source_text: input.slice(idx, end),
          source_range: { start: idx, end },
          normalised_value: { preference: word, constraint: "preference" as Constraint },
          confidence: "medium",
          fuzzy: true,
          range: false,
          granularity: "fuzzy",
          meta: { constraint: "preference" },
        });
      }
      idx = lower.indexOf(word, end);
    }
  }

  // Travel class words.
  let c: RegExpExecArray | null;
  CLASS_RE.lastIndex = 0;
  while ((c = CLASS_RE.exec(input)) !== null) {
    out.push({
      type: "money",
      source_text: c[0],
      source_range: { start: c.index, end: c.index + c[0].length },
      normalised_value: { travel_class: c[1].toLowerCase(), constraint: "preference" as Constraint },
      confidence: "high",
      fuzzy: false,
      range: false,
      granularity: "exact",
      meta: { travel_class: true },
    });
  }

  return out;
}
