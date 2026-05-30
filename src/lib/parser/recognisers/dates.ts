// Date recognition via chrono-node (Layer 5 mandates a real date library).
// Emits a date match when chrono finds a calendar component (day/month/weekday).
// Confidence reflects chrono's certainty: "the 22nd" (month unspecified) → low.

import * as chrono from "chrono-node";
import type { PatternMatch } from "./types";

const FUZZY_RE = /\b(early|mid|late|beginning of|end of|next week|this weekend|the week after next|sometime)\b/i;

function iso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Bare ordinal day with no month ("the 22nd"). chrono (this version) doesn't
// resolve these, yet Layer 5 lists them — supplement with a low-confidence guess
// (month assumed: this month, or next if the day has already passed).
const ORDINAL_RE = /\b(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\b/gi;

function ordinalDates(
  input: string,
  ref: Date,
  taken: Array<{ start: number; end: number }>,
): PatternMatch[] {
  const out: PatternMatch[] = [];
  let m: RegExpExecArray | null;
  ORDINAL_RE.lastIndex = 0;
  while ((m = ORDINAL_RE.exec(input)) !== null) {
    const day = parseInt(m[1], 10);
    if (day < 1 || day > 31) continue;
    const start = m.index;
    const end = start + m[0].length;
    if (taken.some((t) => t.start < end && t.end > start)) continue; // chrono already has it
    let month = ref.getMonth();
    let year = ref.getFullYear();
    if (day < ref.getDate()) {
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
    }
    const value = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    out.push({
      type: "date",
      source_text: m[0],
      source_range: { start, end },
      normalised_value: value,
      confidence: "low",
      fuzzy: false,
      range: false,
      granularity: "day",
    });
  }
  return out;
}

export function recogniseDates(input: string, ref: Date): PatternMatch[] {
  const results = chrono.parse(input, ref, { forwardDate: true });
  const out: PatternMatch[] = [];

  for (const r of results) {
    const s = r.start;
    const hasDate =
      s.isCertain("day") ||
      s.isCertain("month") ||
      s.get("weekday") !== null ||
      s.isCertain("year");
    if (!hasDate) continue; // time-only match — handled by the time recogniser

    const fuzzy = FUZZY_RE.test(r.text);
    const isRange = r.end !== null && r.end !== undefined;

    // Component certainty drives confidence.
    let confidence: PatternMatch["confidence"] = "high";
    if (!s.isCertain("month") && s.get("weekday") === null) confidence = "low";
    else if (s.get("weekday") !== null && !s.isCertain("day")) confidence = "medium";
    if (fuzzy) confidence = "low";

    const value = isRange
      ? { start: iso(s.date()), end: iso(r.end!.date()) }
      : iso(s.date());

    out.push({
      type: "date",
      source_text: r.text,
      source_range: { start: r.index, end: r.index + r.text.length },
      normalised_value: value,
      confidence,
      fuzzy,
      range: isRange,
      granularity: fuzzy ? "fuzzy" : "day",
    });
  }

  out.push(
    ...ordinalDates(
      input,
      ref,
      out.map((o) => o.source_range),
    ),
  );
  return out;
}
