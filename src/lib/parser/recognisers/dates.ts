// Date recognition via chrono-node (Layer 5 mandates a real date library).
// Emits a date match when chrono finds a calendar component (day/month/weekday).
// Confidence reflects chrono's certainty: "the 22nd" (month unspecified) → low.

import * as chrono from "chrono-node";
import type { PatternMatch } from "./types";
import { fuzzyHotToken } from "../fuzzy";

const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};
const MONTH_INDEX: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};
const RELATIVE_DAYS: Record<string, number> = { today: 0, tomorrow: 1, yesterday: -1, tonight: 0 };

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

// Next occurrence (forward) of a weekday from ref.
function nextWeekday(ref: Date, target: number): Date {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 12);
  let delta = (target - d.getDay() + 7) % 7;
  if (delta === 0) delta = 7; // "next Tuesday" when today is Tuesday → following week
  d.setDate(d.getDate() + delta);
  return d;
}

// Fuzzy day/month/relative-date recognition (stress-test Fix 6). Supplements
// chrono (which is strict) for ONE misspelled hot-token per input. Operates on
// original offsets so source ranges stay correct. Place/contact names stay strict.
const WORD_RE = /\b([A-Za-z]{4,})\b/g;
function fuzzyDates(
  input: string,
  ref: Date,
  taken: Array<{ start: number; end: number }>,
): PatternMatch[] {
  let m: RegExpExecArray | null;
  WORD_RE.lastIndex = 0;
  while ((m = WORD_RE.exec(input)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    if (taken.some((t) => t.start < end && t.end > start)) continue;
    const canon = fuzzyHotToken(m[1]);
    if (!canon) continue;
    let date: Date | null = null;
    let gran: PatternMatch["granularity"] = "day";
    if (canon in WEEKDAY_INDEX) date = nextWeekday(ref, WEEKDAY_INDEX[canon]);
    else if (canon in RELATIVE_DAYS) {
      date = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + RELATIVE_DAYS[canon], 12);
    } else if (canon in MONTH_INDEX) {
      // A bare misspelled month → first of that month (low confidence, day assumed).
      let year = ref.getFullYear();
      if (MONTH_INDEX[canon] < ref.getMonth()) year += 1;
      date = new Date(year, MONTH_INDEX[canon], 1, 12);
      gran = "month";
    }
    if (!date) continue;
    return [{
      type: "date",
      source_text: m[0],
      source_range: { start, end },
      normalised_value: iso(date),
      confidence: "medium",
      fuzzy: false,
      range: false,
      granularity: gran,
      meta: { fuzzyCorrectedTo: canon, original: m[0] },
    }];
  }
  return [];
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
  out.push(...fuzzyDates(input, ref, out.map((o) => o.source_range)));
  return out;
}
