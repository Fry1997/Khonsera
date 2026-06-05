// Stage 9 — validation. Per-fact and cross-fact rules surface as warnings on the
// relevant fact (never blocking — the user decides, brief §12).

import type { ParsedFact } from "./types";

function timeValue(f: ParsedFact, key: string): string | null {
  const v = f.slots[key]?.value;
  return typeof v === "string" && /^\d{2}:\d{2}$/.test(v) ? v : null;
}

export function validateFacts(facts: ParsedFact[]): {
  facts: ParsedFact[];
  inputWarnings: string[];
} {
  const inputWarnings: string[] = [];
  const out = facts.map((f) => ({ ...f, warnings: [...f.warnings] }));

  for (const f of out) {
    const dep = timeValue(f, "departure_time");
    const arr = timeValue(f, "arrival_time");
    if (dep && arr && dep >= arr) {
      f.warnings.push("Departure is not before arrival — please check the times.");
    }

    const origin = f.slots.origin?.value;
    const destination = f.slots.destination?.value;
    if (
      origin &&
      destination &&
      JSON.stringify(origin) === JSON.stringify(destination)
    ) {
      f.warnings.push("Origin and destination look the same.");
    }

    const ci = f.slots.check_in_date?.value;
    const co = f.slots.check_out_date?.value;
    if (typeof ci === "string" && typeof co === "string" && ci > co) {
      f.warnings.push("Check-in is after check-out — please check the dates.");
    }
  }

  // Cross-fact: two scheduled events at the same date + time.
  const scheduled = out.filter(
    (f) => f.fact_type === "scheduled_event" || f.fact_type === "appointment",
  );
  for (let a = 0; a < scheduled.length; a++) {
    for (let b = a + 1; b < scheduled.length; b++) {
      const da = scheduled[a].slots.date?.value;
      const db = scheduled[b].slots.date?.value;
      const ta = scheduled[a].slots.time?.value;
      const tb = scheduled[b].slots.time?.value;
      if (da && da === db && ta && ta === tb) {
        scheduled[a].warnings.push("Another event is at the same time on this day.");
      }
    }
  }

  return { facts: out, inputWarnings };
}
