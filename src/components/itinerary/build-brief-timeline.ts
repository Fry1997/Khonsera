import type { TicketSegment } from "@/components/train-ticket-card";
import type { GapMode, GapPreview } from "@/components/gap-mode-picker";
import type { PlaceSelection } from "@/components/place-picker";
import type { ModePreviewMap } from "./transition-row";
import type { Anchor, BriefTransition, Stopover, TimelineEntry } from "./types";
import type { BriefTransportBooking } from "./transport-booking-card";
import type { BriefAccommodationBooking } from "./accommodation-booking-card";
import { HOME_UID, stopoverAsAnchor, stopoverUid } from "./helpers";

export type BriefTimelineInput = {
  anchors: Anchor[];
  transportBookings: BriefTransportBooking[];
  accommodationBookings: BriefAccommodationBooking[];
  transitions: Map<string, BriefTransition>;
  stopovers: Map<string, Stopover>;
  expandedAnchors: Set<string>;
  tripStartDate: string;
  baseName: string;
  basePlace: PlaceSelection | null;
  gapModes: Map<string, GapMode>;
  getGapPreviews: (fromKey: string, toKey: string) => Partial<Record<GapMode, GapPreview>>;
  getGapPreview: (fromKey: string, toKey: string, mode: GapMode) => GapPreview;
  briefPreviewsForPair: (from: PlaceSelection | null, to: PlaceSelection | null) => ModePreviewMap;
  handlers: {
    getTransition: (fromUid: string, toUid: string) => BriefTransition;
    setTransition: (fromUid: string, toUid: string, patch: Partial<BriefTransition>) => void;
    setGapMode: (gapKey: string, mode: GapMode) => void;
    updateAnchor: (uid: string, patch: Partial<Anchor>) => void;
    removeAnchor: (uid: string) => void;
    setExpandedAnchor: (uid: string, expanded: boolean) => void;
    updateTransportBooking: (uid: string, patch: Partial<BriefTransportBooking>) => void;
    removeTransportBooking: (uid: string) => void;
    updateAccommodationBooking: (uid: string, patch: Partial<BriefAccommodationBooking>) => void;
    removeAccommodationBooking: (uid: string) => void;
    insertAnchorAt: (idx: number) => void;
    addStopover: (fromUid: string, toUid: string) => void;
    removeStopover: (fromUid: string, toUid: string) => void;
    setStopoverPatch: (fromUid: string, toUid: string, patch: Partial<Stopover>) => void;
    prefetchGap: (fromKey: string, toKey: string) => void;
    briefPrefetchPair: (from: PlaceSelection | null, to: PlaceSelection | null) => void;
    getStopover: (fromUid: string, toUid: string) => Stopover | undefined;
  };
};

type SortedEntry =
  | { kind: "transport"; booking: BriefTransportBooking }
  | { kind: "anchor"; anchor: Anchor; index: number }
  | { kind: "hotel"; booking: BriefAccommodationBooking };

export function buildBriefTimeline(input: BriefTimelineInput): TimelineEntry[] {
  const {
    anchors,
    transportBookings,
    accommodationBookings,
    expandedAnchors,
    tripStartDate,
    baseName,
    basePlace,
    gapModes,
    getGapPreviews,
    getGapPreview,
    briefPreviewsForPair,
    handlers,
  } = input;

  // Sort confirmed entries chronologically
  const sorted: SortedEntry[] = [];
  anchors.forEach((a, i) => sorted.push({ kind: "anchor", anchor: a, index: i }));
  transportBookings
    .filter((tb) => tb.confirmed && tb.mode)
    .forEach((tb) => sorted.push({ kind: "transport", booking: tb }));
  accommodationBookings
    .filter((ab) => ab.confirmed && ab.hotel)
    .forEach((ab) => sorted.push({ kind: "hotel", booking: ab }));

  sorted.sort((a, b) => {
    const timeOf = (e: SortedEntry) => {
      if (e.kind === "anchor") return `${e.anchor.date}T${e.anchor.time || "12:00"}`;
      if (e.kind === "transport") return `${e.booking.date}T${e.booking.departTime}`;
      return `${e.booking.checkInDate}T${e.booking.checkInTime || "18:00"}`;
    };
    return timeOf(a).localeCompare(timeOf(b));
  });

  const result: TimelineEntry[] = [];

  for (let entryIdx = 0; entryIdx < sorted.length; entryIdx++) {
    const entry = sorted[entryIdx];
    const prevEntry = entryIdx > 0 ? sorted[entryIdx - 1] : null;
    const nextEntry = entryIdx < sorted.length - 1 ? sorted[entryIdx + 1] : null;

    // Day header
    const entryDate = entry.kind === "anchor" ? entry.anchor.date
      : entry.kind === "transport" ? entry.booking.date
      : entry.booking.checkInDate;
    const prevDate = prevEntry
      ? prevEntry.kind === "anchor" ? prevEntry.anchor.date
        : prevEntry.kind === "transport" ? prevEntry.booking.date
        : prevEntry.booking.checkInDate
      : tripStartDate;
    if (entryDate && prevDate && entryDate !== prevDate) {
      result.push({
        kind: "day-break",
        date: entryDate,
        label: new Date(entryDate + "T12:00:00").toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "short",
        }),
      });
    }

    // Gap before this entry
    buildGapBefore(result, entry, prevEntry, entryIdx, input);

    // Context gap between transport bookings
    if (prevEntry?.kind === "transport" && entry.kind === "transport") {
      const gap = findGapInfo(prevEntry, entry);
      if (gap && gap.gapMinutes > 0) {
        const hours = Math.floor(gap.gapMinutes / 60);
        const mins = gap.gapMinutes % 60;
        const durLabel = hours > 0
          ? `${hours}h${mins > 0 ? ` ${mins}m` : ""}`
          : `${mins}m`;
        result.push({
          kind: "context-gap",
          location: gap.location,
          durationLabel: durLabel,
          onAddStop: () => handlers.insertAnchorAt(anchors.length),
        });
      }
    }

    // The entry itself
    if (entry.kind === "transport") {
      result.push(buildTransportEntry(entry.booking, handlers));
    } else if (entry.kind === "hotel") {
      result.push(buildHotelEntry(entry.booking, handlers));
    } else {
      // Anchor
      const anchor = entry.anchor;
      const anchorIdx = entry.index;
      const maximizeInfo = computeMaximizeInfo(
        anchor, entryIdx, sorted, gapModes, getGapPreview,
      );
      result.push({
        kind: "anchor",
        uid: anchor.uid,
        anchor,
        earlier: anchors.slice(0, anchorIdx),
        expanded: expandedAnchors.has(anchor.uid) || !anchor.place,
        maximizeInfo,
        onModeChange: (next) => handlers.setExpandedAnchor(anchor.uid, next === "expanded"),
        onChange: (patch) => handlers.updateAnchor(anchor.uid, patch),
        onRemove: () => handlers.removeAnchor(anchor.uid),
      });

      // Free time hint before next transport
      if (nextEntry?.kind === "transport" && anchor.timingMode !== "maximize" && anchor.time && anchor.durationMins) {
        const [h, m] = anchor.time.split(":").map(Number);
        const endMin = h * 60 + m + anchor.durationMins;
        const [dh, dm] = (nextEntry.booking.departTime || "").split(":").map(Number);
        const departMin = dh * 60 + dm;
        const freeMin = departMin - endMin;
        if (freeMin > 60) {
          const freeH = Math.floor(freeMin / 60);
          const freeM = freeMin % 60;
          result.push({
            kind: "free-time",
            durationLabel: `${freeH}h${freeM > 0 ? ` ${freeM}m` : ""}`,
            beforeLabel: `before your ${nextEntry.booking.departTime} train`,
            onAddStop: () => handlers.insertAnchorAt(anchors.length),
          });
        }
      }

      // Add stop between anchors
      const next = anchors[anchorIdx + 1];
      if (next && nextEntry?.kind !== "transport") {
        result.push({
          kind: "add-stop",
          label: "+ Add a stop between these",
          onAdd: () => handlers.addStopover(anchor.uid, next.uid),
        });
      }
    }
  }

  // Add stop at bottom
  if (sorted.length > 0) {
    result.push({
      kind: "add-stop",
      label: "+ Add a stop",
      onAdd: () => handlers.insertAnchorAt(anchors.length),
    });
  }

  // Last transport → home gap
  const lastTb = [...transportBookings]
    .filter((tb) => tb.confirmed && tb.arriveTime)
    .sort((a, b) => `${b.date}T${b.arriveTime}`.localeCompare(`${a.date}T${a.arriveTime}`))[0];
  if (lastTb) {
    const hubId = lastTb.destinationHub?.id;
    const fromLabel = lastTb.destinationHub?.label ?? "station";
    const gapKey = `hub:${hubId}→home`;
    if (hubId) handlers.prefetchGap(`hub:${hubId}`, "home");
    result.push({
      kind: "gap-mode",
      fromLabel,
      toLabel: "Home",
      selected: gapModes.get(gapKey) ?? null,
      previews: hubId ? getGapPreviews(`hub:${hubId}`, "home") : undefined,
      onSelect: (m) => handlers.setGapMode(gapKey, m),
    });
  }

  // Home return
  if (sorted.length > 0) {
    const homeTime = computeHomeArrival(lastTb, gapModes, getGapPreview);
    result.push({
      kind: "home-return",
      arriveBy: homeTime ?? undefined,
    });
  }

  return result;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function buildGapBefore(
  result: TimelineEntry[],
  entry: SortedEntry,
  prevEntry: SortedEntry | null,
  entryIdx: number,
  input: BriefTimelineInput,
) {
  const { gapModes, getGapPreviews, briefPreviewsForPair, baseName, basePlace, handlers } = input;

  if (entryIdx === 0) {
    // Home → first entry
    if (entry.kind === "anchor") {
      result.push({
        kind: "gap-transition",
        from: null,
        to: entry.anchor,
        transition: handlers.getTransition(HOME_UID, entry.anchor.uid),
        fromVirtualLabel: baseName,
        modePreviews: briefPreviewsForPair(basePlace, entry.anchor.place),
        onChange: (patch) => handlers.setTransition(HOME_UID, entry.anchor.uid, patch),
        onOpenChange: (open) => {
          if (open && entry.anchor.place) {
            handlers.briefPrefetchPair(basePlace, entry.anchor.place);
          }
        },
      });
    } else if (entry.kind === "transport") {
      const hubId = entry.booking.departureHub?.id;
      const toLabel = entry.booking.departureHub?.label ?? "station";
      const gapKey = `home→hub:${hubId}`;
      handlers.prefetchGap("home", `hub:${hubId}`);
      result.push({
        kind: "gap-mode",
        fromLabel: baseName,
        toLabel,
        selected: gapModes.get(gapKey) ?? null,
        previews: getGapPreviews("home", `hub:${hubId}`),
        onSelect: (m) => handlers.setGapMode(gapKey, m),
      });
    }
    return;
  }

  if (prevEntry?.kind === "transport" && entry.kind === "anchor") {
    const hubId = prevEntry.booking.destinationHub?.id;
    const fromLabel = prevEntry.booking.destinationHub?.label ?? "station";
    const toLabel = entry.anchor.place?.label ?? "appointment";
    const gapKey = `hub:${hubId}→anchor:${entry.anchor.uid}`;
    if (entry.anchor.place) handlers.prefetchGap(`hub:${hubId}`, `anchor:${entry.anchor.uid}`);
    result.push({
      kind: "gap-mode",
      fromLabel,
      toLabel,
      selected: gapModes.get(gapKey) ?? null,
      previews: entry.anchor.place ? getGapPreviews(`hub:${hubId}`, `anchor:${entry.anchor.uid}`) : undefined,
      onSelect: (m) => handlers.setGapMode(gapKey, m),
    });
  } else if (prevEntry?.kind === "anchor" && entry.kind === "transport") {
    const hubId = entry.booking.departureHub?.id;
    const fromLabel = prevEntry.anchor.place?.label ?? "stop";
    const toLabel = entry.booking.departureHub?.label ?? "station";
    const gapKey = `anchor:${prevEntry.anchor.uid}→hub:${hubId}`;
    if (prevEntry.anchor.place) handlers.prefetchGap(`anchor:${prevEntry.anchor.uid}`, `hub:${hubId}`);
    result.push({
      kind: "gap-mode",
      fromLabel,
      toLabel,
      selected: gapModes.get(gapKey) ?? null,
      previews: prevEntry.anchor.place ? getGapPreviews(`anchor:${prevEntry.anchor.uid}`, `hub:${hubId}`) : undefined,
      onSelect: (m) => handlers.setGapMode(gapKey, m),
    });
  } else if (prevEntry?.kind === "anchor" && entry.kind === "anchor") {
    const prev = prevEntry.anchor;
    const cur = entry.anchor;
    const sv = handlers.getStopover(prev.uid, cur.uid);
    if (sv) {
      const svUid = stopoverUid(prev.uid, cur.uid);
      const svAnchor = stopoverAsAnchor(sv, svUid);
      result.push({
        kind: "gap-transition",
        from: prev,
        to: svAnchor,
        transition: handlers.getTransition(prev.uid, svUid),
        modePreviews: briefPreviewsForPair(prev.place, sv.place),
        onChange: (patch) => handlers.setTransition(prev.uid, svUid, patch),
        onOpenChange: (open) => {
          if (open) handlers.briefPrefetchPair(prev.place, sv.place);
        },
      });
      result.push({
        kind: "stopover",
        uid: svUid,
        stopover: sv,
        fromAnchor: prev,
        toAnchor: cur,
        expanded: false,
        onChange: (patch) => handlers.setStopoverPatch(prev.uid, cur.uid, patch),
        onRemove: () => handlers.removeStopover(prev.uid, cur.uid),
      });
      result.push({
        kind: "gap-transition",
        from: svAnchor,
        to: cur,
        transition: handlers.getTransition(svUid, cur.uid),
        modePreviews: briefPreviewsForPair(sv.place, cur.place),
        onChange: (patch) => handlers.setTransition(svUid, cur.uid, patch),
        onOpenChange: (open) => {
          if (open) handlers.briefPrefetchPair(sv.place, cur.place);
        },
      });
    } else {
      result.push({
        kind: "gap-transition",
        from: prev,
        to: cur,
        transition: handlers.getTransition(prev.uid, cur.uid),
        modePreviews: briefPreviewsForPair(prev.place, cur.place),
        onChange: (patch) => handlers.setTransition(prev.uid, cur.uid, patch),
        onOpenChange: (open) => {
          if (open) handlers.briefPrefetchPair(prev.place, cur.place);
        },
      });
    }
  }
}

function buildTransportEntry(
  tb: BriefTransportBooking,
  handlers: BriefTimelineInput["handlers"],
): TimelineEntry {
  const legs: TicketSegment[] = [];
  const stops = [
    { label: tb.departureHub?.label ?? "?", time: tb.departTime || "" },
    ...tb.changeovers.map((co) => ({ label: co.hub?.label ?? "?", time: co.departTime || "" })),
    { label: tb.destinationHub?.label ?? "?", time: tb.arriveTime || "" },
  ];
  for (let li = 0; li < stops.length - 1; li++) {
    const bc = tb.barcodes[li];
    legs.push({
      from_station: stops[li].label,
      to_station: stops[li + 1].label,
      from_station_code: null,
      to_station_code: null,
      departure_date: tb.date || "",
      departure_time: stops[li].time,
      arrival_time: li < stops.length - 2 ? (tb.changeovers[li]?.arriveTime || "") : (tb.arriveTime || ""),
      operator: tb.operator ?? null,
      route_restriction: tb.routeRestriction ?? null,
      ticket_type: tb.ticketType ?? null,
      coach: null,
      seat: li === 0 ? (tb.seat || null) : null,
      barcode_ref: bc?.ref ?? null,
      barcode_data: bc?.data ?? null,
      price: li === 0 && tb.price ? Number(tb.price) : null,
    });
  }
  return {
    kind: "transport",
    uid: tb.uid,
    label: `${tb.departTime} ${tb.mode ?? "train"} to ${tb.destinationHub?.label ?? "?"}`,
    mode: tb.mode ?? "train",
    legs,
    onEdit: () => handlers.updateTransportBooking(tb.uid, { confirmed: false }),
    onRemove: () => handlers.removeTransportBooking(tb.uid),
  };
}

function buildHotelEntry(
  ab: BriefAccommodationBooking,
  handlers: BriefTimelineInput["handlers"],
): TimelineEntry {
  const nights = ab.checkInDate && ab.checkOutDate
    ? Math.round((new Date(ab.checkOutDate).getTime() - new Date(ab.checkInDate).getTime()) / 86400000)
    : 1;
  return {
    kind: "hotel",
    uid: ab.uid,
    label: ab.hotel?.label ?? "Hotel",
    nights,
    checkInTime: ab.checkInTime || "15:00",
    checkOutTime: ab.checkOutTime || "11:00",
    reference: ab.reference || undefined,
    onEdit: () => handlers.updateAccommodationBooking(ab.uid, { confirmed: false }),
    onRemove: () => handlers.removeAccommodationBooking(ab.uid),
  };
}

function computeMaximizeInfo(
  anchor: Anchor,
  entryIdx: number,
  sorted: SortedEntry[],
  gapModes: Map<string, GapMode>,
  getGapPreview: (fromKey: string, toKey: string, mode: GapMode) => GapPreview,
): { durationMins: number; arriveBy: string; leaveBy: string; travelNote?: string } | undefined {
  if (anchor.timingMode !== "maximize") return undefined;

  const BUFFER = 10;
  let prevTransport: BriefTransportBooking | null = null;
  for (let j = entryIdx - 1; j >= 0; j--) {
    const e = sorted[j];
    if (e.kind === "transport") { prevTransport = e.booking; break; }
  }
  let nextTransport: BriefTransportBooking | null = null;
  for (let j = entryIdx + 1; j < sorted.length; j++) {
    const e = sorted[j];
    if (e.kind === "transport") { nextTransport = e.booking; break; }
  }

  if (!prevTransport?.arriveTime || !nextTransport?.departTime) return undefined;

  const [ah, am] = prevTransport.arriveTime.split(":").map(Number);
  const [dh, dm] = nextTransport.departTime.split(":").map(Number);

  const inboundHubId = prevTransport.destinationHub?.id;
  const inboundGapKey = `hub:${inboundHubId}→anchor:${anchor.uid}`;
  const inboundMode = gapModes.get(inboundGapKey);
  const inboundPreview = inboundMode && inboundHubId
    ? getGapPreview(`hub:${inboundHubId}`, `anchor:${anchor.uid}`, inboundMode)
    : null;
  const inboundTravelMin = inboundPreview && inboundPreview !== "pending"
    ? inboundPreview.durationMinutes ?? 0 : 0;

  const outboundHubId = nextTransport.departureHub?.id;
  const outboundGapKey = `anchor:${anchor.uid}→hub:${outboundHubId}`;
  const outboundMode = gapModes.get(outboundGapKey);
  const outboundPreview = outboundMode && outboundHubId
    ? getGapPreview(`anchor:${anchor.uid}`, `hub:${outboundHubId}`, outboundMode)
    : null;
  const outboundTravelMin = outboundPreview && outboundPreview !== "pending"
    ? outboundPreview.durationMinutes ?? 0 : 0;

  const arriveMin = ah * 60 + am + inboundTravelMin;
  const departMin = dh * 60 + dm - BUFFER - outboundTravelMin;
  const maxDuration = departMin - arriveMin;
  if (maxDuration <= 0) return undefined;

  const arrH = Math.floor(arriveMin / 60);
  const arrM = arriveMin % 60;
  const depH = Math.floor(departMin / 60);
  const depM = departMin % 60;
  const travelNote = (inboundTravelMin > 0 || outboundTravelMin > 0)
    ? `${inboundTravelMin > 0 ? `${inboundTravelMin}m ${inboundMode} there` : ""}${inboundTravelMin > 0 && outboundTravelMin > 0 ? " + " : ""}${outboundTravelMin > 0 ? `${outboundTravelMin}m ${outboundMode} back` : ""} + ${BUFFER}m buffer`
    : `${BUFFER} min buffer before departure`;

  return {
    arriveBy: `${String(arrH).padStart(2, "0")}:${String(arrM).padStart(2, "0")}`,
    leaveBy: `${String(depH).padStart(2, "0")}:${String(depM).padStart(2, "0")}`,
    durationMins: maxDuration,
    travelNote,
  };
}

function computeHomeArrival(
  lastTb: BriefTransportBooking | undefined,
  gapModes: Map<string, GapMode>,
  getGapPreview: (fromKey: string, toKey: string, mode: GapMode) => GapPreview,
): string | null {
  if (!lastTb?.arriveTime) return null;
  const hubId = lastTb.destinationHub?.id;
  const gapKey = `hub:${hubId}→home`;
  const mode = gapModes.get(gapKey);
  const preview = mode && hubId ? getGapPreview(`hub:${hubId}`, "home", mode) : null;
  const mins = preview && preview !== "pending" ? preview.durationMinutes : null;
  if (mins == null) return null;
  const [h, m] = lastTb.arriveTime.split(":").map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function findGapInfo(
  prevEntry: SortedEntry,
  nextEntry: SortedEntry,
): { location: string; from: string; to: string; gapMinutes: number } | null {
  if (prevEntry.kind === "transport" && nextEntry.kind === "transport") {
    const arriveTime = prevEntry.booking.arriveTime;
    const departTime = nextEntry.booking.departTime;
    const dest = prevEntry.booking.destinationHub?.label;
    if (arriveTime && departTime && dest) {
      const [ah, am] = arriveTime.split(":").map(Number);
      const [dh, dm] = departTime.split(":").map(Number);
      const gap = (dh * 60 + dm) - (ah * 60 + am);
      if (gap > 0) return { location: dest, from: arriveTime, to: departTime, gapMinutes: gap };
    }
  }
  return null;
}
