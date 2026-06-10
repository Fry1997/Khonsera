import { DISPLAY_TZ } from "@/components/concierge/types";

// Interpret a wall-clock `YYYY-MM-DD` + `HH:MM` as a time in the display timezone
// (Europe/London) and return the correct UTC ISO.
//
// This MUST be independent of the runtime's own timezone, because it's called both
// server-side (UTC) and client-side (the user's browser, already Europe/London).
// The previous offset trick used `new Date(toLocaleString(...))`, which re-parses
// in the runtime's local zone — so in the browser the offset cancelled to zero and
// a 09:00 BST entry was stored as 09:00Z (an hour off), then rendered as 10:00.
//
// `Intl.formatToParts` reads the wall-clock numbers in `tz` for a given instant
// without any dependence on the runtime zone, so the offset is always correct.
export function wallClockToIso(dateStr: string, hhmm: string, tz: string = DISPLAY_TZ): string {
  if (!dateStr || !hhmm) return "";
  // Treat the wall clock as if it were UTC ("naive" instant).
  const naive = new Date(`${dateStr}T${hhmm}:00Z`);
  if (Number.isNaN(naive.getTime())) return "";
  // Offset of `tz` from UTC at that instant, then shift the naive instant by it.
  // (One pass is exact except within the ~1h of a DST transition, which no UK
  // wall-clock entry lands on in practice.)
  const offset = tzOffsetMs(naive, tz);
  return new Date(naive.getTime() - offset).toISOString();
}

// How far ahead of UTC `tz` is at the given instant, in milliseconds (BST = +1h).
function tzOffsetMs(instant: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, number> = {};
  for (const p of dtf.formatToParts(instant)) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - instant.getTime();
}
