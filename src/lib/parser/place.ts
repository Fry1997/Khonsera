// Place-candidate detection shared by classification (stage 6) and slot-filling
// (stage 7). A candidate is either introduced by an operator (from/to → origin/
// destination; in/at/near → place; via/stopping at → waypoint) or a bare
// Title-Case run. Resolution to a hub/location happens later, slot-aware.

import type { Token } from "./tokenise";
import type { LookupResult } from "./lookup";
import type { PatternBundle } from "./recognisers";

export type PlaceRole = "origin" | "destination" | "place" | "waypoint";

export interface PlaceCandidate {
  role: PlaceRole;
  text: string;
  start: number;
  end: number;
  explicitStation: boolean;
  // True when introduced by an operator (from/to/in/at/via); false for a bare
  // Title-Case run. Bare runs are too noisy to gate classification on.
  viaOperator: boolean;
}

const MONTHS = new Set([
  "january", "february", "march", "april", "may", "june", "july", "august",
  "september", "october", "november", "december",
  "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec",
]);
const WEEKDAYS = new Set([
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  "mon", "tue", "tues", "wed", "thu", "thur", "thurs", "fri", "sat", "sun",
  "today", "tomorrow", "yesterday", "tonight", "weekend",
]);
// Time-direction + connector words that must CLOSE a place-name run (handback
// §2.3). "Wellingborough arriving" → place candidate is "Wellingborough"; the
// time-direction word starts the next clause and attaches to the time, not the
// origin. Bare operators (at/on/by/via) already close runs via lookup.operators.
const PLACE_BOUNDARY = new Set([
  "arriving", "arrive", "arrives", "leaving", "leave", "leaves",
  "departing", "depart", "departs", "returning", "return", "returns",
  "then", "back", "with",
]);

function roleFromOperator(phrase: string): PlaceRole | null {
  if (phrase === "from") return "origin";
  if (phrase === "to") return "destination";
  if (["in", "at", "near", "nearby", "near to", "close to", "next to"].includes(phrase)) return "place";
  if (["via", "stopping at", "stop at", "stop in", "calling at", "changing at", "change at", "through"].includes(phrase)) return "waypoint";
  return null;
}

// Sentence-initial common words that are capitalised only by position, never
// places (handback §2.2: "Be in Liverpool" must not yield place="Be").
const NON_PLACE_WORDS = new Set([
  "be", "being", "been", "go", "going", "get", "getting", "got", "let",
  "do", "doing", "did", "make", "take", "give", "see", "have", "need",
]);

// Tokens that terminate a place-name run. "&" is the one punctuation kept inside
// a run so venue names like "Frankie & Benny's" survive (handback §5.1/§5.2).
function isStop(
  tok: Token,
  idx: number,
  lookup: LookupResult,
  patterns: PatternBundle,
): boolean {
  if (tok.kind === "punct") return tok.text !== "&";
  if (MONTHS.has(tok.lower) || WEEKDAYS.has(tok.lower)) return true;
  if (PLACE_BOUNDARY.has(tok.lower)) return true;
  if (lookup.concepts.some((c) => c.tokenStart === idx)) return true;
  if (lookup.operators.some((o) => o.tokenStart === idx)) return true;
  if (patterns.all.some((p) => p.source_range.start <= tok.start && p.source_range.end > tok.start)) return true;
  return false;
}

function collectRun(
  tokens: Token[],
  from: number,
  to: number,
  lookup: LookupResult,
  patterns: PatternBundle,
): { text: string; start: number; end: number; lastIdx: number } | null {
  let j = from;
  const parts: Token[] = [];
  while (j <= to && !isStop(tokens[j], j, lookup, patterns)) {
    parts.push(tokens[j]);
    j++;
    if (parts.length >= 4) break; // a place name is short
  }
  if (parts.length === 0) return null;
  return {
    text: parts.map((p) => p.text).join(" "),
    start: parts[0].start,
    end: parts[parts.length - 1].end,
    lastIdx: j - 1,
  };
}

export function findPlaces(
  clause: { tokenStart: number; tokenEnd: number },
  tokens: Token[],
  lookup: LookupResult,
  patterns: PatternBundle,
): PlaceCandidate[] {
  const out: PlaceCandidate[] = [];
  const claimed = new Set<number>();
  const { tokenStart, tokenEnd } = clause;

  // 1. Operator-introduced places.
  for (const op of lookup.operators) {
    if (op.tokenStart < tokenStart || op.tokenEnd > tokenEnd) continue;
    const role = roleFromOperator(op.phrase);
    if (!role) continue;
    const run = collectRun(tokens, op.tokenEnd + 1, tokenEnd, lookup, patterns);
    if (!run) continue;
    // A person introduced by from/to/for ("from Ricky", "to Jane") is NOT a place
    // — let the person recogniser own it, don't mint a bogus origin/destination.
    const isPerson = patterns.people.some(
      (p) => p.source_range.start <= run.start && p.source_range.end >= run.end,
    );
    if (isPerson) continue;
    for (let k = op.tokenEnd + 1; k <= run.lastIdx; k++) claimed.add(k);
    const tail = tokens[run.lastIdx + 1]?.lower;
    const explicitStation = /station|airport|terminal/i.test(run.text) || tail === "station" || tail === "airport";
    out.push({ role, text: run.text.replace(/\s+(station|airport|terminal)$/i, ""), start: run.start, end: run.end, explicitStation, viaOperator: true });
  }

  // 2. Bare Title-Case runs not already claimed.
  for (let i = tokenStart; i <= tokenEnd; i++) {
    if (claimed.has(i)) continue;
    const t = tokens[i];
    if (t.kind !== "word") continue;
    if (!/^[A-Z]/.test(t.text)) continue;
    if (MONTHS.has(t.lower) || WEEKDAYS.has(t.lower)) continue;
    if (NON_PLACE_WORDS.has(t.lower)) continue;
    if (PLACE_BOUNDARY.has(t.lower)) continue;
    if (lookup.concepts.some((c) => c.tokenStart === i)) continue;
    if (lookup.operators.some((o) => o.tokenStart === i)) continue;
    if (lookup.imperatives.some((m) => m.tokenStart === i)) continue;
    if (patterns.people.some((p) => p.source_range.start <= t.start && p.source_range.end > t.start)) continue;
    if (i > 0 && tokens[i - 1].kind !== "punct" && i === tokenStart) {
      // first token of clause that's capitalised only by sentence position — still allow
    }
    const run = collectRun(tokens, i, tokenEnd, lookup, patterns);
    if (!run) continue;
    for (let k = i; k <= run.lastIdx; k++) claimed.add(k);
    const tail = tokens[run.lastIdx + 1]?.lower;
    const explicitStation = /station|airport|terminal/i.test(run.text) || tail === "station" || tail === "airport";
    out.push({ role: "place", text: run.text.replace(/\s+(station|airport|terminal)$/i, ""), start: run.start, end: run.end, explicitStation, viaOperator: false });
  }

  return out.sort((a, b) => a.start - b.start);
}
