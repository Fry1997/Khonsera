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

  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].kind === "punct" && /[,;.!?\n]/.test(tokens[i].text)) {
      boundaryAfter.add(i);
    }
  }
  for (const op of lookup.operators) {
    if (!op.categories.includes("connector")) continue;
    const conceptFollows = lookup.concepts.some((c) => c.tokenStart > op.tokenEnd);
    if (conceptFollows) boundaryAfter.add(op.tokenEnd);
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

  // Merge fragments with neither a concept nor any anchor into the previous clause.
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
    if (!hasConcept && !hasAnchor && merged.length > 0) {
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
