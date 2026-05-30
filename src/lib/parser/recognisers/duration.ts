// Duration recognition (Layer 5). Normalises to minutes where exact; vague
// durations ("a few hours") are fuzzy; overnight/N-nights are night ranges.

import type { PatternMatch } from "./types";
import { wordToNumber } from "./numbers";

interface Rule {
  re: RegExp;
  build: (m: RegExpExecArray) => Omit<PatternMatch, "type" | "source_text" | "source_range">;
}

const NUM = "(\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|a|an|a couple of|a few)";

const RULES: Rule[] = [
  {
    re: /\bhalf an hour\b/i,
    build: () => ({ normalised_value: 30, confidence: "high", fuzzy: false, range: false, granularity: "minute" }),
  },
  {
    re: /\bquarter of an hour\b/i,
    build: () => ({ normalised_value: 15, confidence: "high", fuzzy: false, range: false, granularity: "minute" }),
  },
  {
    re: /\b(an? )?hour\b/i,
    build: () => ({ normalised_value: 60, confidence: "high", fuzzy: false, range: false, granularity: "hour" }),
  },
  {
    re: new RegExp(`\\b${NUM}\\s*(?:minutes?|mins?)\\b`, "i"),
    build: (m) => ({ normalised_value: (wordToNumber(m[1]) ?? 0), confidence: "high", fuzzy: false, range: false, granularity: "minute" }),
  },
  {
    re: new RegExp(`\\b${NUM}\\s*hours?\\b`, "i"),
    build: (m) => ({ normalised_value: (wordToNumber(m[1]) ?? 0) * 60, confidence: m[1] === "a few" ? "low" : "high", fuzzy: /a few|a couple/.test(m[1]), range: false, granularity: "hour" }),
  },
  {
    re: new RegExp(`\\b${NUM}\\s*days?\\b`, "i"),
    build: (m) => ({ normalised_value: (wordToNumber(m[1]) ?? 0) * 1440, confidence: /a couple|a few/.test(m[1]) ? "low" : "high", fuzzy: /a couple|a few/.test(m[1]), range: false, granularity: "day" }),
  },
  {
    re: new RegExp(`\\bfor\\s+${NUM}\\s*nights?\\b`, "i"),
    build: (m) => ({ normalised_value: { nights: wordToNumber(m[1]) ?? null }, confidence: "high", fuzzy: false, range: true, granularity: "day" }),
  },
  {
    re: /\bovernight\b/i,
    build: () => ({ normalised_value: { nights: 1 }, confidence: "high", fuzzy: false, range: true, granularity: "day" }),
  },
  {
    re: /\b(a few hours|a couple of days|all day|for the weekend)\b/i,
    build: () => ({ normalised_value: null, confidence: "low", fuzzy: true, range: true, granularity: "fuzzy" }),
  },
];

export function recogniseDurations(input: string): PatternMatch[] {
  const out: PatternMatch[] = [];
  const claimed: Array<[number, number]> = [];
  for (const rule of RULES) {
    const re = new RegExp(rule.re.source, rule.re.flags.includes("g") ? rule.re.flags : rule.re.flags + "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(input)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      if (claimed.some(([cs, ce]) => start < ce && end > cs)) continue;
      claimed.push([start, end]);
      out.push({ type: "duration", source_text: m[0], source_range: { start, end }, ...rule.build(m) });
    }
  }
  return out;
}
