// Stage 4b — negation / correction routing (stress-test Fix 1, PRIORITY 1).
//
// The ONLY failure class that produces actively dangerous output: a sentence the
// user opened with a negation ("No meeting Monday", "Cancel...") must NEVER create
// a positive fact. We route such inputs to a cancellation_request / correction_intent
// and hold the verbatim text — the intent layer resolves it later.
//
// This runs BEFORE imperative routing and classification. It is deliberately
// conservative: it only fires on a sentence-LEADING signal, so a mid-sentence
// retraction ("Lunch Thursday, not Wednesday") still flows to the fact engine and
// the existing date-picking behaviour is preserved.

export type NegationRoute =
  | { kind: "cancellation"; text: string }
  | { kind: "correction"; text: string }
  | null;

// Leading retraction markers → a correction the parser flags but doesn't apply.
const CORRECTION_LEAD = /^(actually\s*,?\s*no\b|actually\s*[,–-]|scrap that\b|ignore that\b|forget that\b)/i;

// Leading negation/cancellation markers → never build a positive fact.
// Matched at the very start (after trimming + leading punctuation).
const NEGATION_LEAD =
  /^(no longer\b|no need to\b|not going to\b|won'?t be\b|no\b|not\b|cancel(?:led|ling)?\b|dropped\b|scrapped\b|skip(?:ping)?\b)/i;

// Words that, right after a leading "no"/"not", mean it ISN'T a cancellation —
// it's a normal fact that happens to start with a quantifier-ish "no" we don't
// support, or a negated descriptor. Kept tiny + conservative.
const NOT_CANCELLATION_AFTER = /^(?:problem|worries|rush|idea|one|body|where|thing)\b/i;

export function routeNegation(input: string): NegationRoute {
  const trimmed = input.trim().replace(/^[\s,–-]+/, "");
  if (trimmed.length === 0) return null;

  if (CORRECTION_LEAD.test(trimmed)) {
    return { kind: "correction", text: input.trim() };
  }

  const m = NEGATION_LEAD.exec(trimmed);
  if (!m) return null;

  // "no"/"not" followed by a non-cancellation word ("no worries", "not bad") →
  // don't hijack. (cancel/cancelled/dropped are unconditional.)
  const lead = m[1].toLowerCase();
  if ((lead === "no" || lead === "not")) {
    const after = trimmed.slice(m[0].length).trim();
    if (NOT_CANCELLATION_AFTER.test(after)) return null;
    // A bare "no" with nothing fact-shaped after it isn't a cancellation either.
    if (after.length === 0) return null;
  }

  return { kind: "cancellation", text: input.trim() };
}
