// Pure, DOM-free helpers for the capture screen: human labels, voice-safe value
// formatting, and the correction/dismiss model applied to a ParsedPayload. Kept
// separate so the load-bearing logic is unit-testable without a DOM harness.

import type { ParsedFact, ParsedPayload, Slot } from "@/lib/parser/types";

// localId → slotKey → corrected Slot (user-authoritative; inferred:false, high).
export type Corrections = Record<string, Record<string, Slot>>;

const FACT_TYPE_LABELS: Record<string, string> = {
  train_journey: "Train journey",
  flight_journey: "Flight",
  bus_journey: "Bus journey",
  coach_journey: "Coach journey",
  ferry_journey: "Ferry crossing",
  taxi_journey: "Taxi",
  walking_leg: "Walk",
  driving_leg: "Drive",
  scheduled_event: "Meeting",
  scheduled_call: "Call",
  appointment: "Appointment",
  business_event: "Event",
  meal_plan: "Meal",
  accommodation_booking: "Hotel stay",
  note: "Loose thought",
  task: "To sort",
  intent: "Held thought",
};

export function factTypeLabel(factType: string): string {
  return FACT_TYPE_LABELS[factType] ?? "Note";
}

// Title-case-ish slot label from its key ("departure_time" → "Departure time").
export function slotLabel(key: string): string {
  const s = key.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function formatDateHuman(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

// Voice-safe display of a slot's value. Never asserts anything about the user.
export function formatSlotValue(slot: Slot): string {
  const v = slot.value;
  if (v == null) return "not set";
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return formatDateHuman(v);
    return v;
  }
  if (typeof v === "number") return String(v);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.label === "string") {
      return typeof o.code === "string" ? `${o.label} (${o.code})` : o.label;
    }
    if (typeof o.start === "string" && typeof o.end === "string") {
      return `${formatDateHuman(o.start)} – ${formatDateHuman(o.end)}`;
    }
    if (typeof o.amount === "number") {
      const amt = `£${o.amount.toFixed(2).replace(/\.00$/, "")}`;
      if (o.constraint === "approximate") return `around ${amt}`;
      if (o.constraint === "maximum") return `under ${amt}`;
      if (o.constraint === "minimum") return `over ${amt}`;
      return amt;
    }
    if (typeof o.preference === "string") return String(o.preference);
    if (typeof o.nights === "number") return `${o.nights} night${o.nights === 1 ? "" : "s"}`;
  }
  return String(v);
}

// Drop corrections whose fact no longer exists or whose fact_type changed after a
// re-parse. Returns the surviving corrections + whether anything was dropped.
export function pruneCorrections(
  payload: ParsedPayload,
  corrections: Corrections,
): { corrections: Corrections; dropped: boolean } {
  const typeById = new Map(payload.facts.map((f) => [f.local_id, f.fact_type]));
  const next: Corrections = {};
  let dropped = false;
  const original = corrections; // keyed by the local_id captured at correction time
  for (const [localId, slots] of Object.entries(original)) {
    if (typeById.has(localId)) {
      next[localId] = slots;
    } else {
      dropped = true;
    }
  }
  return { corrections: next, dropped };
}

// Apply corrections (slot overrides) and remove dismissed facts. Returns a new
// payload safe to send to confirmCapture / saveCaptureDraft.
export function applyCorrections(
  payload: ParsedPayload,
  corrections: Corrections,
  dismissed: ReadonlySet<string>,
): ParsedPayload {
  const facts = payload.facts
    .filter((f) => !dismissed.has(f.local_id))
    .map((f): ParsedFact => {
      const fixes = corrections[f.local_id];
      if (!fixes) return f;
      return { ...f, slots: { ...f.slots, ...fixes } };
    });
  return { ...payload, facts };
}

export function includedFacts(
  payload: ParsedPayload,
  dismissed: ReadonlySet<string>,
): ParsedFact[] {
  return payload.facts.filter((f) => !dismissed.has(f.local_id));
}

export const buildConfirmPayload = applyCorrections;
