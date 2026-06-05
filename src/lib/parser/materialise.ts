// Materialisation mapping (brief §16). Pure: turns a confirmed ParsedPayload into
// the existing briefSchema input (so confirmCapture can reuse createItineraryFromBrief
// for stop/transition/booking creation + the solver) plus a list of intent drafts.
//
// The load-bearing discipline: a travel fact becomes a travel_booking ONLY when
// the input indicates a real booking (factIsBooked); otherwise it's planned travel
// — a transition (or a transport_booking is NOT created). The booking layer stays
// clean.

import type { ParsedFact, ParsedPayload, Slot } from "./types";

// Indicators that a travel fact is genuinely booked.
const BOOKING_RE = /\b(booked|confirmation|confirmed|e-?ticket|tickets?|trainline|pnr|booking ref|reference|ref)\b/i;

type AnchorKind = "appointment" | "stay" | "meal" | "event" | "station";
type TransportMode = "train" | "flight" | "taxi" | "bus" | "tube" | "drive";

export interface IntentDraft {
  label: string;
  surface_after: string | null;
}

// A subset of the briefSchema input we know how to build (the rest defaults).
export interface BriefDraft {
  anchors: Array<{
    client_id: string;
    kind: AnchorKind;
    date: string;
    timing_mode: "arrive_by" | "around_then";
    time: string | null;
    location_id?: string | null;
    customer_site_id?: string | null;
    contact_id?: string | null;
    label?: string | null;
    check_out_date?: string | null;
    check_out_time?: string | null;
  }>;
  transitions: Array<{
    from_client_id: string;
    to_client_id: string;
    mode: "train" | "flight" | "taxi" | "bus" | "tube" | "drive" | "walk";
  }>;
  transport_bookings: Array<{
    mode: TransportMode;
    date: string | null;
    departure_hub_id?: string | null;
    departure_label?: string | null;
    destination_hub_id?: string | null;
    destination_label?: string | null;
    depart_time?: string | null;
    arrive_time?: string | null;
    reference?: string | null;
    seat?: string | null;
    price?: number | null;
  }>;
  accommodation_bookings: Array<{
    hotel_location_id?: string | null;
    hotel_label?: string | null;
    check_in_date: string | null;
    check_out_date: string | null;
    reference?: string | null;
    price?: number | null;
  }>;
}

export interface MaterialisationPlan {
  brief: BriefDraft;
  intents: IntentDraft[];
}

const HUB_TRANSIT = new Set([
  "train_journey",
  "flight_journey",
  "bus_journey",
  "coach_journey",
  "ferry_journey",
]);
const LOCAL_TRANSIT = new Set(["taxi_journey", "walking_leg", "driving_leg"]);
const EVENT_ANCHORS: Record<string, AnchorKind> = {
  scheduled_event: "appointment",
  appointment: "appointment",
  scheduled_call: "appointment",
  business_event: "event",
  meal_plan: "meal",
};

function str(slot: Slot | undefined): string | null {
  if (!slot) return null;
  return typeof slot.value === "string" ? slot.value : null;
}
function num(slot: Slot | undefined): number | null {
  if (!slot) return null;
  const v = slot.value as { amount?: number } | number | null;
  if (typeof v === "number") return v;
  if (v && typeof v === "object" && typeof v.amount === "number") return v.amount;
  return null;
}
function dateOf(slot: Slot | undefined): string | null {
  if (!slot) return null;
  const v = slot.value;
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "start" in v) return String((v as { start: string }).start);
  return null;
}
function timeOf(slot: Slot | undefined): string | null {
  const v = slot?.value;
  if (typeof v === "string" && /^\d{2}:\d{2}$/.test(v)) return v;
  return null;
}
function hubId(slot: Slot | undefined): string | null {
  const v = slot?.value as { hub_id?: string } | undefined;
  return v?.hub_id ?? null;
}
function locationId(slot: Slot | undefined): string | null {
  const v = slot?.value as { location_id?: string } | undefined;
  return v?.location_id ?? null;
}
function contactId(slot: Slot | undefined): string | null {
  const v = slot?.value as { contact_id?: string } | undefined;
  return v?.contact_id ?? null;
}
function placeLabel(slot: Slot | undefined): string | null {
  if (!slot) return null;
  const v = slot.value;
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "label" in v) return String((v as { label: unknown }).label);
  return null;
}

const TRANSPORT_BOOKING_MODE: Record<string, TransportMode | null> = {
  train_journey: "train",
  flight_journey: "flight",
  bus_journey: "bus",
  coach_journey: "bus",
  ferry_journey: null, // no enum slot — stays a planned transition
  taxi_journey: "taxi",
  walking_leg: null,
  driving_leg: "drive",
};
const TRANSITION_MODE: Record<string, BriefDraft["transitions"][number]["mode"]> = {
  train_journey: "train",
  flight_journey: "flight",
  bus_journey: "bus",
  coach_journey: "bus",
  ferry_journey: "bus",
  taxi_journey: "taxi",
  walking_leg: "walk",
  driving_leg: "drive",
};

export function factIsBooked(fact: ParsedFact, originalText: string): boolean {
  if (fact.slots.booking_ref?.value || fact.slots.ticket?.value) return true;
  const clause = originalText.slice(fact.source_range.start, fact.source_range.end);
  return BOOKING_RE.test(clause);
}

export function factsToBrief(payload: ParsedPayload): MaterialisationPlan {
  const brief: BriefDraft = {
    anchors: [],
    transitions: [],
    transport_bookings: [],
    accommodation_bookings: [],
  };
  const intents: IntentDraft[] = [];
  let n = 0;
  const nextId = () => `a${++n}`;

  for (const fact of payload.facts) {
    const ft = fact.fact_type;

    if (EVENT_ANCHORS[ft]) {
      const date = dateOf(fact.slots.date);
      const time = timeOf(fact.slots.time) ?? timeOf(fact.slots.time_or_period);
      if (!date) continue; // can't place an undated event on a day
      brief.anchors.push({
        client_id: nextId(),
        kind: EVENT_ANCHORS[ft],
        date,
        timing_mode: time ? "arrive_by" : "around_then",
        time,
        location_id: locationId(fact.slots.place),
        contact_id: contactId(fact.slots.contact),
        label: placeLabel(fact.slots.place),
      });
      continue;
    }

    if (ft === "accommodation_booking") {
      brief.accommodation_bookings.push({
        hotel_location_id: locationId(fact.slots.place),
        hotel_label: placeLabel(fact.slots.place),
        check_in_date: dateOf(fact.slots.check_in_date),
        check_out_date: dateOf(fact.slots.check_out_date),
        reference: str(fact.slots.booking_ref),
        price: num(fact.slots.price),
      });
      continue;
    }

    if (HUB_TRANSIT.has(ft) || LOCAL_TRANSIT.has(ft)) {
      const booked = factIsBooked(fact, payload.original_text);
      const bookingMode = TRANSPORT_BOOKING_MODE[ft];
      if (booked && bookingMode) {
        brief.transport_bookings.push({
          mode: bookingMode,
          date: dateOf(fact.slots.date),
          departure_hub_id: hubId(fact.slots.origin),
          departure_label: placeLabel(fact.slots.origin),
          destination_hub_id: hubId(fact.slots.destination),
          destination_label: placeLabel(fact.slots.destination),
          depart_time: timeOf(fact.slots.departure_time),
          arrive_time: timeOf(fact.slots.arrival_time),
          reference: str(fact.slots.booking_ref),
          seat: str(fact.slots.seat),
          price: num(fact.slots.price),
        });
        continue;
      }
      // Unbooked → planned travel: a station anchor at each end + a transition.
      const date = dateOf(fact.slots.date);
      const originLabel = placeLabel(fact.slots.origin);
      const destLabel = placeLabel(fact.slots.destination);
      if (date && (originLabel || destLabel)) {
        const from = nextId();
        const to = nextId();
        brief.anchors.push({
          client_id: from,
          kind: "station",
          date,
          timing_mode: "around_then",
          time: null,
          location_id: locationId(fact.slots.origin),
          label: originLabel ?? "Origin",
        });
        brief.anchors.push({
          client_id: to,
          kind: "station",
          date,
          timing_mode: "around_then",
          time: null,
          location_id: locationId(fact.slots.destination),
          label: destLabel ?? "Destination",
        });
        brief.transitions.push({ from_client_id: from, to_client_id: to, mode: TRANSITION_MODE[ft] });
      }
      continue;
    }

    if (ft === "intent" || ft === "task") {
      intents.push({
        label: str(fact.slots.label) ?? payload.original_text,
        surface_after: dateOf(fact.slots.surface_after),
      });
      continue;
    }

    // note (dated or otherwise) → a light "other" anchor when dated, else an intent.
    if (ft === "note") {
      const date = dateOf(fact.slots.date);
      if (date) {
        brief.anchors.push({
          client_id: nextId(),
          kind: "event",
          date,
          timing_mode: "around_then",
          time: null,
          label: str(fact.slots.label) ?? "Note",
        });
      } else {
        intents.push({ label: str(fact.slots.label) ?? payload.original_text, surface_after: null });
      }
    }
  }

  return { brief, intents };
}
