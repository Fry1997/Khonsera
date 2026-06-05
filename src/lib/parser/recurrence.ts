// Recurrence detection (stress-test Fix 8). Recurrence is DEFERRED — we do NOT
// expand instances. We detect the cadence, hold it verbatim, and surface it in the
// UI so the deferral feels intentional. The single produced fact is the next
// occurrence (the date recogniser already resolves "Tuesday" → next Tuesday).

const DAY = "(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)";

const PATTERNS: RegExp[] = [
  new RegExp(`\\bevery\\s+${DAY}\\b`, "i"),
  /\bevery\s+(?:other\s+)?(?:day|week|fortnight|month|year)\b/i,
  /\bevery\s+(?:two|three|four|\d+)\s+(?:days|weeks|months)\b/i,
  /\b(?:weekly|fortnightly|monthly|quarterly|daily|biweekly|bi-weekly)\b/i,
  // Slash-separated multi-day: Mon/Wed/Fri
  new RegExp(`\\b${DAY}\\s*/\\s*${DAY}(?:\\s*/\\s*${DAY})*\\b`, "i"),
  /\b(?:first|second|third|fourth|last)\s+\w+\s+of\s+(?:every|the)\s+month\b/i,
];

// Returns the verbatim cadence phrase if the text expresses a recurrence, else null.
export function detectRecurrence(text: string): string | null {
  for (const re of PATTERNS) {
    const m = re.exec(text);
    if (m) return m[0].replace(/\s+/g, " ").trim();
  }
  return null;
}
