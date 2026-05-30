// Stage 8 — fact linking. Conservative, typed cross-fact links:
//   destination_of — a travel leg ends at an event's place (infers the leg's
//                    destination from the event when the leg didn't state one)
//   return_of      — "back same evening" / "returning Friday" → a mirrored leg
//   same_day       — facts sharing a date
// Inference is cautious and always marked inferred:true / confidence:medium.

import type { ParsedFact, Slot } from "./types";
import type { PlaceResolver } from "./slots";

const HUB_TRANSIT = new Set([
  "train_journey",
  "flight_journey",
  "bus_journey",
  "coach_journey",
  "ferry_journey",
]);
const EVENT_TYPES = new Set([
  "scheduled_event",
  "appointment",
  "business_event",
  "meal_plan",
  "accommodation_booking",
]);
const RETURN_RE = /\b(back|return|returning|coming back|home again)\b/i;

function placeLabel(slot: Slot | undefined): string | null {
  if (!slot) return null;
  const v = slot.value;
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "label" in v) return String((v as { label: unknown }).label);
  return null;
}

async function hubSlotFrom(
  label: string,
  resolver: PlaceResolver,
  source: Slot | undefined,
): Promise<Slot> {
  const { match } = await resolver.resolveHub(label);
  return {
    value: match ? { hub_id: match.id, label: match.name, code: match.code } : label,
    source_text: source?.source_text ?? label,
    source_range: source?.source_range ?? { start: 0, end: 0 },
    confidence: "medium",
    inferred: true,
  };
}

export async function linkFacts(
  facts: ParsedFact[],
  resolver: PlaceResolver,
): Promise<{ facts: ParsedFact[]; ambiguities: string[] }> {
  const ambiguities: string[] = [];
  const out = facts.map((f) => ({ ...f, slots: { ...f.slots }, links: [...f.links] }));

  // 1. destination_of — link a hub-transit leg to a nearby event; infer destination.
  for (const leg of out) {
    if (!HUB_TRANSIT.has(leg.fact_type)) continue;
    const event = out.find(
      (e) => EVENT_TYPES.has(e.fact_type) && placeLabel(e.slots.place),
    );
    if (!event) continue;
    leg.links.push({ target: event.local_id, kind: "destination_of" });
    if (!leg.slots.destination) {
      const label = placeLabel(event.slots.place)!;
      leg.slots.destination = await hubSlotFrom(label, resolver, event.slots.place);
    }
    // The leg inherits the event's date when it didn't state its own.
    if (!leg.slots.date && event.slots.date) {
      leg.slots.date = { ...event.slots.date, inferred: true, confidence: "medium" };
    }
  }

  // 2. return_of — a "back/return" note becomes a mirrored leg of the last outbound.
  for (let i = 0; i < out.length; i++) {
    const f = out[i];
    if (f.fact_type !== "note") continue;
    if (!RETURN_RE.test(f.slots.label ? String(f.slots.label.value) : f.source_range ? "" : "")) {
      // label may be absent; test the note's verbatim label value
    }
    const labelText = f.slots.label ? String(f.slots.label.value) : "";
    if (!RETURN_RE.test(labelText)) continue;
    const outbound = [...out.slice(0, i)].reverse().find((p) => HUB_TRANSIT.has(p.fact_type));
    if (!outbound) continue;

    const ret: ParsedFact = {
      local_id: f.local_id,
      fact_type: outbound.fact_type,
      slots: {},
      links: [{ target: outbound.local_id, kind: "return_of" }],
      warnings: [],
      confidence: "medium",
      source_range: f.source_range,
    };
    // Swap origin/destination from the outbound (inferred).
    if (outbound.slots.destination) ret.slots.origin = { ...outbound.slots.destination, inferred: true, confidence: "medium" };
    if (outbound.slots.origin) ret.slots.destination = { ...outbound.slots.origin, inferred: true, confidence: "medium" };
    // Carry the return clause's own date/time, else inherit the outbound's date.
    if (f.slots.date) ret.slots.date = f.slots.date;
    else if (outbound.slots.date) ret.slots.date = { ...outbound.slots.date, inferred: true, confidence: "medium" };
    if (f.slots.time) ret.slots.departure_time = f.slots.time;
    out[i] = ret;
  }

  // 3. same_day — facts sharing a resolved date (string form), conservative.
  const dateOf = (f: ParsedFact): string | null => {
    const d = f.slots.date?.value;
    return typeof d === "string" ? d : null;
  };
  for (let a = 0; a < out.length; a++) {
    for (let b = a + 1; b < out.length; b++) {
      const da = dateOf(out[a]);
      const db = dateOf(out[b]);
      if (da && db && da === db) {
        const exists = out[a].links.some((l) => l.target === out[b].local_id);
        if (!exists) {
          out[a].links.push({ target: out[b].local_id, kind: "same_day" });
        }
      }
    }
  }

  return { facts: out, ambiguities };
}
