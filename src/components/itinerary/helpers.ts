// Pure helpers + shared constants for itinerary surfaces. No React,
// no DOM, no module-level state — safe to import from any context.

import type { PlaceSelection } from "@/components/place-picker";
import type { TransportName } from "@/components/icons";
import type {
  Anchor,
  AnchorKind,
  AnchorRole,
  BriefTransition,
  LocalMode,
  RoleOption,
  Stopover,
  TimingMode,
  TransitionMode,
} from "./types";

// ─────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────

export const ROLES: Record<AnchorKind, RoleOption[]> = {
  appointment: [],
  stay: [
    { value: "check_in", label: "Check in" },
    { value: "return_to_room", label: "Return to room" },
  ],
  meal: [
    { value: "breakfast", label: "Breakfast" },
    { value: "lunch", label: "Lunch" },
    { value: "dinner", label: "Dinner" },
    { value: "drinks", label: "Drinks" },
  ],
  event: [
    { value: "session", label: "Session" },
    { value: "show", label: "Show" },
    { value: "concert", label: "Concert" },
  ],
  station: [
    { value: "train", label: "Train" },
    { value: "flight", label: "Flight" },
    { value: "bus", label: "Bus" },
  ],
};

export const KIND_OPTIONS: Array<{ value: AnchorKind; label: string }> = [
  { value: "appointment", label: "Appointment" },
  { value: "stay", label: "Stay" },
  { value: "meal", label: "Meal" },
  { value: "event", label: "Event" },
  { value: "station", label: "Station" },
];

export const TRANSITION_OPTIONS: Array<{
  value: TransitionMode;
  label: string;
  icon: TransportName;
  // True when the mode is fundamentally station-/airport-based — the
  // user has to get to and from a terminal at each end, so we ask for
  // the local connection mode.
  stationBased?: boolean;
}> = [
  { value: "auto", label: "Auto", icon: "auto" },
  { value: "walk", label: "Walk", icon: "walk" },
  { value: "drive", label: "Drive", icon: "drive" },
  { value: "train", label: "Train", icon: "train", stationBased: true },
  { value: "tube", label: "Tube", icon: "tube", stationBased: true },
  { value: "bus", label: "Bus", icon: "bus", stationBased: true },
  { value: "taxi", label: "Taxi", icon: "taxi" },
  { value: "flight", label: "Flight", icon: "flight", stationBased: true },
];

// Local connection modes — the legs at each end of a station-based
// trip ("to the station" / "from the station"). Keep "auto" so the
// user can defer to Khonsera.
export const LOCAL_MODES: Array<{
  value: LocalMode;
  label: string;
  icon: TransportName;
}> = [
  { value: "auto", label: "Auto", icon: "auto" },
  { value: "walk", label: "Walk", icon: "walk" },
  { value: "drive", label: "Drive", icon: "drive" },
  { value: "taxi", label: "Taxi", icon: "taxi" },
];

export const APPT_DURATIONS = [
  { label: "30m", mins: 30 },
  { label: "1h", mins: 60 },
  { label: "2h", mins: 120 },
  { label: "Half-day", mins: 240 },
  { label: "Full day", mins: 480 },
];

// Same preset chips the AppointmentTimes block uses, minus
// half/full-day — a stopover that lasts half a day is really a Meal
// or Appointment anchor.
export const STOPOVER_DURATIONS = [
  { label: "15m", mins: 15 },
  { label: "30m", mins: 30 },
  { label: "1h", mins: 60 },
  { label: "2h", mins: 120 },
];

// Time presets — hourly across the working day plus a handful of common
// shoulder-time slots. The pill row scrolls horizontally on mobile so
// the full set is one swipe away; the explicit time input always wins
// for unusual values.
export const TIME_PRESETS = [
  "06:00",
  "07:00",
  "07:30",
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "17:30",
  "18:00",
  "18:30",
  "19:00",
  "19:30",
  "20:00",
  "21:00",
  "22:00",
];

// Sentinel client_id for the implicit "home" anchor. The server doesn't
// see this as an anchor — it's already auto-seeded from the travel
// profile — but we use it client-side to key the transition between
// home and the first user-entered anchor.
export const HOME_UID = "__khonsera_home__";

// ─────────────────────────────────────────────────────────────────────
// Empty-state factories
// ─────────────────────────────────────────────────────────────────────

export function emptyStopover(): Stopover {
  return { place: null, durationMins: 30 };
}

export function emptyTransition(): BriefTransition {
  return {
    mode: "auto",
    localBefore: "auto",
    localAfter: "auto",
    booked: false,
    booking: {
      provider: "",
      reference: "",
      serviceNumber: "",
      departTime: "",
      arriveTime: "",
      seat: "",
      price: "",
    },
    transportBooking: null,
  };
}

export function emptyAnchor(date: string): Anchor {
  return {
    uid: cryptoUid(),
    place: null,
    kindOverride: null,
    roleOverride: null,
    date,
    time: "09:00",
    timingMode: "arrive_by",
    timingModeOverride: false,
    durationMins: 60,
    checkOutDate: nextDay(date),
    checkOutTime: "11:00",
    notes: null,
    accommodation: null,
  };
}

export function cryptoUid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `a_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

// ─────────────────────────────────────────────────────────────────────
// Map keys + synthetic ids
// ─────────────────────────────────────────────────────────────────────

export const transitionKey = (fromUid: string, toUid: string) =>
  `${fromUid}::${toUid}`;

// Synthesise a stable uid for a stopover so the transitions Map can
// carry the two split-leg entries alongside anchor-pair entries. The
// uid encodes the parent pair, which means it follows the stopover if
// the surrounding anchors get reordered (and gets dropped naturally
// if either anchor disappears).
export const stopoverUid = (fromUid: string, toUid: string) =>
  `sv::${fromUid}::${toUid}`;

// Synthetic Anchor used purely so TransitionRow / BookedFields can
// pull place.label for hints. Most Anchor fields are unused in that
// context — we fill them with safe defaults.
export function stopoverAsAnchor(sv: Stopover, uid: string): Anchor {
  return {
    uid,
    place: sv.place,
    kindOverride: null,
    roleOverride: null,
    date: "",
    time: "",
    timingMode: "around_then",
    timingModeOverride: false,
    durationMins: sv.durationMins,
    checkOutDate: "",
    checkOutTime: "",
    notes: null,
    accommodation: null,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Inference / effective-value helpers
// ─────────────────────────────────────────────────────────────────────

export function effectiveKind(a: Anchor): AnchorKind {
  return a.kindOverride ?? inferredKind(a);
}

export function effectiveRole(a: Anchor, earlier: Anchor[]): AnchorRole {
  if (a.roleOverride != null) return a.roleOverride;
  return inferredRoleFor(a, earlier);
}

// Timing mode the user is using right now. If they haven't explicitly
// picked one, we infer from the kind + role:
//   • Stay / return-to-room → around_then (they want Khonsera to fit it)
//   • Station                → leave_by   (the "catch by" time IS departure)
//   • Everything else        → arrive_by
export function effectiveTimingMode(a: Anchor): TimingMode {
  if (a.timingModeOverride) return a.timingMode;
  return inferredTimingMode(a);
}

// Earliest time the executive can leave this anchor for the next
// leg. For around_then anchors there's no fixed time so we return
// null — the feasibility check treats that as "stay quiet". For a
// stay+check_in we also return null because the hotel is open-ended
// (they can leave for the next thing whenever it makes sense).
//
// Both date and time strings come straight from the Anchor as the
// user typed them. We parse as local; callers compare the result to
// another Date computed the same way, so local-vs-UTC offsets cancel.
export function anchorEndDate(a: Anchor): Date | null {
  if (effectiveTimingMode(a) === "around_then") return null;
  const kind = effectiveKind(a);
  const role = effectiveRole(a, []);
  if (kind === "stay" && (role ?? "check_in") === "check_in") return null;
  if (!a.date || !a.time) return null;
  const base = new Date(`${a.date}T${a.time}`);
  if (Number.isNaN(base.getTime())) return null;
  if (effectiveTimingMode(a) === "arrive_by") {
    return new Date(base.getTime() + (a.durationMins ?? 0) * 60_000);
  }
  return base;
}

// Latest time the executive needs to start being at this anchor —
// when the leg INTO it must complete. For a leave_by anchor (the
// "catch the 09:42 train" pattern), the executive needs to be there
// duration before the time. For arrive_by, the time itself is the
// deadline.
export function anchorStartDate(a: Anchor): Date | null {
  if (effectiveTimingMode(a) === "around_then") return null;
  if (!a.date || !a.time) return null;
  const base = new Date(`${a.date}T${a.time}`);
  if (Number.isNaN(base.getTime())) return null;
  if (effectiveTimingMode(a) === "leave_by") {
    return new Date(base.getTime() - (a.durationMins ?? 0) * 60_000);
  }
  return base;
}

function inferredTimingMode(a: Anchor): TimingMode {
  const kind = effectiveKind(a);
  const role = a.roleOverride;
  if (kind === "stay" && role === "return_to_room") return "around_then";
  if (kind === "station") return "leave_by";
  return "arrive_by";
}

function inferredKind(a: Anchor): AnchorKind {
  if (!a.place) return "appointment";
  if (a.place.kind !== "location") return "appointment";
  switch (a.place.location_type) {
    case "hotel":
      return "stay";
    case "station":
      return "station";
    default:
      return "appointment";
  }
}

function inferredRoleFor(a: Anchor, earlier: Anchor[]): AnchorRole {
  const k = effectiveKind(a);
  if (k === "appointment") return null;
  if (k === "stay") {
    const priorStay = earlier.find(
      (other) =>
        other.place &&
        a.place &&
        samePlace(other.place, a.place) &&
        effectiveKind(other) === "stay" &&
        (other.roleOverride ?? "check_in") === "check_in" &&
        anchorWithinStay(a, other),
    );
    return priorStay ? "return_to_room" : "check_in";
  }
  if (k === "meal") {
    const hour = parseInt(a.time.split(":")[0] ?? "12", 10);
    if (hour < 11) return "breakfast";
    if (hour < 16) return "lunch";
    if (hour < 21) return "dinner";
    return "drinks";
  }
  if (k === "event") return "session";
  if (k === "station") return "train";
  return null;
}

export function samePlace(a: PlaceSelection, b: PlaceSelection): boolean {
  if (a.kind === "location" && b.kind === "location") {
    return a.location_id === b.location_id;
  }
  if (a.kind === "customer_site" && b.kind === "customer_site") {
    return a.customer_site_id === b.customer_site_id;
  }
  if (a.kind === "customer" && b.kind === "customer") {
    return a.customer_id === b.customer_id;
  }
  return false;
}

export function anchorWithinStay(anchor: Anchor, stay: Anchor): boolean {
  // Returns true if anchor's start is between stay's check-in
  // (date+time) and stay's check-out (date+time, with sensible
  // defaults).
  const start = `${anchor.date}T${anchor.time}`;
  const ci = `${stay.date}T${stay.time}`;
  const coDate = stay.checkOutDate || nextDay(stay.date);
  const coTime = stay.checkOutTime || "11:00";
  const co = `${coDate}T${coTime}`;
  return start >= ci && start <= co;
}

export function labelForKind(k: AnchorKind): string {
  switch (k) {
    case "stay":
      return "Stay";
    case "meal":
      return "Meal";
    case "event":
      return "Event";
    case "station":
      return "Station";
    default:
      return "Appointment";
  }
}

export function labelForRole(kind: AnchorKind, value: string): string {
  return ROLES[kind].find((r) => r.value === value)?.label ?? value;
}

// ─────────────────────────────────────────────────────────────────────
// Anchor sort + date helpers
// ─────────────────────────────────────────────────────────────────────

// Anchors are sorted chronologically by check-in date+time. Two
// exceptions:
//   * around_then anchors have no fixed time — sorting them by
//     date+00:00 would always shove them above their daytime siblings.
//     Instead we give them the date+time of the nearest dated anchor
//     that comes before them in their *original* insertion order, with
//     a tiebreaker suffix so they sort immediately after that anchor.
//     This keeps the user's intended position when they say "fit this
//     between A and C".
//   * Anchors without any date sort to the end (newly-added blanks).
// Original insertion index is also used as a tiebreaker so the sort is
// stable for anchors sharing the same date+time.
export function sortAnchorsByTime(anchors: Anchor[]): Anchor[] {
  const idxPad = (i: number) => String(i).padStart(4, "0");
  const keyed = anchors.map((a, i) => {
    if (a.timingMode === "around_then") {
      let prev = i - 1;
      while (prev >= 0 && anchors[prev].timingMode === "around_then") prev--;
      const anchor = prev >= 0 ? anchors[prev] : null;
      const base = anchor?.date
        ? `${anchor.date} ${anchor.time || "00:00"}`
        : "￿";
      return { a, key: `${base}.${idxPad(i)}` };
    }
    const base = a.date ? `${a.date} ${a.time || "00:00"}` : "￿";
    return { a, key: `${base}.${idxPad(i)}` };
  });
  keyed.sort((x, y) => x.key.localeCompare(y.key));
  return keyed.map(({ a }) => a);
}

export function nextDay(iso: string): string {
  if (!iso) return iso;
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function defaultAnchorDate(): string {
  const now = new Date();
  const target = new Date(now);
  if (now.getHours() >= 19) {
    target.setDate(target.getDate() + 2);
  } else {
    target.setDate(target.getDate() + 1);
  }
  return target.toISOString().slice(0, 10);
}

export function buildDatePresets(timezone: string) {
  const now = new Date();
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "numeric",
      timeZone: timezone,
    }).format(d);
  const value = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: timezone,
    }).format(d);

  const today = new Date(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(today.getDate() + 1);
  const out: Array<{ label: string; value: string }> = [
    { label: "Today", value: value(today) },
    { label: "Tomorrow", value: value(tomorrow) },
  ];
  // Two weeks of day chips. The pill row scrolls horizontally on
  // mobile so the long tail is one swipe away. The date input itself
  // is always the fallback for further-out trips.
  for (let i = 2; i <= 14; i++) {
    const d = new Date(now);
    d.setDate(today.getDate() + i);
    out.push({ label: fmt(d), value: value(d) });
  }
  return out;
}

export function fmtShortDate(iso: string, timezone: string): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: timezone,
  }).format(new Date(`${iso}T12:00:00Z`));
}

// Build an ISO timestamp from a local date + time in a named timezone.
// Mirrors createItineraryFromBrief's server-side helper of the same
// shape — kept here so the editor can construct identical timestamps
// when patching a stop inline.
export function isoFromLocal(
  date: string,
  time: string,
  timezone: string,
): string {
  const asUtc = new Date(`${date}T${time}:00.000Z`);
  const tzString = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(asUtc);
  const [tzHour, tzMin] = tzString.split(":").map((p) => parseInt(p, 10));
  const utcHour = asUtc.getUTCHours();
  const utcMin = asUtc.getUTCMinutes();
  const offsetMins = (tzHour - utcHour) * 60 + (tzMin - utcMin);
  return new Date(asUtc.getTime() - offsetMins * 60_000).toISOString();
}

export function addMinutesIso(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

export function fmtDur(m: number): string {
  if (m >= 480) return "Full day";
  if (m >= 240) return "Half-day";
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h === 0) return `${min}m`;
  if (min === 0) return `${h}h`;
  return `${h}h ${min}m`;
}
