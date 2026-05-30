// Pure, DOM-free helpers for the capture screen: human labels, voice-safe value
// formatting, and the correction/dismiss model applied to a ParsedPayload. Kept
// separate so the load-bearing logic is unit-testable without a DOM harness.

import type { ParsedFact, ParsedPayload, Slot } from "@/lib/parser/types";
import { haversineMeters, formatMiles } from "@/lib/geo";

// Slot dataTypes that name a real-world entity we can bind, badge, and resolve.
const ENTITY_DATA_TYPES = new Set(["hub", "place", "person"]);

export type EntityStatus = "bound" | "ambiguous" | "unknown";

// Returns the entity-binding status of a slot, or null when the slot is not an
// entity slot (dates, times, numbers, free text). Drives badge colour:
//   bound     → value is an object carrying a resolved id (gold)
//   ambiguous → resolution found multiple candidates (grey, opens a chooser)
//   unknown   → a verbatim label with no match yet (grey, opens the editor)
export function slotEntityStatus(slot: Slot | undefined, dataType: string | undefined): EntityStatus | null {
  if (!dataType || !ENTITY_DATA_TYPES.has(dataType)) return null;
  if (!slot) return null;
  const v = slot.value;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (o.hub_id || o.location_id || o.customer_site_id || o.contact_id) return "bound";
  }
  if (slot.ambiguous) return "ambiguous";
  return "unknown";
}

// A {lat,lng} anchor drawn from the first slot value in the fact that carries
// coordinates — used to rank ambiguous candidates / proximity suggestions.
export function factAnchor(fact: ParsedFact): { lat: number; lng: number } | null {
  for (const slot of Object.values(fact.slots)) {
    const v = slot.value;
    if (v && typeof v === "object") {
      const o = v as { latitude?: unknown; longitude?: unknown };
      if (typeof o.latitude === "number" && typeof o.longitude === "number") {
        return { lat: o.latitude, lng: o.longitude };
      }
    }
  }
  return null;
}

// How a recognised span lights up in the in-text overlay. Entity statuses
// (bound/ambiguous/unknown) plus the non-entity tints (dates/times, amounts).
export type HighlightTint = EntityStatus | "temporal" | "amount";

// A recognised span within the input text, used to paint the in-text overlay.
export interface OverlaySpan {
  start: number;
  end: number;
  tint: HighlightTint;
}

export type OverlaySegment =
  | { kind: "text"; text: string }
  | { kind: "mark"; text: string; tint: HighlightTint };

// Split `text` into ordered plain/marked segments from a set of spans. Spans are
// sorted by start; overlapping or out-of-bounds spans are dropped so the segments
// always tile the text exactly once (offset-based — safe for duplicate
// substrings). Pure + tested.
export function buildOverlaySegments(text: string, spans: readonly OverlaySpan[]): OverlaySegment[] {
  const valid = spans
    .filter((s) => s.start >= 0 && s.end <= text.length && s.start < s.end)
    .slice()
    .sort((a, b) => a.start - b.start);

  const segments: OverlaySegment[] = [];
  let cursor = 0;
  for (const span of valid) {
    if (span.start < cursor) continue; // overlaps an earlier span — skip
    if (span.start > cursor) segments.push({ kind: "text", text: text.slice(cursor, span.start) });
    segments.push({ kind: "mark", text: text.slice(span.start, span.end), tint: span.tint });
    cursor = span.end;
  }
  if (cursor < text.length) segments.push({ kind: "text", text: text.slice(cursor) });
  return segments;
}

// The overlay tint for a slot, or null if the slot shouldn't be highlighted.
// Entity slots carry their binding status; date/time → temporal; money/number/
// duration → amount.
export function slotHighlightTint(slot: Slot | undefined, dataType: string | undefined): HighlightTint | null {
  const entity = slotEntityStatus(slot, dataType);
  if (entity) return entity;
  if (!slot || !dataType) return null;
  if (dataType === "date" || dataType === "time") return "temporal";
  if (dataType === "money" || dataType === "number" || dataType === "duration" || dataType === "party_size") return "amount";
  return null;
}

// A candidate place/hub, optionally carrying coords + a derived distance label.
export interface RankedCandidate {
  id: string;
  name: string;
  code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distanceLabel?: string;
}

// Sort candidates nearest-first to an anchor (when both have coords), attaching
// a human miles label. Without an anchor, order is preserved. Pure + tested.
export function sortCandidatesByProximity(
  candidates: readonly unknown[],
  anchor: { lat: number; lng: number } | null,
): RankedCandidate[] {
  const rows = candidates.map((c) => {
    const o = (c ?? {}) as Record<string, unknown>;
    return {
      id: String(o.id ?? ""),
      name: String(o.name ?? o.label ?? ""),
      code: (o.code as string | null | undefined) ?? null,
      latitude: typeof o.latitude === "number" ? o.latitude : null,
      longitude: typeof o.longitude === "number" ? o.longitude : null,
    };
  });
  if (!anchor) return rows;
  return rows
    .map((r, i) => {
      const d =
        r.latitude != null && r.longitude != null
          ? haversineMeters(anchor.lat, anchor.lng, r.latitude, r.longitude)
          : Number.POSITIVE_INFINITY;
      return { r, d, i };
    })
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .map((x) => (Number.isFinite(x.d) ? { ...x.r, distanceLabel: formatMiles(x.d) } : x.r));
}

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
