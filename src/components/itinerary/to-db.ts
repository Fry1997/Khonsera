// Anchor (client-side shape used by AnchorCard) → updateStop input
// (server action payload). The editor uses this when the user clicks
// Done on an expanded card; we flush the patched anchor through
// updateStop in one go rather than autosaving on every keystroke.

import { addMinutesIso, effectiveKind, effectiveRole, isoFromLocal } from "./helpers";
import type { Anchor } from "./types";

// What updateStop accepts. We deliberately don't pull the zod schema
// directly — its `z.input` type would force this layer to depend on
// the server-action file, which is fine for runtime but bad ergonomics
// in a client module that's imported from many places.
export type StopUpdateInput = {
  id: string;
  type:
    | "start"
    | "end"
    | "appointment"
    | "accommodation"
    | "event"
    | "meal"
    | "transport_booked"
    | "transit_arrival"
    | "other";
  title?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  duration_minutes?: number | null;
  is_time_fixed?: boolean;
  location_id?: string | null;
  customer_id?: string | null;
  customer_site_id?: string | null;
  metadata?: Record<string, unknown> | null;
  notes?: string | null;
};

// AnchorKind → stop_type. Mirrors createItineraryFromBrief's mapping
// so a stop written by the brief and a stop patched by the editor
// round-trip through the same enum values.
function stopTypeFor(kind: ReturnType<typeof effectiveKind>): StopUpdateInput["type"] {
  switch (kind) {
    case "stay":
      return "accommodation";
    case "meal":
      return "meal";
    case "event":
      return "event";
    case "station":
    case "appointment":
    default:
      return "appointment";
  }
}

export function anchorToStopUpdate(
  anchor: Anchor,
  timezone: string,
  earlier: Anchor[] = [],
): StopUpdateInput {
  const kind = effectiveKind(anchor);
  const role = effectiveRole(anchor, earlier);
  const isCheckIn = kind === "stay" && role !== "return_to_room";
  const isAroundThen = anchor.timingMode === "around_then";

  const startIso =
    !isAroundThen && anchor.date && anchor.time
      ? isoFromLocal(anchor.date, anchor.time, timezone)
      : null;

  let endIso: string | null = null;
  if (isCheckIn) {
    // Stay: end = check-out date + time.
    const coDate = anchor.checkOutDate || anchor.date;
    const coTime = anchor.checkOutTime || "11:00";
    if (coDate) endIso = isoFromLocal(coDate, coTime, timezone);
  } else if (startIso && anchor.durationMins) {
    endIso = addMinutesIso(startIso, anchor.durationMins);
  }

  // Stay/check-in is always treated as arrive_by under the hood —
  // the brief writer does the same when persisting from the form.
  const persistedTimingMode = isCheckIn
    ? "arrive_by"
    : anchor.timingMode;

  return {
    id: anchor.uid,
    type: stopTypeFor(kind),
    title: anchor.place?.label ?? null,
    start_time: startIso,
    end_time: endIso,
    duration_minutes: anchor.durationMins,
    is_time_fixed: !isAroundThen,
    location_id:
      anchor.place?.kind === "location" ? anchor.place.location_id : null,
    customer_id:
      anchor.place?.kind === "customer_site" ||
      anchor.place?.kind === "customer"
        ? anchor.place.customer_id
        : null,
    customer_site_id:
      anchor.place?.kind === "customer_site"
        ? anchor.place.customer_site_id
        : null,
    metadata: {
      kind,
      role,
      // Only stamp timing_mode in metadata when the user explicitly
      // overrode it — otherwise we let inference re-run on read.
      timing_mode: anchor.timingModeOverride ? persistedTimingMode : null,
    },
  };
}
