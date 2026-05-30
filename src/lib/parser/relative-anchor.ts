// Relative cross-fact anchoring (stress-test Fix 3a). Full resolution ("an hour
// before the client demo") needs cross-fact context and is DEFERRED to v1.1. To
// avoid confidently-wrong fabrication in the meantime, we DETECT the relative
// phrase and let the caller hold it verbatim + flag the affected slot low.

export interface RelativeAnchor {
  phrase: string;
  range: { start: number; end: number };
  // Which slot the relative phrase governs, so the caller can flag it.
  affects: "time" | "date";
}

// "<duration> before/after <ref>", "an hour before ...", "the day after ...",
// "<ref>'s day". Conservative — only the clear shapes.
const PATTERNS: Array<{ re: RegExp; affects: "time" | "date" }> = [
  { re: /\b(?:an?\s+)?(?:hour|half an hour|few hours|\d+\s*(?:hours?|hrs?|minutes?|mins?))\s+(?:before|after)\b[^,.;]*/i, affects: "time" },
  { re: /\bthe\s+(?:day|morning|afternoon|evening|night|week)\s+(?:before|after)\b[^,.;]*/i, affects: "date" },
  { re: /\b(?:before|after)\s+(?:my|the|your|his|her|our)\s+\w+(?:'s)?\b/i, affects: "date" },
];

export function detectRelativeAnchor(text: string): RelativeAnchor | null {
  for (const { re, affects } of PATTERNS) {
    const m = re.exec(text);
    if (m) return { phrase: m[0].trim(), range: { start: m.index, end: m.index + m[0].length }, affects };
  }
  return null;
}
