// Pure detection of the entity fragment under the caret + its role, mirroring
// the parser's operator semantics (place.ts roleFromOperator) so the live
// autosuggest agrees with what the parser will later infer. DOM-free + tested.

export type SuggestRole = "origin_station" | "destination_station" | "place" | "person";

export interface ActiveToken {
  // The partial entity text between the operator and the caret.
  fragment: string;
  // Its offset range within the full text (for rewrite-on-pick).
  range: { start: number; end: number };
  role: SuggestRole;
  // Which catalogue to search + (for stations) the hub kind.
  search: "station" | "place" | "person";
  hubKind?: "rail_station" | "airport";
}

// Operators that introduce an entity, in match priority. Person verbs come
// first so "meeting with Sam" reads as a person, not a place.
const FLIGHT_RE = /\bfl(?:y|ight|ights|ying)\b/i;

// The trailing fragment after the operator: letters plus the few punctuation
// marks real names carry (apostrophe, &, hyphen, dot, spaces). Stops at commas,
// digits, and clause punctuation — so "from Wel" captures "Wel", and
// "Derby demo, train from Wel" captures only "Wel".
const OPERATOR_RE =
  /\b(from|to|at|in|near|with|meet|meeting|see|seeing)\s+([A-Za-z][A-Za-z'&.\- ]*)$/i;

export function activeTokenAt(text: string, caret: number): ActiveToken | null {
  if (caret <= 0 || caret > text.length) return null;
  const pre = text.slice(0, caret);
  const m = OPERATOR_RE.exec(pre);
  if (!m) return null;
  const op = m[1].toLowerCase();
  const fragment = m[2];
  // A trailing space means the user finished a word — don't suggest mid-gap.
  if (fragment.length === 0 || /\s$/.test(fragment)) return null;

  const start = caret - fragment.length;
  const range = { start, end: caret };

  if (op === "from") {
    return { fragment, range, role: "origin_station", search: "station", hubKind: FLIGHT_RE.test(pre) ? "airport" : "rail_station" };
  }
  if (op === "to") {
    return { fragment, range, role: "destination_station", search: "station", hubKind: FLIGHT_RE.test(pre) ? "airport" : "rail_station" };
  }
  if (op === "with" || op === "meet" || op === "meeting" || op === "see" || op === "seeing") {
    return { fragment, range, role: "person", search: "person" };
  }
  // in / at / near → an event place.
  return { fragment, range, role: "place", search: "place" };
}

// Replace [start,end) with `replacement`, returning the new text + caret offset
// to place just after the inserted text. Pure + tested.
export function replaceRange(
  text: string,
  range: { start: number; end: number },
  replacement: string,
): { text: string; caret: number } {
  const next = text.slice(0, range.start) + replacement + text.slice(range.end);
  return { text: next, caret: range.start + replacement.length };
}
