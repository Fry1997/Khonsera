// Stage 3 — dictionary lookup. Longest-match phrase scan over the token stream
// against the concept / operator / imperative indexes. ALL matches are carried
// forward (a word like "by" matches several operator categories; disambiguation
// happens at slot-fill time, brief §6/§10).

import type { Token } from "./tokenise";
import type {
  Dictionary,
  OperatorCategory,
  ImperativeEntry,
} from "@/lib/dictionary/dictionary";

interface SpanMatch {
  phrase: string;
  tokenStart: number;
  tokenEnd: number; // inclusive token index
  start: number;
  end: number; // char offsets
}

export interface ConceptMatch extends SpanMatch {
  factType: string;
}
export interface OperatorMatch extends SpanMatch {
  categories: OperatorCategory[];
}
export interface ImperativeMatch extends SpanMatch {
  entry: ImperativeEntry;
}

export interface LookupResult {
  concepts: ConceptMatch[];
  operators: OperatorMatch[];
  imperatives: ImperativeMatch[];
}

// Phrase built from consecutive word/number tokens (punctuation breaks a phrase).
function phraseFrom(tokens: Token[], i: number, len: number): { phrase: string; lastIdx: number } | null {
  const parts: string[] = [];
  let count = 0;
  let j = i;
  for (; j < tokens.length && count < len; j++) {
    if (tokens[j].kind === "punct") break;
    parts.push(tokens[j].lower);
    count++;
  }
  if (count < len) return null;
  return { phrase: parts.join(" "), lastIdx: i + count - 1 };
}

export function lookup(tokens: Token[], dict: Dictionary): LookupResult {
  const concepts: ConceptMatch[] = [];
  const operators: OperatorMatch[] = [];
  const imperatives: ImperativeMatch[] = [];

  const longest = (i: number, max: number, test: (phrase: string) => boolean) => {
    for (let len = Math.min(max, tokens.length - i); len >= 1; len--) {
      const built = phraseFrom(tokens, i, len);
      if (!built) continue;
      if (test(built.phrase)) return built;
    }
    return null;
  };

  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].kind === "punct") continue;

    const concept = longest(i, dict.maxConceptTokens, (p) => dict.conceptIndex.has(p));
    if (concept) {
      concepts.push({
        phrase: concept.phrase,
        tokenStart: i,
        tokenEnd: concept.lastIdx,
        start: tokens[i].start,
        end: tokens[concept.lastIdx].end,
        factType: dict.conceptIndex.get(concept.phrase)!,
      });
    }

    const operator = longest(i, dict.maxOperatorTokens, (p) => dict.operatorIndex.has(p));
    if (operator) {
      operators.push({
        phrase: operator.phrase,
        tokenStart: i,
        tokenEnd: operator.lastIdx,
        start: tokens[i].start,
        end: tokens[operator.lastIdx].end,
        categories: dict.operatorIndex.get(operator.phrase)!,
      });
    }

    const imperative = longest(i, dict.maxImperativeTokens, (p) => dict.imperativeIndex.has(p));
    if (imperative) {
      imperatives.push({
        phrase: imperative.phrase,
        tokenStart: i,
        tokenEnd: imperative.lastIdx,
        start: tokens[i].start,
        end: tokens[imperative.lastIdx].end,
        entry: dict.imperativeIndex.get(imperative.phrase)!,
      });
    }
  }

  return { concepts, operators, imperatives };
}
