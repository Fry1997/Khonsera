// Stage 4 — imperative routing. An imperative only routes when its trigger is at
// the START of the input (brief §7 + Layer-4 engine notes), so "broken greenhouse
// — sort" does NOT become a booking_request. Question-shape gates
// information_request; position+object gates itinerary_request (plan/route/map).

import type { Token } from "./tokenise";
import type { LookupResult } from "./lookup";
import type { ImperativeIntent } from "@/lib/dictionary/dictionary";

export interface ImperativeRouting {
  intent_type: ImperativeIntent | null;
  // char offset just after the consumed trigger (for create_intent label extraction)
  consumedEnd: number;
}

export function routeImperative(
  input: string,
  tokens: Token[],
  lookup: LookupResult,
): ImperativeRouting {
  const firstSig = tokens.findIndex((t) => t.kind !== "punct");
  if (firstSig === -1) return { intent_type: null, consumedEnd: 0 };

  // Imperative triggers anchored at the first significant token; prefer longest.
  const atStart = lookup.imperatives
    .filter((m) => m.tokenStart === firstSig)
    .sort((a, b) => b.tokenEnd - a.tokenEnd);
  if (atStart.length === 0) return { intent_type: null, consumedEnd: 0 };

  const match = atStart[0];
  const entry = match.entry;
  const endsWithQ = input.trim().endsWith("?");
  const sigCount = tokens.filter((t) => t.kind !== "punct").length;

  if (entry.questionShaped) {
    // Only an information_request if the input is actually question-shaped.
    if (!endsWithQ && sigCount > 8) return { intent_type: null, consumedEnd: 0 };
  }

  if (entry.positional) {
    // plan/route/map only when followed by an object phrase (another word token).
    const next = tokens[match.tokenEnd + 1];
    if (!next || next.kind === "punct") return { intent_type: null, consumedEnd: 0 };
  }

  return { intent_type: entry.intent, consumedEnd: match.end };
}
