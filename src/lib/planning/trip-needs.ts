// THIS TRIP NEEDS — gap detection (P4.11).
//
// The needs panel is the engine telling you what's still outstanding before a
// trip is ready: an appointment with no duration set, a proposed-but-unbooked
// taxi, a rail leg with no ticket, an unbooked hotel, a confirmation email you
// said you'd send. Each row is one-tap to the thing that fixes it.
//
// This is the pure derivation: given the itinerary's already-classified state,
// produce the ordered list with a deadline-aware `when` label. The server
// action (`getTripNeeds`) does the queries + classification and injects `now`.
//
// Pure, no IO.

export type TripNeedAction =
  | "set_duration"
  | "book_taxi"
  | "book_rail"
  | "book_hotel"
  | "email_contact"
  | "confirm_booking";

export type TripNeed = {
  action_type: TripNeedAction;
  target_id: string; // stop / booking_intent / intent id the row routes to
  label: string;
  when: string; // deadline indicator: "today", "Wed", "12 Jun"
  deadline: string | null; // ISO, for sorting
};

export type TripNeedsInput = {
  now: string; // ISO
  tripDate: string; // ISO (itinerary.date_start)
  timezone: string;
  appointments: {
    id: string;
    title: string | null;
    durationKind: string | null; // duration_value.kind
  }[];
  taxiIntents: { id: string; status: string; summary: string | null }[];
  railLegs: { id: string; label: string; booked: boolean }[];
  accommodations: { id: string; title: string | null; booked: boolean }[];
  // From the intents table — workspace-level prerequisites ("email Dancing Duck
  // to confirm"). Already filtered to open/in-progress by the caller.
  prerequisiteIntents: {
    id: string;
    label: string;
    surfaceAfter: string | null;
  }[];
};

// Days before the trip each need should be actioned by. set_duration / taxi are
// "as soon as you can"; bookings + emails want a few days' lead.
const LEAD_DAYS: Record<TripNeedAction, number> = {
  set_duration: 0,
  book_taxi: 0,
  book_rail: 1,
  book_hotel: 2,
  email_contact: 2,
  confirm_booking: 1,
};

const DURATION_UNSET = new Set([null, "unset", "fuzzy"]);
const CONTACT_PATTERN =
  /\b(e-?mail|confirm|call|ring|phone|reserve|book a table)\b/i;

export function deriveTripNeeds(input: TripNeedsInput): TripNeed[] {
  const needs: TripNeed[] = [];
  const deadlineFor = (action: TripNeedAction, override?: string | null) =>
    override ?? shiftDays(input.tripDate, -LEAD_DAYS[action]);

  // set_duration — appointments without a firm duration.
  for (const a of input.appointments) {
    if (DURATION_UNSET.has(a.durationKind)) {
      const deadline = deadlineFor("set_duration");
      needs.push({
        action_type: "set_duration",
        target_id: a.id,
        label: a.title ? `Set how long at ${a.title}` : "Set your visit duration",
        when: relativeWhen(deadline, input.now, input.timezone),
        deadline,
      });
    }
  }

  // book_taxi — proposed taxis (anything not yet booked).
  for (const t of input.taxiIntents) {
    if (t.status !== "booked") {
      const deadline = deadlineFor("book_taxi");
      needs.push({
        action_type: "book_taxi",
        target_id: t.id,
        label: t.summary ? `Book taxi — ${t.summary}` : "Book your taxi",
        when: relativeWhen(deadline, input.now, input.timezone),
        deadline,
      });
    }
  }

  // book_rail — rail legs without a booked ticket.
  for (const r of input.railLegs) {
    if (!r.booked) {
      const deadline = deadlineFor("book_rail");
      needs.push({
        action_type: "book_rail",
        target_id: r.id,
        label: `Book ${r.label}`,
        when: relativeWhen(deadline, input.now, input.timezone),
        deadline,
      });
    }
  }

  // book_hotel — accommodation stops without a booking.
  for (const h of input.accommodations) {
    if (!h.booked) {
      const deadline = deadlineFor("book_hotel");
      needs.push({
        action_type: "book_hotel",
        target_id: h.id,
        label: h.title ? `Book ${h.title}` : "Book your hotel",
        when: relativeWhen(deadline, input.now, input.timezone),
        deadline,
      });
    }
  }

  // Prerequisite intents — email/confirm patterns become email_contact, the
  // rest a generic confirm_booking. Deadline from surface_after when present.
  for (const i of input.prerequisiteIntents) {
    const action: TripNeedAction = CONTACT_PATTERN.test(i.label)
      ? "email_contact"
      : "confirm_booking";
    const deadline = deadlineFor(action, i.surfaceAfter);
    needs.push({
      action_type: action,
      target_id: i.id,
      label: i.label,
      when: relativeWhen(deadline, input.now, input.timezone),
      deadline,
    });
  }

  // Most urgent first; nulls last, stable within a deadline.
  return needs.sort((a, b) => {
    const ad = a.deadline ? new Date(a.deadline).getTime() : Infinity;
    const bd = b.deadline ? new Date(b.deadline).getTime() : Infinity;
    return ad - bd;
  });
}

// ── date helpers (tz-aware, DST-naive for v1) ────────────────────────────────

function shiftDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * 86_400_000).toISOString();
}

function dayKey(iso: string, tz: string): string {
  // en-CA gives YYYY-MM-DD, which string-compares chronologically.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function relativeWhen(deadlineIso: string, nowIso: string, tz: string): string {
  const dDay = dayKey(deadlineIso, tz);
  const nDay = dayKey(nowIso, tz);
  if (dDay <= nDay) return "today";
  const diffDays = Math.round(
    (Date.parse(`${dDay}T00:00:00Z`) - Date.parse(`${nDay}T00:00:00Z`)) /
      86_400_000,
  );
  if (diffDays === 1) return "tomorrow";
  if (diffDays <= 6) {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      weekday: "short",
    }).format(new Date(deadlineIso));
  }
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    day: "numeric",
    month: "short",
  }).format(new Date(deadlineIso));
}
