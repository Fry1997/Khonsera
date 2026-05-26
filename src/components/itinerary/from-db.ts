// DB row → shared client types. The editor surface loads stops,
// transitions and stopovers from Postgres and needs to render them
// using the same AnchorCard / TransitionRow / StopoverCard the brief
// uses. This module is the translation layer.
//
// Inverse direction (client patch → server action) lives next to the
// editor's mutation handlers — those are per-action signatures, not
// a generic shape mapping like this one.

import type { PlaceSelection } from "@/components/place-picker";
import type { LocationType } from "@/lib/types/domain";
import type {
  Anchor,
  AnchorKind,
  AnchorRole,
  BriefTransition,
  LocalMode,
  Stopover,
  TimingMode,
  TransitionMode,
} from "./types";
import { emptyTransition, transitionKey } from "./helpers";

// What the editor page loads. Kept loose because the DB schema may
// grow new columns and we don't want this mapper to need updates for
// fields it doesn't read.

export type DbStop = {
  id: string;
  sequence: number;
  type: string;
  title: string | null;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  is_time_fixed: boolean;
  location_id: string | null;
  customer_id: string | null;
  customer_site_id: string | null;
  notes: string | null;
  location?: {
    name?: string | null;
    type?: string | null;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  customer?: { name?: string | null } | null;
  customer_site?: {
    name?: string | null;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  metadata: Record<string, unknown> | null;
};

export type DbTransition = {
  id: string;
  from_stop_id: string;
  to_stop_id: string;
  mode: string | null;
  is_locked: boolean;
  // Optional because the existing editor's TransitionRow type
  // doesn't pick up notes — we only read the khonsera:local_* marker
  // from it when present, and the absence is harmless.
  notes?: string | null;
  computed_duration_minutes: number | null;
  distance_miles: number | null;
};

export type DbStopover = {
  id: string;
  from_stop_id: string;
  to_stop_id: string;
  location_id: string | null;
  customer_id: string | null;
  customer_site_id: string | null;
  title: string | null;
  duration_minutes: number;
};

// Stops are wired to AnchorKind via metadata.kind when present, with
// the type column as a fallback. The "start" type is the implicit
// home — surfaced separately, not as an anchor.
function kindFromStop(stop: DbStop): AnchorKind {
  const fromMeta = (stop.metadata?.kind as AnchorKind | undefined) ?? null;
  if (fromMeta) return fromMeta;
  switch (stop.type) {
    case "accommodation":
      return "stay";
    case "meal":
      return "meal";
    case "event":
      return "event";
    case "transit_arrival":
    case "transport_booked":
      return "station";
    case "appointment":
    case "other":
    default:
      return "appointment";
  }
}

function timingModeFromStop(stop: DbStop): TimingMode {
  const fromMeta = stop.metadata?.timing_mode as TimingMode | undefined;
  if (fromMeta) return fromMeta;
  // Stay rows in Postgres are always written with timing_mode=arrive_by;
  // anything fixed-time defaults to arrive_by; anything else defaults to
  // around_then.
  if (!stop.is_time_fixed) return "around_then";
  return "arrive_by";
}

function roleFromStop(stop: DbStop): AnchorRole {
  return (stop.metadata?.role as AnchorRole | undefined) ?? null;
}

function dateTimeFromIso(
  iso: string | null,
  timezone: string,
): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  // Render the iso in the workspace's timezone. The editor's
  // local-string fields use HH:MM 24h.
  const d = new Date(iso);
  const dateFmt = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  });
  const timeFmt = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  });
  return { date: dateFmt.format(d), time: timeFmt.format(d) };
}

function placeFromStop(stop: DbStop): PlaceSelection | null {
  if (stop.location_id) {
    return {
      kind: "location",
      location_id: stop.location_id,
      label: stop.location?.name ?? stop.title ?? "(unnamed location)",
      location_type: (stop.location?.type as LocationType | undefined) ?? "other",
    };
  }
  if (stop.customer_site_id && stop.customer_id) {
    return {
      kind: "customer_site",
      customer_site_id: stop.customer_site_id,
      customer_id: stop.customer_id,
      label:
        stop.customer_site?.name ??
        stop.title ??
        "(unnamed customer site)",
    };
  }
  if (stop.customer_id) {
    return {
      kind: "customer",
      customer_id: stop.customer_id,
      label: stop.customer?.name ?? stop.title ?? "(unnamed customer)",
    };
  }
  return null;
}

// Convert a stop row to the Anchor shape AnchorCard expects.
//
// `home` stops (type === 'start') are filtered upstream — the brief
// treats home as an implicit virtual anchor, and we want the editor
// to do the same so the user's first user-added anchor sits at the
// top of the editable list.
export function anchorFromStop(stop: DbStop, timezone: string): Anchor {
  const kind = kindFromStop(stop);
  const role = roleFromStop(stop);
  const { date, time } = dateTimeFromIso(stop.start_time, timezone);
  const co = dateTimeFromIso(stop.end_time, timezone);
  return {
    uid: stop.id,
    place: placeFromStop(stop),
    kindOverride: kind,
    roleOverride: role,
    date,
    time,
    timingMode: timingModeFromStop(stop),
    timingModeOverride: !!stop.metadata?.timing_mode,
    durationMins: stop.duration_minutes ?? 60,
    checkOutDate: kind === "stay" ? co.date : "",
    checkOutTime: kind === "stay" ? co.time : "",
    notes: stop.notes ?? null,
    accommodation: null,
  };
}

// Stop types we treat as part of the planning surface. Anything
// outside this list (start, end, transit_departure, transit_arrival,
// stopover) is filtered out — start/end are surfaced separately as a
// home header / journey-end, transit_* belong to the legacy booking-
// modal flow and shouldn't render as planning cards, and stopovers
// are surfaced by timelineFromStops below.
const PLANNING_ANCHOR_TYPES = new Set([
  "appointment",
  "accommodation",
  "event",
  "meal",
  "transport_booked",
  "other",
]);

const TRANSIT_TYPES = new Set(["transit_departure", "transit_arrival", "transit_changeover"]);

function isTransitStop(s: DbStop): boolean {
  if (TRANSIT_TYPES.has(s.type)) return true;
  const meta = s.metadata as Record<string, unknown> | null;
  const kind = meta?.kind as string | undefined;
  return kind === "transit_departure" || kind === "transit_arrival" || kind === "transit_changeover";
}

function transitDirection(s: DbStop): "departure" | "arrival" {
  if (s.type === "transit_departure") return "departure";
  if (s.type === "transit_arrival") return "arrival";
  if ((s.type as string) === "transit_changeover") return "departure";
  const meta = s.metadata as Record<string, unknown> | null;
  return (meta?.kind as string) === "transit_departure" ? "departure" : "arrival";
}

// Build the editor's anchor list from the loaded stop rows. Filters
// out the implicit "home" start stop AND stopover stops — stopovers
// are surfaced separately via `timelineFromStops`, so the editor can
// render them with StopoverCard between the anchors they sit between.
export function anchorsFromStops(
  stops: DbStop[],
  timezone: string,
): Anchor[] {
  return stops
    .filter((s) => PLANNING_ANCHOR_TYPES.has(s.type) && !isTransitStop(s))
    .sort((a, b) => a.sequence - b.sequence)
    .map((s) => anchorFromStop(s, timezone));
}

// Convert a stopover-typed stop into the Stopover shape consumed by
// StopoverCard. The stop's sequence + the surrounding anchors tell
// the renderer which pair to slot it between.
export type EditorTimelineItem =
  | { kind: "anchor"; anchor: Anchor; stop: DbStop }
  | { kind: "stopover"; stopover: { uid: string; place: PlaceSelection | null; durationMins: number }; stop: DbStop }
  | { kind: "transit"; stop: DbStop; transitDirection: "departure" | "arrival" };

export function timelineFromStops(
  stops: DbStop[],
  timezone: string,
): EditorTimelineItem[] {
  return stops
    .filter(
      (s) =>
        PLANNING_ANCHOR_TYPES.has(s.type) ||
        s.type === "stopover" ||
        isTransitStop(s),
    )
    .sort((a, b) => a.sequence - b.sequence)
    .map<EditorTimelineItem>((s) => {
      if (s.type === "stopover") {
        return {
          kind: "stopover",
          stopover: {
            uid: s.id,
            place: placeFromStop(s),
            durationMins: s.duration_minutes ?? 30,
          },
          stop: s,
        };
      }
      if (isTransitStop(s)) {
        return {
          kind: "transit",
          stop: s,
          transitDirection: transitDirection(s),
        };
      }
      return {
        kind: "anchor",
        anchor: anchorFromStop(s, timezone),
        stop: s,
      };
    });
}

// transitions live on (from_stop_id, to_stop_id). Convert each row
// to a BriefTransition keyed by the same `${fromUid}::${toUid}`
// pattern the brief uses.
export function transitionsFromDb(
  transitions: DbTransition[],
): Map<string, BriefTransition> {
  const out = new Map<string, BriefTransition>();
  for (const t of transitions) {
    if (!t.mode) continue;
    const base = emptyTransition();
    // Decode the brief's local_before / local_after preference from
    // the transitions.notes "khonsera:local_before=X;local_after=Y"
    // marker (createItineraryFromBrief writes it there because
    // transitions has no dedicated local-leg columns).
    let localBefore: LocalMode = "walk";
    let localAfter: LocalMode = "walk";
    const marker = t.notes ?? "";
    if (marker.startsWith("khonsera:")) {
      for (const part of marker.slice("khonsera:".length).split(";")) {
        const [k, v] = part.split("=");
        if (k === "local_before") localBefore = (v as LocalMode) ?? "walk";
        if (k === "local_after") localAfter = (v as LocalMode) ?? "walk";
      }
    }
    out.set(transitionKey(t.from_stop_id, t.to_stop_id), {
      ...base,
      mode: t.mode as TransitionMode,
      localBefore,
      localAfter,
      booked: t.is_locked,
    });
  }
  return out;
}

// Stopovers keyed by their parent pair (fromUid::toUid). The stopover
// itself doesn't show up as an anchor — it lives on the leg between
// two real anchors.
export function stopoversFromDb(
  stopovers: DbStopover[],
  stops: DbStop[],
): Map<string, Stopover> {
  const stopById = new Map(stops.map((s) => [s.id, s] as const));
  const out = new Map<string, Stopover>();
  for (const sv of stopovers) {
    out.set(transitionKey(sv.from_stop_id, sv.to_stop_id), {
      place: placeFromStop({
        // Build a minimal pseudo-stop so placeFromStop can do the
        // location / customer-site / customer dispatch in one place.
        id: sv.id,
        sequence: 0,
        type: "other",
        title: sv.title,
        start_time: null,
        end_time: null,
        duration_minutes: null,
        is_time_fixed: false,
        location_id: sv.location_id,
        customer_id: sv.customer_id,
        customer_site_id: sv.customer_site_id,
        notes: null,
        location: sv.location_id
          ? (stopById.get(sv.from_stop_id)?.location ?? null)
          : null,
        customer: null,
        customer_site: null,
        metadata: null,
      }),
      durationMins: sv.duration_minutes,
    });
  }
  return out;
}
