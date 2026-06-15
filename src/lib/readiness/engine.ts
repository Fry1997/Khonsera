import type { DaySummary, ReadinessCheck } from "./types";

// Pure readiness engine: build a summary of the day-object, then evaluate the
// check registry against it. No I/O — testable in isolation (mirrors today/engine).

// Rough UK bounding box — a coord outside it on any stop signals an international
// day (we don't yet model destination country; this is the day-one heuristic).
const UK = { latMin: 49.8, latMax: 60.9, lngMin: -8.7, lngMax: 1.9 };
function outsideUK(lat?: number | null, lng?: number | null): boolean {
  if (lat == null || lng == null || (lat === 0 && lng === 0)) return false;
  return lat < UK.latMin || lat > UK.latMax || lng < UK.lngMin || lng > UK.lngMax;
}

const TICKETED_MODES = new Set(["train", "flight", "bus", "tube", "coach", "ferry", "tram"]);

export type StopForReadiness = {
  id: string;
  type: string;
  start_time: string | null;
  end_time: string | null;
  title: string | null;
  lat?: number | null;
  lng?: number | null;
};

export type TransitionForReadiness = {
  from_stop_id: string;
  to_stop_id: string;
  mode: string;
  is_locked: boolean | null;
};

function datesBetween(startIso: string, endIso: string): string[] {
  // Each night from the start date up to (but not including) the end date.
  const out: string[] = [];
  const d = new Date(`${startIso}T12:00:00`);
  const end = new Date(`${endIso}T12:00:00`);
  while (d < end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export function buildDaySummary(args: {
  dateStart: string;
  dateEnd: string;
  stops: StopForReadiness[];
  transitions: TransitionForReadiness[];
}): DaySummary {
  const { dateStart, dateEnd, stops, transitions } = args;
  const titleOf = new Map(stops.map((s) => [s.id, s.title ?? "a stop"]));

  const isMultiDay = dateStart !== dateEnd;

  // Nights that an accommodation stop covers (its check-in..check-out window).
  const coveredNights = new Set<string>();
  for (const s of stops) {
    if (s.type !== "accommodation" || !s.start_time) continue;
    const ci = s.start_time.slice(0, 10);
    const co = (s.end_time ?? s.start_time).slice(0, 10);
    for (const n of datesBetween(ci, co)) coveredNights.add(n);
  }
  const uncoveredNights = isMultiDay
    ? datesBetween(dateStart, dateEnd).filter((n) => !coveredNights.has(n))
    : [];

  const unbookedTransitLegs = transitions
    .filter((t) => TICKETED_MODES.has(t.mode) && !t.is_locked)
    .map((t) => ({
      key: `${t.from_stop_id}->${t.to_stop_id}`,
      from: titleOf.get(t.from_stop_id) ?? "here",
      to: titleOf.get(t.to_stop_id) ?? "next",
    }));

  const hasFlight =
    stops.some((s) => s.type.includes("flight")) || transitions.some((t) => t.mode === "flight");
  const isInternational = stops.some((s) => outsideUK(s.lat, s.lng));
  const hasDrive = transitions.some((t) => t.mode === "drive");

  return { isMultiDay, uncoveredNights, unbookedTransitLegs, hasFlight, isInternational, hasDrive };
}

const IATA_TRAVEL_CENTRE = "https://www.iatatravelcentre.com/";

/** Evaluate the check registry against the day. Returns only the checks that apply. */
export function evaluateReadiness(s: DaySummary): ReadinessCheck[] {
  const checks: ReadinessCheck[] = [];

  // Tickets — every public-transport leg with no booking yet.
  for (const leg of s.unbookedTransitLegs) {
    checks.push({
      key: `ticket:${leg.key}`,
      category: "tickets",
      label: `No ticket yet: ${leg.from} → ${leg.to}`,
      severity: "warn",
      action: { kind: "book" },
    });
  }

  // Bookings — a night with nowhere to stay.
  for (const night of s.uncoveredNights) {
    const label = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${night}T12:00:00`));
    checks.push({
      key: `hotel:${night}`,
      category: "bookings",
      label: `Nowhere to stay the night of ${label}`,
      severity: "warn",
      action: { kind: "book" },
    });
  }

  // Devices — you'll rely on the phone for tickets + nav.
  checks.push({
    key: "power:charge",
    category: "devices",
    label: "Charge your phone — it carries your tickets and navigation",
    severity: "info",
    action: { kind: "none" },
  });

  // Flight — ID/passport for the gate.
  if (s.hasFlight) {
    checks.push({
      key: "doc:flight-id",
      category: "documents",
      label: "Photo ID / passport for the flight",
      severity: "advise",
      action: { kind: "none" },
    });
  }

  // International — passport validity, money, data, time.
  if (s.isInternational) {
    checks.push({
      key: "doc:passport",
      category: "documents",
      label: "Check your passport is in date for the trip",
      detail: "Many countries need 3–6 months' validity beyond your return.",
      severity: "warn",
      action: { kind: "link", href: IATA_TRAVEL_CENTRE, label: "Check entry requirements" },
    });
    checks.push({ key: "intl:esim", category: "international", label: "Sort data before you land", severity: "advise", action: { kind: "task", title: "Sort an eSIM for the trip" } });
    checks.push({ key: "intl:currency", category: "international", label: "Set up your home-currency view", severity: "info", action: { kind: "link", href: "/settings", label: "Set home currency" } });
    checks.push({ key: "intl:adapter", category: "devices", label: "Pack a power adapter", severity: "advise", action: { kind: "none" } });
  }

  // Multi-day — the trip's shape.
  if (s.isMultiDay) {
    checks.push({ key: "trip:pack", category: "multiday", label: "Pack for the trip's shape — nights, weather, occasions", severity: "info", action: { kind: "none" } });
  }

  // Driving — parking at the far end.
  if (s.hasDrive) {
    checks.push({ key: "drive:parking", category: "bookings", label: "Parking sorted at the destination?", severity: "advise", action: { kind: "book" } });
  }

  return checks;
}
