// Booking-reference + IATA-route recognition (Layer 5, stress-test Fix 9).
// Permissive by design — context (the fact-type) disambiguates flight vs train vs
// hotel. Confidence is medium; the source range is preserved for UI highlighting.

import type { PatternMatch } from "./types";

// An uppercase alphanumeric token, 5-9 chars, with at least one letter AND at
// least one digit: BA307, C4X9P2, HTL4428, EZ1234, FR9876, ABC123XYZ. Permissive
// by design — the fact-type disambiguates. (Two-letter+short-number airline codes
// like "BA307" are 5 chars, the floor.)
const REF_TOKEN_RE = /\b([A-Z0-9]{5,9})\b/g;
const HAS_LETTER = /[A-Z]/;
const HAS_DIGIT = /[0-9]/;
// IATA route: LHR-CDG / LHR–CDG (en-dash). Three letters, dash, three letters.
const ROUTE_RE = /\b([A-Z]{3})[-–]([A-Z]{3})\b/g;

// Pure-digit and pure-alpha exclusions handled by the regex shape (needs both a
// letter prefix and digits). A few common false positives to skip.
const NOT_A_REF = new Set(["COVID19", "MP3", "MP4", "A4", "B2B", "H2O"]);

export function recogniseBookingRefs(input: string): PatternMatch[] {
  const out: PatternMatch[] = [];

  // Routes first, so their 3-letter codes aren't also picked up as refs.
  const claimed: Array<[number, number]> = [];
  let m: RegExpExecArray | null;
  ROUTE_RE.lastIndex = 0;
  while ((m = ROUTE_RE.exec(input)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    claimed.push([start, end]);
    out.push({
      type: "route",
      source_text: m[0],
      source_range: { start, end },
      normalised_value: { origin_code: m[1], destination_code: m[2] },
      confidence: "medium",
      fuzzy: false,
      range: false,
      granularity: "exact",
      meta: { iata: true },
    });
  }

  REF_TOKEN_RE.lastIndex = 0;
  while ((m = REF_TOKEN_RE.exec(input)) !== null) {
    const ref = m[1];
    if (NOT_A_REF.has(ref)) continue;
    // Must mix letters and digits — pure-alpha (a SHOUTED word) and pure-digit
    // (a year/amount) are not booking refs.
    if (!HAS_LETTER.test(ref) || !HAS_DIGIT.test(ref)) continue;
    const start = m.index;
    const end = start + ref.length;
    if (claimed.some(([cs, ce]) => start < ce && end > cs)) continue;
    out.push({
      type: "booking_ref",
      source_text: ref,
      source_range: { start, end },
      normalised_value: ref,
      confidence: "medium",
      fuzzy: false,
      range: false,
      granularity: "exact",
      meta: { airlinePrefix: /^(BA|EZ|FR|U2|LS|VS|BY|TOM)/.test(ref) },
    });
  }

  return out;
}
