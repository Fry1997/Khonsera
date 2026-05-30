// Time recognition: chrono for clock + natural times ("half past eight"); a small
// word list for named day-periods ("morning", "tonight") which produce fuzzy
// ranges, not single timestamps (Layer 5).

import * as chrono from "chrono-node";
import type { PatternMatch } from "./types";

// Named periods → representative range (local clock), all fuzzy.
const DAY_PERIODS: Record<string, { start: string; end: string }> = {
  morning: { start: "08:00", end: "12:00" },
  "first thing": { start: "08:00", end: "09:30" },
  lunchtime: { start: "12:00", end: "14:00" },
  afternoon: { start: "12:00", end: "17:00" },
  evening: { start: "17:00", end: "21:00" },
  tonight: { start: "18:00", end: "23:00" },
  night: { start: "20:00", end: "23:59" },
  "end of the day": { start: "16:30", end: "18:00" },
  "close of play": { start: "16:30", end: "18:00" },
};

function hhmm(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function recogniseTimes(input: string, ref: Date): PatternMatch[] {
  const out: PatternMatch[] = [];

  // 1. Clock / natural times via chrono — only when the hour is certain.
  for (const r of chrono.parse(input, ref, { forwardDate: true })) {
    if (!r.start.isCertain("hour")) continue;
    out.push({
      type: "time",
      source_text: r.text,
      source_range: { start: r.index, end: r.index + r.text.length },
      normalised_value: hhmm(r.start.date()),
      confidence: "high",
      fuzzy: false,
      range: false,
      granularity: "minute",
    });
  }

  // 2. Named day-periods (longest phrase first to catch "first thing"/"end of the day").
  const lower = input.toLowerCase();
  const phrases = Object.keys(DAY_PERIODS).sort((a, b) => b.length - a.length);
  const claimed: Array<[number, number]> = [];
  for (const phrase of phrases) {
    let from = 0;
    let idx: number;
    while ((idx = lower.indexOf(phrase, from)) !== -1) {
      const start = idx;
      const end = idx + phrase.length;
      from = end;
      // Word boundaries + not overlapping a longer claimed period.
      const before = start === 0 || /\W/.test(input[start - 1]);
      const after = end === input.length || /\W/.test(input[end]);
      if (!before || !after) continue;
      if (claimed.some(([cs, ce]) => start < ce && end > cs)) continue;
      claimed.push([start, end]);
      out.push({
        type: "time",
        source_text: input.slice(start, end),
        source_range: { start, end },
        normalised_value: DAY_PERIODS[phrase],
        // Low, not medium: the user said "morning"/"evening", not a clock time.
        // The range is a soft hint; the fact must not read as a confident time
        // (handback §4 — calibration). Tap-to-set-exact happens in the UI.
        confidence: "low",
        fuzzy: true,
        range: true,
        granularity: "period",
      });
    }
  }

  return out;
}
