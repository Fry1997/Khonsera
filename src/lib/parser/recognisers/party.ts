// Party-size recognition (Layer 5). Solo phrases → 1; explicit/group sizes →
// integer; "family of four" → 4 but keeps source_text (adult/child split unknown).

import type { PatternMatch } from "./types";
import { wordToNumber } from "./numbers";

const NUM = "(\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)";
const SOLO_RE = /\b(just me|only me|me only|solo|on my own|by myself)\b/i;

interface Rule {
  re: RegExp;
  size: (m: RegExpExecArray) => number | null;
  fuzzy?: boolean;
}

const RULES: Rule[] = [
  { re: SOLO_RE, size: () => 1 },
  { re: new RegExp(`\\btable for\\s+${NUM}\\b`, "i"), size: (m) => wordToNumber(m[1]) },
  { re: new RegExp(`\\bfor\\s+${NUM}\\b`, "i"), size: (m) => wordToNumber(m[1]) },
  { re: new RegExp(`\\b(?:a\\s+)?group of\\s+${NUM}\\b`, "i"), size: (m) => wordToNumber(m[1]) },
  { re: new RegExp(`\\bparty of\\s+${NUM}\\b`, "i"), size: (m) => wordToNumber(m[1]) },
  { re: new RegExp(`\\bfamily of\\s+${NUM}\\b`, "i"), size: (m) => wordToNumber(m[1]), fuzzy: true },
  { re: new RegExp(`\\b${NUM}\\s+people\\b`, "i"), size: (m) => wordToNumber(m[1]) },
  // "two adults and one child" → sum, fuzzy (breakdown not modelled).
  { re: new RegExp(`\\b${NUM}\\s+adults?(?:\\s+and\\s+${NUM}\\s+(?:child|children|kids?))?`, "i"), size: (m) => (wordToNumber(m[1]) ?? 0) + (m[2] ? wordToNumber(m[2]) ?? 0 : 0), fuzzy: true },
];

export function recogniseParty(input: string): PatternMatch[] {
  const out: PatternMatch[] = [];
  const claimed: Array<[number, number]> = [];
  for (const rule of RULES) {
    const re = new RegExp(rule.re.source, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(input)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      if (claimed.some(([cs, ce]) => start < ce && end > cs)) continue;
      const size = rule.size(m);
      if (size === null || size === 0) continue;
      claimed.push([start, end]);
      out.push({
        type: "party_size",
        source_text: m[0],
        source_range: { start, end },
        normalised_value: size,
        confidence: rule.fuzzy ? "medium" : "high",
        fuzzy: rule.fuzzy ?? false,
        range: false,
        granularity: "exact",
      });
    }
  }
  return out;
}
