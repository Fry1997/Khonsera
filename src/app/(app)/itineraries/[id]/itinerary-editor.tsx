"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, useMemo, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { decodePolyline } from "@/components/journey-map";
import type { Journey, Leg, Station, LegMode } from "@/components/journey-map";

// MapLibre needs browser APIs — dynamic import with ssr: false
const JourneyMap = dynamic(
  () => import("@/components/journey-map").then((m) => m.JourneyMap),
  { ssr: false },
);
import { FormError } from "@/components/ui/form";
import {
  deleteStop,
  insertStopAt,
  updateStop,
  deleteStops,
} from "@/lib/actions/stops";
import {
  upsertTransition,
  setTransitionMode,
  backfillRailPolylines,
} from "@/lib/actions/transitions";
import { addFullTransportBooking } from "@/lib/actions/bookings";
import { reEnrichItineraryFromGmail } from "@/lib/actions/gmail";
import { transitionItineraryStatus, updateItinerary } from "@/lib/actions/itineraries";
import type { InitialPreviewSeed } from "@/components/itinerary/use-route-preview";
import { checkLegFeasibility } from "@/lib/feasibility/check";
import { feedbackFromError } from "@/lib/actions/_form";
import type {
  ItineraryStatus,
  LocationType,
  StopType,
  TransitionMode,
} from "@/lib/types/domain";
import {
  TransportBookingCard,
  emptyTransportBookingItem,
  type BriefTransportBooking,
} from "@/components/itinerary/transport-booking-card";
import { AddAccommodationBookingForm } from "./add-accommodation-booking-form";
import { GmailImportPanel } from "./gmail-import-panel";
import { DeleteItineraryButton } from "@/components/delete-itinerary-button";
import { TransportIcon, StopIcon } from "@/components/icons";
import {
  AddBetween,
  TRANSITION_OPTIONS,
  Timeline,
  TransitionRow as PlanningTransitionRow,
  anchorsFromStops,
  anchorToStopUpdate,
  buildDatePresets,
  buildPlanningTimeline,
  emptyTransition,
  stopoverAsAnchor,
  transitStopAsAnchor,
  stopoverToStopUpdate,
  timelineFromStops,
  transitionKey,
  transitionsFromDb,
  useRoutePreviews,
  type Anchor,
  type BriefTransition,
  type DbStop,
  type EditorTimelineItem,
  type ModePreviewMap,
  type Stopover,
  type StopoverBackCalc,
} from "@/components/itinerary";

// Inline icons — line-art style matching the warm editorial design.
const Icon = {
  home: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z" /></svg>
  ),
  train: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="3" width="14" height="14" rx="3" /><path d="M5 11h14M9 21l-2-3M15 21l2-3" /><circle cx="9" cy="14" r="0.8" fill="currentColor" /><circle cx="15" cy="14" r="0.8" fill="currentColor" /></svg>
  ),
  car: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 13l2-5a3 3 0 0 1 3-2h8a3 3 0 0 1 3 2l2 5v5h-3v-2H6v2H3z" /><circle cx="7.5" cy="15" r="1.2" /><circle cx="16.5" cy="15" r="1.2" /></svg>
  ),
  walk: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="13" cy="4.5" r="1.5" /><path d="M9 21l3-6 2 2 3 4M9 13l3-4 3 2" /></svg>
  ),
  pin: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s-7-7.5-7-13a7 7 0 1 1 14 0c0 5.5-7 13-7 13z" /><circle cx="12" cy="9" r="2.3" /></svg>
  ),
  bed: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5M3 18h18M3 18v2M21 18v2M7 11V8a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3" /></svg>
  ),
  fork: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v8a3 3 0 0 0 3 3v7M8 3v5M11 3v5M16 3c-2 0-2 5 0 8v10" /></svg>
  ),
  ticket: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 2v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-2z" /><path d="M9 7v10" strokeDasharray="2 2" /></svg>
  ),
  flag: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 22V4M5 4h11l-2 3 2 3H5" /></svg>
  ),
  plane: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2 14l20-7-7 18-3-7z" /></svg>
  ),
  handshake: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10l4-4 3 3 3-3 4 4M3 14l5 5 4-4 4 4 5-5" /></svg>
  ),
  plus: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
  ),
  arrow: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
  ),
  back: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
  ),
  copy: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M4 16V6a2 2 0 0 1 2-2h10" /></svg>
  ),
};

const STOP_ICON: Record<StopType, React.ReactNode> = {
  start: Icon.home,
  end: Icon.flag,
  appointment: Icon.handshake,
  accommodation: Icon.bed,
  event: Icon.ticket,
  meal: Icon.fork,
  transport_booked: Icon.train,
  transit_arrival: Icon.plane,
  transit_departure: Icon.train,
  transit_changeover: Icon.train,
  stopover: Icon.pin,
  other: Icon.pin,
};

const STOP_LABEL: Record<StopType, string> = {
  start: "Start",
  end: "End",
  appointment: "On-site",
  accommodation: "Check-in",
  event: "Event",
  meal: "Meal",
  transport_booked: "Transport",
  transit_arrival: "Arrive",
  transit_departure: "Depart",
  transit_changeover: "Change",
  stopover: "Stopover",
  other: "Point",
};

const STATUS_SB: Record<ItineraryStatus, string> = {
  draft: "sb-draft",
  planning: "sb-planning",
  planned: "sb-planned",
  in_progress: "sb-progress",
  completed: "sb-done",
  cancelled: "sb-cancelled",
};

// 'draft' is retired in migration 0013 — kept in the type union for
// legacy rows, but the flow / labels no longer surface it. Anything
// still holding 'draft' will fall through STATUS_LABEL's lookup and
// display as the type's string itself; advance-status won't offer it
// as a next step either.
const STATUS_FLOW: ItineraryStatus[] = [
  "planning",
  "planned",
  "in_progress",
  "completed",
];

const STATUS_LABEL: Record<ItineraryStatus, string> = {
  draft: "Planning",
  planning: "Planning",
  planned: "Planned",
  in_progress: "Live now",
  completed: "Completed",
  cancelled: "Cancelled",
};

type StopRow = {
  id: string;
  sequence: number;
  type: StopType;
  title: string | null;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  is_time_fixed: boolean;
  location_id: string | null;
  customer_id: string | null;
  customer_site_id: string | null;
  external_reference: string | null;
  notes: string | null;
  location: {
    name?: string;
    type?: string;
    address?: string;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  customer: { name?: string } | null;
  customer_site: {
    name?: string;
    address?: string;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  metadata: Record<string, unknown> | null;
};

type TransitionRow = {
  id: string;
  from_stop_id: string;
  to_stop_id: string;
  mode: TransitionMode;
  computed_duration_minutes: number | null;
  distance_miles: number | null;
  is_locked: boolean;
  overview_polyline: string | null;
};

type JourneyLegRow = {
  id: string;
  transition_id: string;
  sequence: number;
  leg_type: string; // walk | drive | train | bus | taxi | wait | meeting | buffer
  start_location_name: string | null;
  end_location_name: string | null;
  duration_minutes: number | null;
  distance_miles: number | null;
  service_number: string | null;
  instructions: string | null;
};

export function ItineraryEditor({
  itinerary,
  stops,
  transitions,
  journeyLegs,
  customers,
  customerSites,
  locations,
  contacts,
  timezone,
  totals,
  initialPreviewCache,
  gmailConnected,
}: {
  itinerary: {
    id: string;
    title: string | null;
    date_start: string;
    date_end: string;
    status: ItineraryStatus;
    notes: string | null;
    luggage_for_trip: "none" | "light" | "heavy" | string | null;
  };
  stops: StopRow[];
  transitions: TransitionRow[];
  journeyLegs: JourneyLegRow[];
  customers: { id: string; name: string }[];
  customerSites: { id: string; customer_id: string; name: string | null; address: string | null }[];
  locations: { id: string; name: string; type: LocationType; address: string | null }[];
  contacts: { id: string; customer_id: string; name: string }[];
  timezone: string;
  totals: { cost: number; currency: string };
  // Server-side cached previews keyed by (from_stop_id, to_stop_id,
  // mode). Seeded into the route-preview hook on mount so the picker
  // renders resolved pills on first paint instead of grey-pending.
  initialPreviewCache: InitialPreviewSeed[];
  gmailConnected?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [accommodationBookingFor, setAccommodationBookingFor] = useState<{
    afterStopId?: string;
    afterStopLabel?: string;
    existingStopId?: string;
  } | null>(null);
  const [gmailImportOpen, setGmailImportOpen] = useState(false);
  const [showAddAccommodation, setShowAddAccommodation] = useState(false);

  // Transport booking card — same component as the brief. When set,
  // the card renders in a modal. On "Done" (confirmed: true), we call
  // the server action and dismiss.
  const [editingTransport, setEditingTransport] = useState<BriefTransportBooking | null>(null);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [editingMasthead, setEditingMasthead] = useState(false);
  const [mastheadTitle, setMastheadTitle] = useState(itinerary.title ?? "");
  const [mastheadNotes, setMastheadNotes] = useState(itinerary.notes ?? "");
  const [mastheadDateStart, setMastheadDateStart] = useState(itinerary.date_start);
  const [mastheadDateEnd, setMastheadDateEnd] = useState(itinerary.date_end);
  const [pendingInsertAt, setPendingInsertAt] = useState<number | null>(null);

  const saveMasthead = () => {
    startTransition(async () => {
      setError(null);
      const result = await updateItinerary({
        id: itinerary.id,
        title: mastheadTitle.trim() || null,
        date_start: mastheadDateStart,
        date_end: mastheadDateEnd || mastheadDateStart,
        notes: mastheadNotes.trim() || null,
      });
      if (!result.ok) {
        setError(feedbackFromError(result.error).message);
        return;
      }
      setEditingMasthead(false);
      router.refresh();
    });
  };
  const handleTransportCardChange = (patch: Partial<BriefTransportBooking>) => {
    setEditingTransport((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      if (patch.confirmed) {
        submitTransportBooking(next);
        return null;
      }
      return next;
    });
  };
  const submitTransportBooking = (b: BriefTransportBooking) => {
    if (!b.departureHub.id || !b.destinationHub.id) return;
    const departIso = b.date && b.departTime
      ? new Date(`${b.date}T${b.departTime}`).toISOString()
      : new Date().toISOString();
    const arriveIso = b.date && b.arriveTime
      ? new Date(`${b.date}T${b.arriveTime}`).toISOString()
      : new Date().toISOString();
    startTransition(async () => {
      setError(null);
      const result = await addFullTransportBooking({
        itinerary_id: itinerary.id,
        mode: b.mode ?? "train",
        depart_hub_id: b.departureHub.id!,
        depart_label: b.departureHub.label ?? "Departure",
        depart_time: departIso,
        arrive_hub_id: b.destinationHub.id!,
        arrive_label: b.destinationHub.label ?? "Arrival",
        arrive_time: arriveIso,
        changeovers: b.changeovers
          .filter((co) => co.hub.id || co.hub.label)
          .map((co) => ({
            hub_id: co.hub.id,
            hub_label: co.hub.label ?? "Changeover",
            arrive_time: co.arriveTime ? new Date(`${b.date}T${co.arriveTime}`).toISOString() : departIso,
            depart_time: co.departTime ? new Date(`${b.date}T${co.departTime}`).toISOString() : departIso,
          })),
        service_number: b.serviceNumber?.trim() || null,
        reference: b.reference?.trim() || null,
        seat: b.seat?.trim() || null,
        price: b.price ? Number(b.price) : null,
        operator: b.operator,
        ticket_type: b.ticketType,
        route_restriction: b.routeRestriction,
        barcodes: b.barcodes,
        segment_calling_points: b.segmentCallingPoints,
      });
      if (!result.ok) {
        setError(feedbackFromError(result.error).message);
        return;
      }
      router.refresh();
    });
  };

  // Transitions keyed by from_stop_id for fast lookup.
  const transitionByFrom = useMemo(() => {
    const m = new Map<string, TransitionRow>();
    for (const t of transitions) m.set(t.from_stop_id, t);
    return m;
  }, [transitions]);

  // Planning-view state: shared-component cards derived from the DB
  // rows above. Anchors get a per-card "expanded" toggle so the user
  // sees a tidy summary by default and clicks Edit to flip back to
  // the full brief form. Multiple anchors can be expanded at once.
  const planningAnchors = useMemo<Anchor[]>(
    () => anchorsFromStops(stops as DbStop[], timezone),
    [stops, timezone],
  );
  // Full timeline including stopovers — used when rendering so we can
  // slot StopoverCard rows between the anchors they sit between.
  const planningTimeline = useMemo<EditorTimelineItem[]>(
    () => timelineFromStops(stops as DbStop[], timezone),
    [stops, timezone],
  );

  // Route previews — populated lazily when the user opens a
  // transition's mode picker. The hook fans the saved RoutePreview
  // entries out by (fromStopId, toStopId, mode); the helper below
  // collapses them into a per-pair Map that PlanningTransitionRow
  // accepts via its modePreviews prop.
  const routePreviews = useRoutePreviews(initialPreviewCache);
  const previewsForPair = (
    fromStopId: string,
    toStopId: string,
  ): ModePreviewMap => {
    const out: ModePreviewMap = {};
    for (const opt of TRANSITION_OPTIONS) {
      if (opt.value === "mixed") continue;
      const entry = routePreviews.get(fromStopId, toStopId, opt.value);
      if (entry) out[opt.value] = entry;
    }
    return out;
  };
  const prefetchPair = (fromStopId: string, toStopId: string) => {
    for (const opt of TRANSITION_OPTIONS) {
      if (opt.value === "mixed") continue;
      routePreviews.fetchPreview(fromStopId, toStopId, opt.value);
    }
  };

  const gapPreviewsForPair = (
    fromStopId: string,
    toStopId: string,
  ): Partial<Record<import("@/components/gap-mode-picker").GapMode, import("@/components/gap-mode-picker").GapPreview>> => {
    const out: Partial<Record<"walk" | "drive" | "taxi", import("@/components/gap-mode-picker").GapPreview>> = {};
    const tr = transitionByFrom.get(fromStopId);
    for (const mode of ["walk", "drive", "taxi"] as const) {
      const entry = routePreviews.get(fromStopId, toStopId, mode);
      if (entry) {
        out[mode] = entry === "pending" ? "pending" : entry;
      } else if (tr && tr.mode === mode && tr.computed_duration_minutes != null) {
        out[mode] = { durationMinutes: tr.computed_duration_minutes, distanceMiles: tr.distance_miles ?? null };
      }
    }
    return out;
  };

  // Gap mode selection — optimistic local state + server persist.
  // The local state ensures the badge highlights immediately without
  // waiting for the server round-trip.
  const [gapModeOverrides, setGapModeOverrides] = useState<Map<string, string>>(new Map());
  const handleSetGapMode = (fromId: string, toId: string, mode: string) => {
    const key = `${fromId}::${toId}`;
    setGapModeOverrides((prev) => new Map(prev).set(key, mode));
    startTransition(async () => {
      setError(null);
      const result = await upsertTransition({
        itinerary_id: itinerary.id,
        from_stop_id: fromId,
        to_stop_id: toId,
        mode: mode as "walk" | "drive" | "taxi",
      });
      if (!result.ok) {
        setError(feedbackFromError(result.error).message);
        setGapModeOverrides((prev) => {
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
        return;
      }
      router.refresh();
    });
  };

  const gapPreviewsForPairWithOverride = (
    fromStopId: string,
    toStopId: string,
  ): Partial<Record<import("@/components/gap-mode-picker").GapMode, import("@/components/gap-mode-picker").GapPreview>> => {
    return gapPreviewsForPair(fromStopId, toStopId);
  };

  const getGapModeSelected = (fromId: string, toId: string, dbMode: string): import("@/components/gap-mode-picker").GapMode | null => {
    const key = `${fromId}::${toId}`;
    const override = gapModeOverrides.get(key);
    const mode = override ?? dbMode;
    if (mode === "walk" || mode === "drive" || mode === "taxi") return mode;
    return null;
  };

  // Track the most recently created stop so we can auto-expand it
  // in the picker on the next render after router.refresh resolves.
  const [pendingExpandUid, setPendingExpandUid] = useState<string | null>(null);
  useEffect(() => {
    if (!pendingExpandUid) return;
    // Reference the raw `stops` prop rather than sortedStops, which
    // is declared further down (hoisting issue). Either contains the
    // newly-created stop after router.refresh.
    if (stops.find((s) => s.id === pendingExpandUid)) {
      setExpandedUids((prev) => new Set(prev).add(pendingExpandUid));
      setPendingExpandUid(null);
    }
  }, [pendingExpandUid, stops]);

  // Insert a new appointment anchor at the given sequence. AddBetween
  // wraps this via the brief's UI pattern: a small dashed pill
  // between cards.
  const showTimingPicker = (sequence: number) => {
    setPendingInsertAt(sequence);
  };

  const handleInsertAnchorAt = (sequence: number, timingMode?: string) => {
    setPendingInsertAt(null);
    startTransition(async () => {
      setError(null);
      const result = await insertStopAt({
        itinerary_id: itinerary.id,
        sequence,
        type: "appointment",
        metadata: timingMode ? { timing_mode: timingMode } : undefined,
      });
      if (!result.ok) {
        setError(feedbackFromError(result.error).message);
        return;
      }
      setPendingExpandUid(result.value.id);
      router.refresh();
    });
  };

  // Insert a new stopover between two existing anchor stops.
  // 'stopover' stops are intent rows (no fixed time); the user picks
  // a place + ideal duration via the StopoverCard expanded mode.
  const handleInsertStopoverBetween = (
    fromStopId: string,
    toStopId: string,
  ) => {
    const toStop = sortedStops.find((s) => s.id === toStopId);
    if (!toStop) return;
    startTransition(async () => {
      setError(null);
      const result = await insertStopAt({
        itinerary_id: itinerary.id,
        sequence: toStop.sequence,
        type: "stopover",
        duration_minutes: 30,
        is_time_fixed: false,
        metadata: { kind: "stopover" },
      });
      if (!result.ok) {
        setError(feedbackFromError(result.error).message);
        return;
      }
      setPendingExpandUid(result.value.id);
      router.refresh();
    });
  };

  // Pull the uid out of any timeline item, regardless of kind.
  // Transit stops use the raw stop_id since they don't have an
  // anchor/stopover wrapper.
  const uidOf = (it: EditorTimelineItem): string =>
    it.kind === "anchor"
      ? it.anchor.uid
      : it.kind === "stopover"
        ? it.stopover.uid
        : it.stop.id;

  // Background prefetch: every adjacent leg in the planning timeline
  // (anchor↔anchor, anchor↔stopover, home↔anchor) that doesn't
  // already have a computed_duration_minutes gets a quiet 'drive'
  // estimate. Single batched call → one re-render when they all
  // settle, instead of N cascading re-renders as each resolves.
  useEffect(() => {
    // Find the start stop directly from the raw stops prop — `sortedStops`
    // is declared further down and would create a hoisting issue.
    const startStop = stops.find((s) => s.type === "start");
    const triples: Array<{
      fromStopId: string;
      toStopId: string;
      mode: "walk" | "drive" | "taxi";
    }> = [];
    const pairs: Array<{ from: { id: string }; to: { id: string } }> = [];
    if (startStop && planningTimeline[0]) {
      pairs.push({ from: startStop, to: planningTimeline[0].stop });
    }
    for (let i = 0; i < planningTimeline.length - 1; i++) {
      pairs.push({
        from: planningTimeline[i].stop,
        to: planningTimeline[i + 1].stop,
      });
    }
    // Also prefetch last transit → end stop (walk home from station)
    const endStop = stops.find((s) => s.type === "end") ?? startStop;
    const lastTransit = [...planningTimeline]
      .reverse()
      .find((it) => it.kind === "transit");
    if (lastTransit && endStop) {
      pairs.push({ from: lastTransit.stop, to: endStop });
    }
    // Fan out to all three scoreable modes per pair — the engine
    // returns 'resolving' if any candidate is still pending, so a
    // drive-only prefetch keeps the chip stuck on the spinner until
    // the user opens the popover (which triggers the per-pair
    // prefetch via prefetchPair). Loading all three up-front means
    // the chip face resolves immediately on first paint.
    for (const pair of pairs) {
      for (const mode of ["walk", "drive", "taxi"] as const) {
        triples.push({
          fromStopId: pair.from.id,
          toStopId: pair.to.id,
          mode,
        });
      }
    }
    if (triples.length > 0) {
      routePreviews.fetchPreviewsBatch(triples);
    }
    // routePreviews.fetchPreviewsBatch is stable (memoised inside).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planningTimeline, transitions, stops]);

  // editedAnchors holds the per-anchor in-flight patch while a card
  // is in expanded mode. We seed each entry from the DB anchor on
  // first expand; onChange writes here; clicking Done flushes the
  // accumulated patch through updateStop.
  const [editedAnchors, setEditedAnchors] = useState<Map<string, Anchor>>(
    () => new Map(),
  );
  const [expandedUids, setExpandedUids] = useState<Set<string>>(() => new Set());
  // Per-stopover in-flight edits, mirrors editedAnchors above. Click
  // Edit → seed local copy; onChange merges patches; click Done →
  // flush via updateStop.
  const [editedStopovers, setEditedStopovers] = useState<
    Map<string, Stopover>
  >(() => new Map());
  const planningDatePresets = useMemo(
    () => buildDatePresets(timezone),
    [timezone],
  );
  // Transitions keyed by `${fromStopId}::${toStopId}` for the
  // planning view, decoded from the same DbTransition[] the existing
  // primitive view uses.
  const planningTransitions = useMemo<Map<string, BriefTransition>>(
    () => transitionsFromDb(transitions),
    [transitions],
  );

  const legsByTransition = useMemo(() => {
    const m = new Map<string, JourneyLegRow[]>();
    for (const l of journeyLegs) {
      const arr = m.get(l.transition_id) ?? [];
      arr.push(l);
      m.set(l.transition_id, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.sequence - b.sequence);
    return m;
  }, [journeyLegs]);

  const sortedStops = useMemo(
    () => [...stops].sort((a, b) => a.sequence - b.sequence),
    [stops],
  );

  // Roll up feasibility flags across every adjacent pair of stops
  // whose transition has a computed duration. Drives the heads-up
  // callout above the timeline — tells the executive at a glance
  // which legs the day depends on getting right.
  const feasibilityRollup = useMemo(() => {
    const flagged: Array<{
      fromLabel: string;
      toLabel: string;
      severity: "tight" | "infeasible";
      message: string;
    }> = [];
    for (let i = 0; i < sortedStops.length - 1; i++) {
      const fromStop = sortedStops[i];
      const toStop = sortedStops[i + 1];
      const transition = transitionByFrom.get(fromStop.id);
      const flag = computeFeasibility(fromStop, toStop, transition);
      if (!flag) continue;
      flagged.push({
        fromLabel:
          fromStop.location?.name ??
          fromStop.customer_site?.name ??
          fromStop.title ??
          "stop",
        toLabel:
          toStop.location?.name ??
          toStop.customer_site?.name ??
          toStop.title ??
          "stop",
        severity: flag.severity,
        message: flag.message,
      });
    }
    return flagged;
  }, [sortedStops, transitionByFrom]);

  // The most recent prior place we could "return to" — i.e. the second-to-last
  // stop's place. Lets a user quickly close a hotel → expo → hotel hop without
  // re-typing the place.
  const returnToTarget = useMemo(() => {
    if (sortedStops.length < 2) return null;
    const last = sortedStops[sortedStops.length - 1];
    const prev = sortedStops[sortedStops.length - 2];
    // Don't offer "return to" if the last stop is already at the prev place.
    if (
      prev.location_id &&
      prev.location_id === last.location_id &&
      prev.customer_site_id === last.customer_site_id
    )
      return null;
    const label =
      prev.customer_site?.name ??
      prev.customer?.name ??
      prev.location?.name ??
      prev.title ??
      "previous place";
    return {
      label,
      location_id: prev.location_id,
      customer_id: prev.customer_id,
      customer_site_id: prev.customer_site_id,
    };
  }, [sortedStops]);

  const handleDelete = (stopId: string) => {
    if (!window.confirm("Delete this point?")) return;
    startTransition(async () => {
      setError(null);
      const stop = sortedStops.find((s) => s.id === stopId);
      const idsToDelete = [stopId];
      if (stop?.type === "transit_departure") {
        const seq = stop.sequence;
        for (const s of sortedStops) {
          if (s.id === stopId) continue;
          if (s.sequence > seq && (s.type === "transit_changeover" || s.type === "transit_arrival")) {
            idsToDelete.push(s.id);
            if (s.type === "transit_arrival") break;
          } else if (s.sequence > seq && s.type !== "transit_changeover") {
            break;
          }
        }
      }
      const result = await deleteStops(idsToDelete);
      if (!result.ok) {
        setError(feedbackFromError(result.error).message);
      }
      router.refresh();
    });
  };

  const handleSetMode = (transitionId: string, mode: TransitionMode) => {
    startTransition(async () => {
      setError(null);
      const result = await setTransitionMode({
        id: transitionId,
        mode,
      });
      if (!result.ok) {
        setError(feedbackFromError(result.error).message);
        return;
      }
      router.refresh();
    });
  };

  // Planning-view handlers ────────────────────────────────────────────
  //
  // Anchor edit flow:
  //   * onModeChange('expanded') copies the current DB-derived anchor
  //     into editedAnchors and adds the uid to expandedUids.
  //   * onChange(patch) merges the patch into editedAnchors.
  //   * onModeChange('summary') flushes the accumulated patch through
  //     updateStop and removes the uid from expandedUids.
  // This keeps changes optimistic-local while the user is editing,
  // and only writes once per Done click — quieter than autosaving.
  const handleAnchorExpand = (uid: string) => {
    const current =
      editedAnchors.get(uid) ?? planningAnchors.find((a) => a.uid === uid);
    if (!current) return;
    setEditedAnchors((prev) => {
      const next = new Map(prev);
      next.set(uid, current);
      return next;
    });
    setExpandedUids((prev) => new Set(prev).add(uid));
  };
  const handleAnchorCollapse = (uid: string) => {
    const edited = editedAnchors.get(uid);
    setExpandedUids((prev) => {
      const next = new Set(prev);
      next.delete(uid);
      return next;
    });
    if (!edited) return;
    // Fire the patch; clear the local copy regardless of outcome so
    // we re-derive from server state on the next refresh.
    const earlier = planningAnchors.slice(
      0,
      planningAnchors.findIndex((a) => a.uid === uid),
    );
    startTransition(async () => {
      setError(null);
      const result = await updateStop(
        anchorToStopUpdate(edited, timezone, earlier),
      );
      setEditedAnchors((prev) => {
        const next = new Map(prev);
        next.delete(uid);
        return next;
      });
      if (!result.ok) {
        setError(feedbackFromError(result.error).message);
        return;
      }
      router.refresh();
    });
  };
  const handleAnchorPatch = (uid: string, patch: Partial<Anchor>) => {
    setEditedAnchors((prev) => {
      const next = new Map(prev);
      const current = next.get(uid) ?? planningAnchors.find((a) => a.uid === uid);
      if (!current) return prev;
      next.set(uid, { ...current, ...patch });
      return next;
    });
  };

  // Stopover edit handlers — same shape as the anchor ones, but
  // operate on the timeline's stopover items instead of
  // planningAnchors. The flush path uses stopoverToStopUpdate, which
  // writes back to the same stops table (stopovers are stops since
  // migration 0014).
  const handleStopoverExpand = (uid: string) => {
    const fromTimeline = planningTimeline.find(
      (it) => it.kind === "stopover" && it.stopover.uid === uid,
    );
    if (!fromTimeline || fromTimeline.kind !== "stopover") return;
    const current =
      editedStopovers.get(uid) ?? {
        place: fromTimeline.stopover.place,
        durationMins: fromTimeline.stopover.durationMins,
      };
    setEditedStopovers((prev) => {
      const next = new Map(prev);
      next.set(uid, current);
      return next;
    });
    setExpandedUids((prev) => new Set(prev).add(uid));
  };
  const handleStopoverCollapse = (uid: string) => {
    const edited = editedStopovers.get(uid);
    setExpandedUids((prev) => {
      const next = new Set(prev);
      next.delete(uid);
      return next;
    });
    if (!edited) return;
    startTransition(async () => {
      setError(null);
      const result = await updateStop(stopoverToStopUpdate(edited, uid));
      setEditedStopovers((prev) => {
        const next = new Map(prev);
        next.delete(uid);
        return next;
      });
      if (!result.ok) {
        setError(feedbackFromError(result.error).message);
        return;
      }
      router.refresh();
    });
  };
  const handleStopoverPatch = (uid: string, patch: Partial<Stopover>) => {
    setEditedStopovers((prev) => {
      const next = new Map(prev);
      const current = next.get(uid)
        ?? (planningTimeline.find((it) => it.kind === "stopover" && it.stopover.uid === uid) as any)?.stopover;
      if (!current) return prev;
      next.set(uid, { ...current, ...patch });
      return next;
    });
  };

  // Transition patches: route through the existing server actions.
  // When the leg has no transition row yet — which is the common case
  // for itineraries built via the brief, since the brief only writes
  // 'meaningful' transitions and skips anything left on auto — we
  // upsert one so the user's choice actually persists. Auto / mixed
  // are sentinels with no DB mode, so they fall through to a clear-
  // out via deleteTransition when an existing row needs unsetting.
  const handleTransitionPatch = (
    fromStopId: string,
    toStopId: string,
    patch: Partial<BriefTransition>,
  ) => {
    const existing = transitions.find(
      (t) => t.from_stop_id === fromStopId && t.to_stop_id === toStopId,
    );
    if (patch.mode === undefined) {
      // Booked toggle / booking detail changes — out of scope for the
      // mode picker fast-path; the TransitionRow's full booking UI is
      // a follow-up (see the booking-modal direction question).
      return;
    }
    if (patch.mode === "mixed") {
      // User cleared the mode. If a transition row exists we can
      // either leave it as 'mixed' (the schema's catch-all) or no-op.
      // Pragmatic call: leave it untouched — clearing is rare and
      // the existing row is harmless.
      return;
    }
    if (existing) {
      handleSetMode(existing.id, patch.mode);
      return;
    }
    // No row yet — upsert one. The server's upsertTransition also
    // fires routeForTransition + resolveItineraryTimes, so the
    // computed_duration_minutes shows up on the next refresh.
    // Re-narrow mode for the server schema, which doesn't accept the
    // brief's 'auto' sentinel (already filtered above).
    const newMode = patch.mode as TransitionMode;
    startTransition(async () => {
      setError(null);
      const result = await upsertTransition({
        itinerary_id: itinerary.id,
        from_stop_id: fromStopId,
        to_stop_id: toStopId,
        mode: newMode,
      });
      if (!result.ok) {
        setError(feedbackFromError(result.error).message);
        return;
      }
      router.refresh();
    });
  };

  const handleAdvanceStatus = () => {
    const next: ItineraryStatus | null =
      // Legacy draft rows fold straight into planning, same as any
      // brief submit would today.
      itinerary.status === "draft"
        ? "planning"
        : itinerary.status === "planning"
          ? "planned"
          : itinerary.status === "planned"
            ? "in_progress"
            : itinerary.status === "in_progress"
              ? "completed"
              : null;
    if (!next) return;
    if (!window.confirm(`Move itinerary to "${next}"?`)) return;
    startTransition(async () => {
      setError(null);
      const result = await transitionItineraryStatus(itinerary.id, next);
      if (!result.ok) {
        setError(feedbackFromError(result.error).message);
        return;
      }
      router.refresh();
    });
  };

  // ------------------------------------------------------------------
  // Derived data for the editorial masthead + digest panel
  // ------------------------------------------------------------------

  // Primary "subject" of the itinerary: pull customer / customer-site
  // from the first appointment we find. Falls back to itinerary.title.
  const subject = useMemo(() => {
    const appt = sortedStops.find(
      (s) => s.type === "appointment" && (s.customer?.name || s.customer_site?.name),
    );
    const customerName = appt?.customer?.name ?? null;
    const siteName = appt?.customer_site?.name ?? null;
    const siteAddress = appt?.customer_site?.address ?? null;
    // Try to extract a "city · region" from the site address tail.
    let placePart: string | null = null;
    if (siteAddress) {
      const parts = siteAddress.split(",").map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        // Last two parts (e.g. "Belper", "Derbyshire") — drop postcode-y ones.
        const tail = parts.slice(-2).filter((p) => !/^[A-Z]{1,2}\d/.test(p));
        placePart = tail.join(" · ") || null;
      } else if (parts[0]) {
        placePart = parts[0];
      }
    }
    return { customerName, siteName, placePart };
  }, [sortedStops]);

  // Tally totals from transitions
  const totalMinutes = useMemo(
    () =>
      transitions.reduce(
        (sum, t) => sum + (Number(t.computed_duration_minutes) || 0),
        0,
      ),
    [transitions],
  );
  const totalMiles = useMemo(() => {
    const dbMiles = transitions.reduce(
      (sum, t) => sum + (Number(t.distance_miles) || 0),
      0,
    );
    if (dbMiles > 5) return dbMiles;
    // Fallback: haversine sum between consecutive stops with coordinates
    let miles = 0;
    for (let i = 0; i < sortedStops.length - 1; i++) {
      const a = sortedStops[i];
      const b = sortedStops[i + 1];
      const aLat = a.customer_site?.latitude ?? a.location?.latitude ?? (a as any).transport_hub?.latitude;
      const aLng = a.customer_site?.longitude ?? a.location?.longitude ?? (a as any).transport_hub?.longitude;
      const bLat = b.customer_site?.latitude ?? b.location?.latitude ?? (b as any).transport_hub?.latitude;
      const bLng = b.customer_site?.longitude ?? b.location?.longitude ?? (b as any).transport_hub?.longitude;
      if (aLat != null && aLng != null && bLat != null && bLng != null) {
        miles += haversine(Number(aLat), Number(aLng), Number(bLat), Number(bLng));
      }
    }
    return miles;
  }, [transitions, sortedStops]);
  const stopCount = useMemo(
    () =>
      sortedStops.filter(
        (s) => s.type !== "start" && s.type !== "end",
      ).length,
    [sortedStops],
  );

  // On-site window — first / last appointment times
  const onSiteWindow = useMemo(() => {
    const appts = sortedStops.filter((s) => s.type === "appointment");
    if (appts.length === 0) return null;
    const first = appts[0].start_time;
    const last =
      appts[appts.length - 1].end_time ?? appts[appts.length - 1].start_time;
    return { from: first, to: last };
  }, [sortedStops]);

  // Map URL — markers from stops w/ coords + paths from transition polylines.
  // Coordinates come from customer_site → location.
  const mapStops = useMemo(() => {
    const seen = new Set<string>();
    const out: Array<{ lat: number; lng: number; label: string; code?: string; role: "home" | "transit" | "site" }> = [];
    sortedStops.forEach((s) => {
      const lat =
        s.customer_site?.latitude ?? s.location?.latitude ?? (s as any).transport_hub?.latitude ?? null;
      const lng =
        s.customer_site?.longitude ?? s.location?.longitude ?? (s as any).transport_hub?.longitude ?? null;
      if (lat == null || lng == null) return;
      const coordKey = `${Number(lat).toFixed(4)},${Number(lng).toFixed(4)}`;
      if (seen.has(coordKey)) return;
      seen.add(coordKey);
      const name = s.title ?? s.location?.name ?? (s as any).transport_hub?.name ?? "";
      const hubCode = (s as any).transport_hub?.code as string | undefined;
      const isHome = s.type === "start" || s.type === "end";
      const sType = s.type as string;
      const isTransit = sType === "transit_departure" || sType === "transit_arrival" || sType === "transit_changeover";
      out.push({
        lat: Number(lat),
        lng: Number(lng),
        label: name,
        code: isHome ? undefined : isTransit ? (hubCode ?? name.slice(0, 3).toUpperCase()) : "SITE",
        role: isHome ? "home" : isTransit ? "transit" : "site",
      });
    });
    return out;
  }, [sortedStops]);

  const mapSegments = useMemo(() => {
    const segs: Array<{ type: "encoded"; polyline: string }> = [];
    for (const t of transitions) {
      if (t.overview_polyline) {
        segs.push({ type: "encoded", polyline: t.overview_polyline });
      }
    }
    return segs;
  }, [transitions]);

  // Build a Journey object for the JourneyMap component. Converts the
  // existing stops + transitions into the component's domain types.
  const journeyMapData = useMemo<Journey>(() => {
    const legs: Leg[] = [];

    if (sortedStops.length >= 2) {
    for (let i = 0; i < sortedStops.length - 1; i++) {
      const fromStop = sortedStops[i];
      const toStop = sortedStops[i + 1];
      const transition = transitionByFrom.get(fromStop.id);
      if (!transition) continue;

      // Extract coordinates for from/to
      const fromLat = Number(
        fromStop.customer_site?.latitude ??
        fromStop.location?.latitude ??
        (fromStop as any).transport_hub?.latitude ?? 0,
      );
      const fromLng = Number(
        fromStop.customer_site?.longitude ??
        fromStop.location?.longitude ??
        (fromStop as any).transport_hub?.longitude ?? 0,
      );
      const toLat = Number(
        toStop.customer_site?.latitude ??
        toStop.location?.latitude ??
        (toStop as any).transport_hub?.latitude ?? 0,
      );
      const toLng = Number(
        toStop.customer_site?.longitude ??
        toStop.location?.longitude ??
        (toStop as any).transport_hub?.longitude ?? 0,
      );

      // Skip legs with no coordinates on either end
      if (fromLat === 0 && fromLng === 0) continue;
      if (toLat === 0 && toLng === 0) continue;

      const fromStation: Station = {
        name: fromStop.title ?? fromStop.location?.name ?? (fromStop as any).transport_hub?.name ?? "",
        code: (fromStop as any).transport_hub?.code ?? undefined,
        lat: fromLat,
        lng: fromLng,
      };

      const toStation: Station = {
        name: toStop.title ?? toStop.location?.name ?? (toStop as any).transport_hub?.name ?? "",
        code: (toStop as any).transport_hub?.code ?? undefined,
        lat: toLat,
        lng: toLng,
      };

      // Decode the polyline track, or fall back to a straight line
      let track: [number, number][];
      if (transition.overview_polyline) {
        track = decodePolyline(transition.overview_polyline);
      } else {
        track = [[fromLat, fromLng], [toLat, toLng]];
      }

      // Map DB mode to JourneyMap leg mode
      const modeMap: Record<string, LegMode> = {
        walk: "walk",
        drive: "road",
        taxi: "road",
        train: "rail",
        bus: "transit",
        mixed: "road",
        cycle: "road",
      };
      const legMode: LegMode = modeMap[transition.mode] ?? "road";

      const durationMins = transition.computed_duration_minutes ?? 0;
      const durationLabel = durationMins > 0 ? fmtDuration(durationMins) : "";

      // Extract calling points from stop metadata as map waypoints
      const meta = fromStop.metadata as Record<string, unknown> | null;
      const rawCps = meta?.calling_points;
      const waypoints: Station[] = [];
      if (Array.isArray(rawCps)) {
        for (const cp of rawCps) {
          const cpLat = Number(cp.lat);
          const cpLng = Number(cp.lng);
          if (cpLat && cpLng) {
            waypoints.push({
              name: cp.station ?? "",
              code: cp.station_code ?? undefined,
              lat: cpLat,
              lng: cpLng,
            });
          }
        }
      }

      legs.push({
        mode: legMode,
        from: fromStation,
        to: toStation,
        track,
        durationLabel,
        durationMinutes: durationMins || undefined,
        ...(waypoints.length > 0 ? { waypoints } : {}),
      });
    }
    } // close sortedStops.length >= 2

    return {
      id: itinerary.id,
      eyebrow: `${formatDate(itinerary.date_start, timezone, { weekday: "long" }).toUpperCase()} / DOOR TO DOOR`,
      totalDistanceMi: totalMiles,
      totalDurationLabel: fmtDuration(totalMinutes),
      legs,
    };
  }, [sortedStops, transitionByFrom, itinerary.id, itinerary.date_start, timezone, totalMiles, totalMinutes]);

  const currentStatusIndex = STATUS_FLOW.indexOf(itinerary.status);
  const canAdvance =
    itinerary.status !== "completed" &&
    itinerary.status !== "cancelled" &&
    currentStatusIndex >= 0 &&
    currentStatusIndex < STATUS_FLOW.length - 1;
  const nextStatus =
    canAdvance ? STATUS_FLOW[currentStatusIndex + 1] : null;

  const dateLabel = formatDate(itinerary.date_start, timezone, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const dateNumeric = formatDate(itinerary.date_start, timezone, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div>
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-7">
        <FormError message={error ?? undefined} />

        {/* ── Eyebrow: back link + status flow ───────────────────────── */}
        <div className="eyebrow-row">
          <Link
            href="/itineraries"
            className="action-link"
            style={{ padding: 0 }}
          >
            {Icon.back}
            <span>All itineraries</span>
          </Link>
          <span className="eyebrow-rule" />
          <div className="statusflow">
            {STATUS_FLOW.map((s, i) => {
              const state =
                i < currentStatusIndex
                  ? "past"
                  : i === currentStatusIndex
                    ? "current"
                    : "future";
              return (
                <span key={s} className="contents">
                  <span
                    className="statusflow-step"
                    data-state={state}
                  >
                    {STATUS_LABEL[s]}
                  </span>
                  {i < STATUS_FLOW.length - 1 ? (
                    <span className="statusflow-sep">›</span>
                  ) : null}
                </span>
              );
            })}
          </div>
        </div>

        {/* ── Masthead: headline + standfirst + stat columns ─────────── */}
        <section className="grid grid-cols-1 gap-8 lg:grid-cols-[1.4fr_1fr] lg:gap-12">
          <div className="flex flex-col gap-4">
            {editingMasthead ? (
              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  className="masthead-title-input"
                  value={mastheadTitle}
                  onChange={(e) => setMastheadTitle(e.target.value)}
                  placeholder="Trip title"
                  style={{
                    fontFamily: "var(--display)",
                    fontSize: 28,
                    fontWeight: 500,
                    fontStyle: "italic",
                    color: "var(--ink)",
                    background: "transparent",
                    border: "none",
                    borderBottom: "1px solid var(--rule)",
                    outline: "none",
                    padding: "4px 0",
                    width: "100%",
                  }}
                />
                <div className="flex gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="uc" style={{ fontSize: 9 }}>Start date</label>
                    <input
                      type="date"
                      value={mastheadDateStart}
                      onChange={(e) => setMastheadDateStart(e.target.value)}
                      className="brief-input"
                      style={{ fontSize: 13 }}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="uc" style={{ fontSize: 9 }}>End date</label>
                    <input
                      type="date"
                      value={mastheadDateEnd}
                      onChange={(e) => setMastheadDateEnd(e.target.value)}
                      className="brief-input"
                      style={{ fontSize: 13 }}
                    />
                  </div>
                </div>
                <textarea
                  value={mastheadNotes}
                  onChange={(e) => setMastheadNotes(e.target.value)}
                  placeholder="Trip notes (optional)"
                  rows={2}
                  className="brief-input"
                  style={{ fontSize: 13, resize: "vertical" }}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ fontSize: 12, padding: "6px 14px" }}
                    onClick={saveMasthead}
                    disabled={pending}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ fontSize: 12 }}
                    onClick={() => {
                      setEditingMasthead(false);
                      setMastheadTitle(itinerary.title ?? "");
                      setMastheadNotes(itinerary.notes ?? "");
                      setMastheadDateStart(itinerary.date_start);
                      setMastheadDateEnd(itinerary.date_end);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h1
                  className="masthead-title"
                  style={{ cursor: "pointer" }}
                  onClick={() => setEditingMasthead(true)}
                  title="Click to edit title, dates, and notes"
                >
                  <MastheadHeadline
                    customerName={subject.customerName}
                    placePart={subject.placePart}
                    fallback={itinerary.title}
                    date={dateLabel}
                  />
                </h1>
                {itinerary.notes ? (
                  <p
                    className="standfirst"
                    style={{ cursor: "pointer" }}
                    onClick={() => setEditingMasthead(true)}
                  >
                    {itinerary.notes}
                  </p>
                ) : null}
              </>
            )}
          </div>

          <div className="flex items-end justify-start gap-6 lg:justify-end">
            <div className="stat-col">
              <span className="v">{stopCount}</span>
              <span className="l">{stopCount === 1 ? "stop" : "stops"}</span>
            </div>
            <div className="stat-col">
              <span className="v">{Math.round(totalMiles)}</span>
              <span className="l">miles</span>
            </div>
            <div className="stat-col">
              <span className="v">{fmtDuration(totalMinutes)}</span>
              <span className="l">time</span>
            </div>
            {totals.cost > 0 ? (
              <div className="stat-col">
                <span className="v">{fmtCurrency(totals.cost, totals.currency)}</span>
                <span className="l">cost</span>
              </div>
            ) : null}
          </div>
        </section>

        {/* ── Primary action row ─────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3">
          {nextStatus ? (
            <button
              type="button"
              onClick={handleAdvanceStatus}
              disabled={pending}
              className="btn-primary"
            >
              Advance to {STATUS_LABEL[nextStatus].toLowerCase()}
              {Icon.arrow}
            </button>
          ) : null}
          <button
            type="button"
            className="btn-ghost"
            style={{ fontSize: 13 }}
            onClick={() => setEditingTransport(emptyTransportBookingItem())}
          >
            + Booked transport
          </button>
          <button
            type="button"
            className="btn-ghost"
            style={{ fontSize: 13 }}
            onClick={() => setShowAddAccommodation(true)}
          >
            + Hotel booking
          </button>
          {gmailConnected ? (
            <>
              <button
                type="button"
                className="btn-ghost"
                style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}
                onClick={() => setGmailImportOpen(true)}
              >
                {Icon.ticket}
                Scan for tickets
              </button>
              <button
                type="button"
                className="btn-ghost"
                style={{ fontSize: 12 }}
                onClick={() => {
                  startTransition(async () => {
                    setError(null);
                    const result = await reEnrichItineraryFromGmail(itinerary.id);
                    if (!result.ok) {
                      setError(feedbackFromError(result.error).message);
                      return;
                    }
                    await backfillRailPolylines(itinerary.id, true);
                    router.refresh();
                  });
                }}
              >
                Refresh ticket details
              </button>
            </>
          ) : null}
          <span style={{ marginLeft: "auto" }}>
            <DeleteItineraryButton
              id={itinerary.id}
              title={itinerary.title ?? "this itinerary"}
              redirectTo="/itineraries"
            />
          </span>
        </div>

        {feasibilityRollup.length > 0 ? (
          <FeasibilityCallout flags={feasibilityRollup} />
        ) : null}

        {/* ── Two-column body: timeline + map/digest sidebar ─────────── */}
        <div className="editor-grid">
          {/* Left: day header + stops timeline */}
          <div className="flex flex-col">
            <div className="day-header">
              <span className="label">Day 1</span>
              <span className="title">{dateLabel.split(",")[0]}</span>
              <span className="meta">{dateNumeric}</span>
            </div>

            {/* Implicit home row. The 'start' stop is auto-seeded
                from the travel profile and filtered out of the
                editable timeline; we still surface it here so the
                trip reads as a journey, not an isolated list of
                appointments. The TransitionRow below it gives the
                user somewhere to set the home → first-anchor
                travel mode. */}
            {(() => {
              const startStop = sortedStops.find((s) => s.type === "start");
              if (!startStop) return null;
              const label =
                startStop.location?.name ?? startStop.title ?? "Home";
              const address = startStop.location?.address ?? null;
              const first = planningTimeline[0];

              // Leave-by: first transit departure minus travel to station
              let leaveBy: string | null = null;
              if (first?.kind === "transit" && first.stop.start_time) {
                const depMin = (() => {
                  const d = new Date(first.stop.start_time!);
                  const parts = new Intl.DateTimeFormat("en-GB", {
                    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: timezone,
                  }).formatToParts(d);
                  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
                  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
                  return h * 60 + m;
                })();
                const travelTrans = transitions.find(
                  (t) => t.from_stop_id === startStop.id && t.to_stop_id === first.stop.id,
                );
                let travelMin = travelTrans?.computed_duration_minutes ?? 0;
                if (!travelMin) {
                  const mode = travelTrans?.mode ?? "walk";
                  const preview = routePreviews.get(startStop.id, first.stop.id, mode as any);
                  if (preview && preview !== "pending" && preview.durationMinutes) {
                    travelMin = preview.durationMinutes;
                  }
                }
                const leaveMin = depMin - travelMin - 10;
                if (leaveMin > 0) {
                  const lh = Math.floor(leaveMin / 60) % 24;
                  const lm = leaveMin % 60;
                  leaveBy = `${String(lh).padStart(2, "0")}:${String(lm).padStart(2, "0")}`;
                }
              }

              return (
                <>
                  <div className="home-header">
                    <div className="home-header-badge">
                      <span className="home-header-dot" aria-hidden />
                      <span className="uc">Home</span>
                    </div>
                    <h3 className="home-header-title">{address ?? label}</h3>
                    {leaveBy ? (
                      <p className="home-header-meta mono" style={{ color: "var(--gold-2)" }}>
                        Leave by {leaveBy}
                      </p>
                    ) : (
                      <p className="home-header-meta">From your travel profile</p>
                    )}
                  </div>
                  {first && first.kind !== "transit" ? (
                    <PlanningTransitionRow
                      from={null}
                      to={
                        first.kind === "anchor"
                          ? first.anchor
                          : stopoverAsAnchor(
                              first.stopover,
                              first.stopover.uid,
                            )
                      }
                      transition={
                        planningTransitions.get(
                          transitionKey(
                            startStop.id,
                            uidOf(first),
                          ),
                        ) ?? emptyTransition()
                      }
                      modePreviews={previewsForPair(
                        startStop.id,
                        uidOf(first),
                      )}
                      onOpenChange={(open) => {
                        if (open)
                          prefetchPair(
                            startStop.id,
                            uidOf(first),
                          );
                      }}
                      onChange={(patch) =>
                        handleTransitionPatch(
                          startStop.id,
                          uidOf(first),
                          patch,
                        )
                      }
                      fromVirtualLabel={label}
                    />
                  ) : null}
                  {first && first.kind === "anchor" ? (
                    <div className="anchor-inline-adds">
                      <AddBetween between onAdd={() => showTimingPicker(first.stop.sequence)} />
                    </div>
                  ) : null}
                </>
              );
            })()}

            {planningTimeline.length === 0 ? (
              <div className="j-card-soft mt-4 p-6 text-center">
                <p className="body mb-2">
                  No points yet. Add your first point — usually home.
                </p>
              </div>
            ) : (
              <Timeline
                entries={buildPlanningTimeline({
                  planningTimeline,
                  planningAnchors,
                  sortedStops,
                  transitions,
                  planningTransitions,
                  transitionByFrom,
                  expandedUids,
                  editedAnchors,
                  editedStopovers: editedStopovers as Map<string, Stopover & { uid: string }>,
                  timezone,
                  previewsForPair,
                  gapPreviewsForPair,
                  onSetGapMode: (fromId: string, toId: string, mode: import("@/components/gap-mode-picker").GapMode) =>
                    handleSetGapMode(fromId, toId, mode),
                  getGapModeSelected,
                  computeStopoverBackCalc,
                  computeFeasibility,
                  routePreviews,
                  handlers: {
                    handleAnchorExpand,
                    handleAnchorCollapse,
                    handleAnchorPatch,
                    handleStopoverExpand,
                    handleStopoverCollapse,
                    handleStopoverPatch,
                    handleDelete,
                    handleTransitionPatch,
                    prefetchPair,
                    handleInsertAnchorAt: showTimingPicker,
                    handleInsertStopoverBetween,
                  },
                  startStop: sortedStops.find((s) => s.type === "start") ?? null,
                })}
                customers={customers}
                customerSites={customerSites}
                locations={locations}
                datePresets={planningDatePresets}
                timezone={timezone}
              />
            )}


            {(() => {
              const last = sortedStops[sortedStops.length - 1];
              const seq = last ? (last.sequence ?? -1) + 1 : 0;
              return (
                <div className="anchor-inline-adds">
                  {pendingInsertAt === seq ? (
                    <TimingModePicker
                      onPick={(mode) => handleInsertAnchorAt(seq, mode)}
                      onCancel={() => setPendingInsertAt(null)}
                    />
                  ) : (
                    <AddBetween onAdd={() => setPendingInsertAt(seq)} />
                  )}
                </div>
              );
            })()}
          </div>

          {/* Right: map + day digest */}
          <aside className="flex flex-col gap-5">
            <div className={`route-map-card${mapExpanded ? " map-expanded" : ""}`}>
              <div className="route-map-header">
                <span className="route-map-eyebrow">Door-to-door</span>
                <span className="route-map-headline">
                  {totalMiles > 0 || totalMinutes > 0 ? (
                    <>
                      {totalMiles > 0 && <>{Math.round(totalMiles)} mi</>}
                      {totalMiles > 0 && totalMinutes > 0 && " · "}
                      {totalMinutes > 0 && <>{fmtDuration(totalMinutes)}</>}
                    </>
                  ) : (
                    <span style={{ color: "var(--ink-faint)", fontStyle: "italic" }}>Add stops to see your route</span>
                  )}
                </span>
                <button
                  type="button"
                  className="map-expand-btn"
                  onClick={() => setMapExpanded((v) => !v)}
                  title={mapExpanded ? "Collapse map" : "Expand map"}
                >
                  {mapExpanded ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M10 2v4h4M2 10h4v4M14 2l-4 4M2 14l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M10 2v4h4M2 10h4v4M6 6L2 2M10 10l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  )}
                </button>
              </div>
              <div style={{ borderRadius: "0 0 12px 12px", overflow: "hidden", flex: mapExpanded ? 1 : undefined, position: "relative" }}>
                <JourneyMap
                  journey={journeyMapData}
                  mode="planning"
                  height={mapExpanded ? undefined : 320}
                />
                {journeyMapData.legs.length === 0 && (
                  <div style={{
                    position: "absolute", inset: 0, display: "flex",
                    alignItems: "center", justifyContent: "center",
                    background: "var(--card)", opacity: 0.85,
                    pointerEvents: "none",
                  }}>
                    <p className="serif-i" style={{ color: "var(--ink-dim)", fontSize: 15, textAlign: "center", padding: "0 24px" }}>
                      Add stops with locations to see your route on the map
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="digest-panel">
              <div className="h">Day · digest</div>
              {totalMinutes === 0 && totalMiles === 0 && (!onSiteWindow || !onSiteWindow.from) ? (
                <p style={{ fontSize: 12, color: "var(--ink-faint)", fontStyle: "italic", margin: "8px 0 0" }}>
                  Stats appear as you add stops and connections
                </p>
              ) : (
                <>
                  {onSiteWindow ? (
                    <div className="row">
                      <span className="l">On-site window</span>
                      <span className="v">
                        {fmtTime(onSiteWindow.from, timezone)}
                        {onSiteWindow.to && onSiteWindow.to !== onSiteWindow.from
                          ? ` – ${fmtTime(onSiteWindow.to, timezone)}`
                          : ""}
                      </span>
                    </div>
                  ) : null}
                  <div className="row">
                    <span className="l">Travel time</span>
                    <span className="v">{fmtDuration(totalMinutes)}</span>
                  </div>
                  <div className="row">
                    <span className="l">Distance</span>
                    <span className="v">{totalMiles.toFixed(1)} mi</span>
                  </div>
                  {totals.cost > 0 ? (
                    <div className="row total">
                      <span className="l">Costs</span>
                      <span className="v">
                        {fmtCurrency(totals.cost, totals.currency)}
                      </span>
                    </div>
                  ) : (
                    <div className="row">
                      <span className="l">Costs</span>
                      <span className="v" style={{ color: "var(--ink-faint)" }}>
                        —
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </aside>
        </div>

        {/* Booking modal — accommodation */}
        {accommodationBookingFor ? (
          <div
            className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-ink/35 p-4 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) setAccommodationBookingFor(null);
            }}
          >
            <div className="my-8 w-full max-w-3xl">
              <AddAccommodationBookingForm
                afterStopId={accommodationBookingFor.afterStopId}
                afterStopLabel={accommodationBookingFor.afterStopLabel}
                existingStopId={accommodationBookingFor.existingStopId}
                customers={customers}
                customerSites={customerSites}
                locations={locations}
                onCancel={() => setAccommodationBookingFor(null)}
                onDone={() => {
                  setAccommodationBookingFor(null);
                  router.refresh();
                }}
              />
            </div>
          </div>
        ) : null}

        {/* Timing mode picker for mid-timeline inserts */}
        {pendingInsertAt !== null && pendingInsertAt !== (sortedStops[sortedStops.length - 1]?.sequence ?? -1) + 1 ? (
          <div
            className="fixed inset-0 z-30 flex items-center justify-center bg-ink/20 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setPendingInsertAt(null); }}
          >
            <div style={{ width: "100%", maxWidth: 360 }}>
              <TimingModePicker
                onPick={(mode) => handleInsertAnchorAt(pendingInsertAt, mode)}
                onCancel={() => setPendingInsertAt(null)}
              />
            </div>
          </div>
        ) : null}

        {/* Gmail import panel */}
        {gmailImportOpen ? (
          <GmailImportPanel
            itineraryId={itinerary.id}
            lastStopId={
              stops.length > 0 ? stops[stops.length - 1].id : null
            }
            lastStopLabel={
              stops.length > 0
                ? (stops[stops.length - 1].location?.name ??
                  stops[stops.length - 1].title ??
                  "last stop")
                : "itinerary"
            }
            onClose={() => setGmailImportOpen(false)}
            onImported={() => router.refresh()}
          />
        ) : null}

        {editingTransport ? (
          <div
            className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-ink/35 p-4 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) setEditingTransport(null);
            }}
          >
            <div className="my-8 w-full max-w-2xl">
              <TransportBookingCard
                booking={editingTransport}
                onChange={handleTransportCardChange}
                onRemove={() => setEditingTransport(null)}
              />
            </div>
          </div>
        ) : null}

        {/* Standalone accommodation booking */}
        {showAddAccommodation ? (
          <div
            className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-ink/35 p-4 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowAddAccommodation(false);
            }}
          >
            <div className="my-8 w-full max-w-2xl">
              <AddAccommodationBookingForm
                afterStopId={sortedStops[sortedStops.length - 1]?.id}
                afterStopLabel={sortedStops[sortedStops.length - 1]?.title ?? "your last stop"}
                customers={customers}
                customerSites={customerSites}
                locations={locations}
                onCancel={() => setShowAddAccommodation(false)}
                onDone={() => {
                  setShowAddAccommodation(false);
                  router.refresh();
                }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TimingModePicker({
  onPick,
  onCancel,
}: {
  onPick: (mode: string) => void;
  onCancel: () => void;
}) {
  const options = [
    { mode: "arrive_by", label: "I need to be there by...", icon: ">" },
    { mode: "leave_by", label: "I need to leave by...", icon: "<" },
    { mode: "around_then", label: "I'll be there around...", icon: "~" },
    { mode: "maximize", label: "As long as possible", icon: "+" },
  ];
  return (
    <div className="timing-picker" style={{
      display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6,
      padding: 12, background: "var(--card)", border: "1px solid var(--rule)",
      borderRadius: 10,
    }}>
      {options.map((o) => (
        <button
          key={o.mode}
          type="button"
          onClick={() => onPick(o.mode)}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 12px", borderRadius: 8,
            border: "1px solid var(--rule)", background: "var(--card-2)",
            cursor: "pointer", fontSize: 12, color: "var(--ink)",
            fontFamily: "var(--sans)", textAlign: "left",
            transition: "border-color 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--gold)")}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--rule)")}
        >
          <span style={{
            width: 24, height: 24, borderRadius: "50%",
            background: "var(--gold-2)", color: "var(--gold)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 600, flexShrink: 0,
          }}>
            {o.icon}
          </span>
          <span>{o.label}</span>
        </button>
      ))}
      <button
        type="button"
        onClick={onCancel}
        style={{
          gridColumn: "1 / -1", padding: "6px 0", fontSize: 11,
          color: "var(--ink-faint)", background: "none", border: "none",
          cursor: "pointer",
        }}
      >
        Cancel
      </button>
    </div>
  );
}

function MastheadHeadline({
  customerName,
  placePart,
  fallback,
  date,
}: {
  customerName: string | null;
  placePart: string | null;
  fallback: string | null;
  date: string;
}) {
  if (customerName) {
    return (
      <>
        <em>{customerName}</em>
        {placePart ? (
          <>
            <span style={{ color: "var(--ink)" }}>,</span>{" "}
            <span style={{ color: "var(--ink)" }}>{placePart}.</span>
          </>
        ) : (
          <span style={{ color: "var(--ink)" }}>.</span>
        )}
      </>
    );
  }
  if (fallback) {
    return <>{fallback}</>;
  }
  return <em>{date}</em>;
}


// Heads-up callout — shown above the timeline whenever any leg
// arrives late or runs tight under its current mode + travel time.
// Lists each flagged leg by anchor name. Disappears on its own as
// the user fixes the issues; no dismiss button — this is signal,
// not noise.
function FeasibilityCallout({
  flags,
}: {
  flags: Array<{
    fromLabel: string;
    toLabel: string;
    severity: "tight" | "infeasible";
    message: string;
  }>;
}) {
  const hasLate = flags.some((f) => f.severity === "infeasible");
  return (
    <aside
      className={
        hasLate
          ? "feasibility-callout feasibility-callout-bad"
          : "feasibility-callout feasibility-callout-tight"
      }
      aria-live="polite"
    >
      <div className="feasibility-callout-head">
        <span className="uc">Heads up</span>
        <span className="feasibility-callout-count">
          {hasLate
            ? `${flags.filter((f) => f.severity === "infeasible").length} leg${flags.filter((f) => f.severity === "infeasible").length === 1 ? "" : "s"} won't make it`
            : `${flags.length} leg${flags.length === 1 ? "" : "s"} running tight`}
        </span>
      </div>
      <ul className="feasibility-callout-list">
        {flags.map((f, i) => (
          <li key={i}>
            <span className="feasibility-callout-route">
              {f.fromLabel} → {f.toLabel}
            </span>
            <span
              className={
                f.severity === "infeasible"
                  ? "feasibility-flag feasibility-flag-bad"
                  : "feasibility-flag feasibility-flag-tight"
              }
            >
              {f.message}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

// Feasibility derivation — purely from the loaded data. When two
// adjacent stops both have fixed times AND the transition between
// them has a computed travel duration, we ask the shared
// checkLegFeasibility helper whether the executive arrives on time.
// The display is intentionally soft (an inline badge, no modal) —
// it's a heads-up, not a blocker.
type FeasibilityFlag = {
  severity: "tight" | "infeasible";
  message: string;
};

// Structural shape we actually need — both StopRow (the editor's
// richer fetch) and DbStop (the shared mapper's view) satisfy it.
type FeasibilityStop = {
  is_time_fixed: boolean;
  start_time: string | null;
  end_time: string | null;
};

// Stopover back-calc: given the anchors on either side and the
// transitions in/out, derive when the user can actually arrive at the
// stopover and how long they have. Two travel durations + two pinned
// times collapse to a window; the ideal duration on the stopover
// itself decides whether it fits.
function computeStopoverBackCalc(
  prevStop: FeasibilityStop | undefined,
  nextStop: FeasibilityStop | undefined,
  legIn: TransitionRow | null | undefined,
  legOut: TransitionRow | null | undefined,
  idealDurationMinutes: number,
  timezone: string,
  // Optional fallback durations from the route preview cache —
  // useful when the user hasn't yet picked a mode for either leg
  // (so transitions.computed_duration_minutes is null) but we have
  // a 'drive' preview cached on the client. Without this fallback
  // the card stays mute until the user touches both legs, which
  // misses most of the back-calc's value.
  legInFallbackMinutes?: number | null,
  legOutFallbackMinutes?: number | null,
): StopoverBackCalc {
  const inMins =
    legIn?.computed_duration_minutes ?? legInFallbackMinutes ?? null;
  const outMins =
    legOut?.computed_duration_minutes ?? legOutFallbackMinutes ?? null;
  if (
    !prevStop?.is_time_fixed ||
    !nextStop?.is_time_fixed ||
    !prevStop.end_time ||
    !nextStop.start_time ||
    inMins == null ||
    outMins == null
  ) {
    return { status: "unknown" };
  }
  const fromEnd = new Date(prevStop.end_time);
  const toStart = new Date(nextStop.start_time);
  const earliest = new Date(fromEnd.getTime() + inMins * 60_000);
  const latest = new Date(toStart.getTime() - outMins * 60_000);
  const availableMins = Math.round(
    (latest.getTime() - earliest.getTime()) / 60_000,
  );
  const tz = timezone;
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: tz,
    }).format(d);

  if (availableMins < 0) {
    return {
      status: "infeasible",
      message: `Won't fit: travel alone is ${inMins + outMins}m, gap is ${Math.round(
        (toStart.getTime() - fromEnd.getTime()) / 60_000,
      )}m`,
    };
  }
  if (availableMins < idealDurationMinutes) {
    return {
      status: "infeasible",
      availableMinutes: availableMins,
      earliestArrive: fmt(earliest),
      latestLeave: fmt(latest),
      message: `Aim is ${idealDurationMinutes}m but only ${availableMins}m available between ${fmt(earliest)} and ${fmt(latest)}`,
    };
  }
  const slack = availableMins - idealDurationMinutes;
  return {
    status: slack < 10 ? "tight" : "fits",
    availableMinutes: availableMins,
    earliestArrive: fmt(earliest),
    latestLeave: fmt(latest),
  };
}

function computeFeasibility(
  fromStop: FeasibilityStop | undefined,
  toStop: FeasibilityStop | undefined,
  transition: TransitionRow | null | undefined,
): FeasibilityFlag | null {
  if (!fromStop || !toStop || !transition) return null;
  if (transition.is_locked) return null;
  if (!fromStop.is_time_fixed || !toStop.is_time_fixed) return null;
  const required = transition.computed_duration_minutes;
  const fromEnd = fromStop.end_time ?? fromStop.start_time;
  const toStart = toStop.start_time;
  const result = checkLegFeasibility({
    fromEnd: fromEnd ? new Date(fromEnd) : null,
    toStart: toStart ? new Date(toStart) : null,
    travelMinutes: required,
  });
  if (result.state === "late") {
    return { severity: "infeasible", message: result.message };
  }
  if (result.state === "tight") {
    return { severity: "tight", message: `Tight: ${result.message}` };
  }
  return null;
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function fmtDuration(minutes: number): string {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function fmtCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(0)}`;
  }
}

function formatDate(
  iso: string,
  tz: string,
  opts: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: tz }).format(
    new Date(iso),
  );
}

function fmtTime(iso: string | null, tz: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  });
}

// Inline icon component for journey-leg sub-rows. Hands back a tiny
// SVG (or a · for "buffer") so we never render an emoji into the UI.
function LegTypeIcon({ leg }: { leg: string }) {
  const props = { size: 12 } as const;
  switch (leg) {
    case "walk":
      return <TransportIcon.walk {...props} />;
    case "drive":
      return <TransportIcon.drive {...props} />;
    case "taxi":
      return <TransportIcon.taxi {...props} />;
    case "bus":
      return <TransportIcon.bus {...props} />;
    case "train":
      return <TransportIcon.train {...props} />;
    case "wait":
      return <StopIcon.wait {...props} />;
    case "meeting":
      return <StopIcon.appointment {...props} />;
    default:
      return <span aria-hidden>·</span>;
  }
}

// Client-safe builder for /api/maps/static URLs (mirrors the server-side
// StaticMap component but uses btoa instead of Buffer).
// ─────────────────────────────────────────────────────────────────────
