// Curated misspelling tolerance (stress-test Fix 6). Levenshtein-1 fuzzy matching
// on a CURATED hot-token list ONLY — never the whole dictionary, never place or
// contact names (those stay strict; fuzzy place matching causes worse problems
// than it solves). Each fuzzy hit is medium-confidence and flagged so the UI can
// say "I read 'tommorrow' as tomorrow — tap if that's wrong."
//
// Discipline (brief §9): if tempted to add a word, ask whether it's in the curated
// set below. Keep it curated.

// Canonical hot tokens. Map of canonical → itself (we fuzzy-match against keys).
const DAY_MONTH = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  "january", "february", "march", "april", "may", "june", "july", "august",
  "september", "october", "november", "december",
];
const RELATIVE = ["tomorrow", "today", "tonight", "yesterday", "next", "this", "last", "every"];
const TIME_OF_DAY = ["morning", "afternoon", "evening", "night", "noon", "midnight", "lunchtime"];
const EVENT_WORDS = [
  "meeting", "dinner", "lunch", "breakfast", "drinks", "flight", "train", "hotel",
  "call", "demo", "appointment", "conference", "standup",
];

export const HOT_TOKENS: string[] = [
  ...DAY_MONTH,
  ...RELATIVE,
  ...TIME_OF_DAY,
  ...EVENT_WORDS,
];
// Tokens too short for safe Levenshtein-1 (every edit is a different real word).
const MIN_LEN = 4;

// Real English words that are within one edit of a hot token but are NOT typos of
// it — never auto-correct these ("launch"≠lunch, "ranch"≠ranch, "might"≠night).
// Curated from observed collisions; grow from real-input testing, not guesswork.
const REAL_WORD_COLLISIONS = new Set([
  "launch", "ranch", "branch", "bunch", "punch", "march", // vs lunch/march(month is fine)
  "might", "light", "right", "sight", "tight", "fight", "eight", // vs night
  "manday", "sundae", // vs monday/sunday-ish
  "trail", "train", "brain", "drain", // keep real words from collapsing
  "demos", "memo", // vs demo
  "calls", "ball", "tall", "wall", "hall", "fall", "mall", // vs call
  "trains", "brains",
]);

// Bounded Damerau-Levenshtein: true if a and b are within ONE edit, counting an
// adjacent transposition (the most common typo: "Wendsday", "Thurdsay") as one.
function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  if (la === lb) {
    // Count mismatches; allow a single substitution OR a single adjacent swap.
    const diffs: number[] = [];
    for (let i = 0; i < la; i++) if (a[i] !== b[i]) diffs.push(i);
    if (diffs.length === 1) return true; // substitution
    if (diffs.length === 2 && diffs[1] === diffs[0] + 1) {
      // transposition: a[i]==b[i+1] && a[i+1]==b[i]
      return a[diffs[0]] === b[diffs[1]] && a[diffs[1]] === b[diffs[0]];
    }
    return false;
  }
  // lengths differ by 1 — single insertion/deletion.
  const [shorter, longer] = la < lb ? [a, b] : [b, a];
  let i = 0;
  let j = 0;
  let skipped = false;
  while (i < shorter.length && j < longer.length) {
    if (shorter[i] === longer[j]) { i++; j++; continue; }
    if (skipped) return false;
    skipped = true;
    j++;
  }
  return true;
}

// Returns the canonical hot token a (lowercased) word is a likely MISSPELLING of,
// or null. Exact matches and known real-word collisions return null.
export function fuzzyHotToken(word: string): string | null {
  const w = word.toLowerCase();
  if (w.length < MIN_LEN) return null;
  if (HOT_TOKENS.includes(w)) return null; // already correct
  if (REAL_WORD_COLLISIONS.has(w)) return null; // a real word, not a typo
  let best: string | null = null;
  for (const canon of HOT_TOKENS) {
    if (Math.abs(canon.length - w.length) > 1) continue;
    if (withinOneEdit(w, canon)) {
      if (best && best !== canon) return null; // ambiguous → bail
      best = canon;
    }
  }
  return best;
}
