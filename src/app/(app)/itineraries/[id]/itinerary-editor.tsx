"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, useMemo, useEffect, useRef } from "react";
import { FormError } from "@/components/ui/form";
import {
  createStop,
  deleteStop,
  insertStopAt,
  updateStop,
} from "@/lib/actions/stops";
import {
  insertTransitLeg,
  upsertTransition,
  setTransitionMode,
} from "@/lib/actions/transitions";
import { TransportHubPicker } from "@/components/transport-hub-picker";
import { transitionItineraryStatus } from "@/lib/actions/itineraries";
import type { InitialPreviewSeed } from "@/components/itinerary/use-route-preview";
import { checkLegFeasibility } from "@/lib/feasibility/check";
import { feedbackFromError } from "@/lib/actions/_form";
import type {
  ItineraryStatus,
  LocationType,
  StopType,
  TransitionMode,
} from "@/lib/types/domain";
import { AddStopForm } from "./add-stop-form";
import {
  AddTransportBookingForm,
  type TransportBookingMode,
} from "./add-transport-booking-form";
import { AddAccommodationBookingForm } from "./add-accommodation-booking-form";
import { DeleteItineraryButton } from "@/components/delete-itinerary-button";
import { TransportIcon, StopIcon } from "@/components/icons";
import {
  AddBetween,
  AnchorCard,
  StopoverCard,
  TRANSITION_OPTIONS,
  TransitionRow as PlanningTransitionRow,
  anchorsFromStops,
  anchorToStopUpdate,
  buildDatePresets,
  emptyTransition,
  stopoverAsAnchor,
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
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [transportBookingFor, setTransportBookingFor] = useState<{
    stopId: string;
    label: string;
    mode: TransportBookingMode;
  } | null>(null);
  const [accommodationBookingFor, setAccommodationBookingFor] = useState<{
    afterStopId?: string;
    afterStopLabel?: string;
    existingStopId?: string;
  } | null>(null);

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
      if (opt.value === "auto" || opt.value === "mixed") continue;
      const entry = routePreviews.get(fromStopId, toStopId, opt.value);
      if (entry) out[opt.value] = entry;
    }
    return out;
  };
  const prefetchPair = (fromStopId: string, toStopId: string) => {
    for (const opt of TRANSITION_OPTIONS) {
      if (opt.value === "auto" || opt.value === "mixed") continue;
      routePreviews.fetchPreview(fromStopId, toStopId, opt.value);
    }
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
  const handleInsertAnchorAt = (sequence: number) => {
    startTransition(async () => {
      setError(null);
      const result = await insertStopAt({
        itinerary_id: itinerary.id,
        sequence,
        type: "appointment",
      });
      if (!result.ok) {
        setError(feedbackFromError(result.error).message);
        return;
      }
      setPendingExpandUid(result.value.id);
      router.refresh();
    });
  };

  // State for the inline + Train / + Flight form. When set, the
  // editor renders the form between the named anchor pair instead
  // of the usual inline-add row. Cleared on submit or cancel.
  const [transitFormFor, setTransitFormFor] = useState<{
    beforeStopId: string;
    // null = append at the end (used by the bottom + Train / + Flight).
    afterStopId: string | null;
    mode: "train" | "flight";
  } | null>(null);

  const handleInsertTransitLeg = (input: {
    beforeStopId: string;
    // null = append at the end of the itinerary (no after anchor).
    afterStopId: string | null;
    mode: "train" | "flight";
    departHubId: string;
    departLabel: string;
    departTime: string;
    arriveHubId: string;
    arriveLabel: string;
    arriveTime: string;
    serviceNumber?: string;
  }) => {
    startTransition(async () => {
      setError(null);
      const result = await insertTransitLeg({
        itinerary_id: itinerary.id,
        before_stop_id: input.beforeStopId,
        after_stop_id: input.afterStopId,
        mode: input.mode,
        depart_hub_id: input.departHubId,
        depart_label: input.departLabel,
        depart_time: new Date(input.departTime).toISOString(),
        arrive_hub_id: input.arriveHubId,
        arrive_label: input.arriveLabel,
        arrive_time: new Date(input.arriveTime).toISOString(),
        service_number: input.serviceNumber ?? null,
      });
      if (!result.ok) {
        setError(feedbackFromError(result.error).message);
        return;
      }
      setTransitFormFor(null);
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

  const handleAdd = (input: Parameters<typeof createStop>[0]) => {
    startTransition(async () => {
      setError(null);
      const result = await createStop(input);
      if (!result.ok) {
        setError(feedbackFromError(result.error).message);
        return;
      }
      const newStop = result.value;

      // After adding, compute the transition into this stop (if there's a
      // preceding stop) and out of it (if not last). Both happen
      // server-side via upsertTransition.
      const precedingStop = sortedStops[sortedStops.length - 1];
      if (precedingStop) {
        await upsertTransition({
          itinerary_id: itinerary.id,
          from_stop_id: precedingStop.id,
          to_stop_id: newStop.id,
        });
      }
      setAdding(false);
      router.refresh();
    });
  };

  const handleReturnTo = (target: {
    label: string;
    location_id: string | null;
    customer_id: string | null;
    customer_site_id: string | null;
  }) => {
    startTransition(async () => {
      setError(null);
      const result = await createStop({
        itinerary_id: itinerary.id,
        type: "other",
        title: `Back to ${target.label}`,
        location_id: target.location_id,
        customer_id: target.customer_id,
        customer_site_id: target.customer_site_id,
      });
      if (!result.ok) {
        setError(feedbackFromError(result.error).message);
        return;
      }
      const newStop = result.value;
      const precedingStop = sortedStops[sortedStops.length - 1];
      if (precedingStop) {
        await upsertTransition({
          itinerary_id: itinerary.id,
          from_stop_id: precedingStop.id,
          to_stop_id: newStop.id,
        });
      }
      router.refresh();
    });
  };

  const handleDelete = (stopId: string) => {
    if (!window.confirm("Delete this point?")) return;
    startTransition(async () => {
      setError(null);
      const result = await deleteStop(stopId);
      if (!result.ok) {
        setError(feedbackFromError(result.error).message);
        return;
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
      const current = next.get(uid);
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
      const current = next.get(uid);
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
    if (patch.mode === "auto" || patch.mode === "mixed") {
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
  const totalMiles = useMemo(
    () =>
      transitions.reduce(
        (sum, t) => sum + (Number(t.distance_miles) || 0),
        0,
      ),
    [transitions],
  );
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
  const mapUrl = useMemo(() => {
    const markers: { lat: number; lng: number; label?: string }[] = [];
    sortedStops.forEach((s, i) => {
      const lat =
        s.customer_site?.latitude ?? s.location?.latitude ?? null;
      const lng =
        s.customer_site?.longitude ?? s.location?.longitude ?? null;
      if (lat != null && lng != null) {
        markers.push({
          lat: Number(lat),
          lng: Number(lng),
          label: String(i + 1),
        });
      }
    });
    const paths = transitions
      .filter((t) => t.overview_polyline)
      .map((t) => ({
        encoded: t.overview_polyline!,
        color: "c25c3a",
        weight: 3,
      }));
    if (markers.length === 0 && paths.length === 0) return null;
    return buildClientStaticMapUrl({
      width: 320,
      height: 320,
      markers,
      paths,
    });
  }, [sortedStops, transitions]);

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
            <h1 className="masthead-title">
              <MastheadHeadline
                customerName={subject.customerName}
                placePart={subject.placePart}
                fallback={itinerary.title}
                date={dateLabel}
              />
            </h1>
            {itinerary.notes ? (
              <p className="standfirst">{itinerary.notes}</p>
            ) : null}
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
          <span className={`sb ${STATUS_SB[itinerary.status]}`}>
            {STATUS_LABEL[itinerary.status]}
          </span>
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
              const first = planningTimeline[0];
              return (
                <>
                  <div className="home-header">
                    <div className="home-header-badge">
                      <span className="home-header-dot" aria-hidden />
                      <span className="uc">Start</span>
                    </div>
                    <h3 className="home-header-title">{label}</h3>
                    <p className="home-header-meta">From your travel profile</p>
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
                  {/* Inline adds between Home and the first
                      anchor. Lets the user insert a train (e.g.
                      Wellingborough → Liverpool) right at the start
                      of the trip instead of having to add it
                      between the first two real anchors. */}
                  {first ? (
                    <InlineAddsRow
                      beforeStopId={startStop.id}
                      afterStopId={first.stop.id}
                      insertAtSequence={first.stop.sequence}
                      showStopoverTrigger={first.kind === "anchor"}
                      beforeLabel={label}
                      afterLabel={
                        first.kind === "anchor"
                          ? first.anchor.place?.label ?? "first stop"
                          : first.stop.title ?? "first stop"
                      }
                      transitFormFor={transitFormFor}
                      setTransitFormFor={setTransitFormFor}
                      pending={pending}
                      onInsertAnchor={(seq) =>
                        handleInsertAnchorAt(seq ?? 0)
                      }
                      onInsertStopover={() =>
                        handleInsertStopoverBetween(
                          startStop.id,
                          first.stop.id,
                        )
                      }
                      onInsertTransitLeg={(form) =>
                        handleInsertTransitLeg({
                          beforeStopId: startStop.id,
                          afterStopId: first.stop.id,
                          mode: transitFormFor!.mode,
                          ...form,
                        })
                      }
                    />
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
              <ol
                className="flex flex-col"
                style={{ gap: 12 }}
              >
                {planningTimeline.map((item, i) => {
                  // The next item on the timeline determines whether
                  // we render a transition row. We refer to "anchor /
                  // stopover" interchangeably as "this stop" for the
                  // transition's `to` side.
                  const nextItem = planningTimeline[i + 1];
                  const stop = item.stop;
                  // DbTransition for this leg — pulls computed
                  // duration/distance for the inline meta line.
                  const transitionToNext = nextItem
                    ? transitionByFrom.get(stop.id)
                    : null;

                  if (item.kind === "transit") {
                    // Compact card for transit_departure /
                    // transit_arrival stops. Not editable in the same
                    // way an anchor is — the train/flight leg between
                    // them is the editable thing; the stops are
                    // facts of the journey.
                    return (
                      <li key={item.stop.id} className="flex flex-col">
                        <TransitStopCard
                          stop={item.stop}
                          direction={item.transitDirection}
                          timezone={timezone}
                          onRemove={() => handleDelete(item.stop.id)}
                        />
                      </li>
                    );
                  }

                  if (item.kind === "stopover") {
                    // Stopover row — render StopoverCard summary; its
                    // surrounding anchors are derived from the
                    // adjacent timeline entries (skipping any other
                    // stopover that might sit immediately next to it,
                    // though in practice stopovers don't chain).
                    const prevAnchor = (() => {
                      for (let j = i - 1; j >= 0; j--) {
                        const it = planningTimeline[j];
                        if (it.kind === "anchor") return it.anchor;
                      }
                      return null;
                    })();
                    const nextAnchor = (() => {
                      for (let j = i + 1; j < planningTimeline.length; j++) {
                        const it = planningTimeline[j];
                        if (it.kind === "anchor") return it.anchor;
                      }
                      return null;
                    })();
                    // Back-calc: needs the previous/next *anchor stop
                    // rows* (with start/end times) plus the two leg
                    // transitions in/out of this stopover.
                    const prevAnchorStop = (() => {
                      for (let j = i - 1; j >= 0; j--) {
                        const it = planningTimeline[j];
                        if (it.kind === "anchor") return it.stop;
                      }
                      return undefined;
                    })();
                    const nextAnchorStop = (() => {
                      for (let j = i + 1; j < planningTimeline.length; j++) {
                        const it = planningTimeline[j];
                        if (it.kind === "anchor") return it.stop;
                      }
                      return undefined;
                    })();
                    const legIn = prevAnchorStop
                      ? transitions.find(
                          (t) =>
                            t.from_stop_id === prevAnchorStop.id &&
                            t.to_stop_id === stop.id,
                        )
                      : null;
                    const legOut = nextAnchorStop
                      ? transitions.find(
                          (t) =>
                            t.from_stop_id === stop.id &&
                            t.to_stop_id === nextAnchorStop.id,
                        )
                      : null;
                    // Fall back to the drive preview when a leg's
                    // transition has no computed duration stored
                    // (because the user hasn't picked a mode yet).
                    const legInPreview = prevAnchorStop
                      ? routePreviews.get(
                          prevAnchorStop.id,
                          item.stop.id,
                          "drive",
                        )
                      : null;
                    const legOutPreview = nextAnchorStop
                      ? routePreviews.get(
                          item.stop.id,
                          nextAnchorStop.id,
                          "drive",
                        )
                      : null;
                    const backCalc = computeStopoverBackCalc(
                      prevAnchorStop,
                      nextAnchorStop,
                      legIn,
                      legOut,
                      item.stopover.durationMins,
                      timezone,
                      legInPreview && legInPreview !== "pending"
                        ? legInPreview.durationMinutes
                        : null,
                      legOutPreview && legOutPreview !== "pending"
                        ? legOutPreview.durationMinutes
                        : null,
                    );
                    const isExpanded = expandedUids.has(item.stopover.uid);
                    const liveStopover =
                      editedStopovers.get(item.stopover.uid) ?? item.stopover;
                    return (
                      <li key={stop.id} className="flex flex-col">
                        <StopoverCard
                          stopover={liveStopover}
                          fromAnchor={
                            prevAnchor ??
                            stopoverAsAnchor(
                              item.stopover,
                              `placeholder-prev-${stop.id}`,
                            )
                          }
                          toAnchor={
                            nextAnchor ??
                            stopoverAsAnchor(
                              item.stopover,
                              `placeholder-next-${stop.id}`,
                            )
                          }
                          customers={customers}
                          customerSites={customerSites}
                          locations={locations}
                          backCalc={backCalc}
                          mode={isExpanded ? "expanded" : "summary"}
                          onModeChange={(next) =>
                            next === "expanded"
                              ? handleStopoverExpand(item.stopover.uid)
                              : handleStopoverCollapse(item.stopover.uid)
                          }
                          onChange={(patch) =>
                            handleStopoverPatch(item.stopover.uid, patch)
                          }
                          onRemove={() => handleDelete(stop.id)}
                        />
                        {nextItem && nextItem.kind !== "transit" ? (
                          <>
                            <PlanningTransitionRow
                              from={
                                prevAnchor ??
                                stopoverAsAnchor(
                                  item.stopover,
                                  `placeholder-prev-${stop.id}`,
                                )
                              }
                              to={
                                nextItem.kind === "anchor"
                                  ? nextItem.anchor
                                  : stopoverAsAnchor(
                                      nextItem.stopover,
                                      nextItem.stopover.uid,
                                    )
                              }
                              transition={
                                planningTransitions.get(
                                  transitionKey(
                                    stop.id,
                                    uidOf(nextItem),
                                  ),
                                ) ?? emptyTransition()
                              }
                              modePreviews={previewsForPair(
                                stop.id,
                                uidOf(nextItem),
                              )}
                              onOpenChange={(open) => {
                                if (open)
                                  prefetchPair(
                                    stop.id,
                                    uidOf(nextItem),
                                  );
                              }}
                              onChange={(patch) =>
                                handleTransitionPatch(
                                  stop.id,
                                  uidOf(nextItem),
                                  patch,
                                )
                              }
                            />
                            {transitionToNext ? (
                              <TransitionMeta
                                transition={transitionToNext}
                                feasibility={computeFeasibility(
                                  stop,
                                  nextItem.stop,
                                  transitionToNext,
                                )}
                              />
                            ) : null}
                          </>
                        ) : null}
                      </li>
                    );
                  }

                  // Anchor row.
                  const anchor = item.anchor;
                  const isExpanded = expandedUids.has(anchor.uid);
                  const liveAnchor =
                    editedAnchors.get(anchor.uid) ?? anchor;
                  return (
                    <li key={anchor.uid} className="flex flex-col">
                      <AnchorCard
                        anchor={liveAnchor}
                        earlier={planningAnchors.slice(
                          0,
                          planningAnchors.findIndex(
                            (a) => a.uid === anchor.uid,
                          ),
                        )}
                        first={i === 0}
                        canRemove={planningAnchors.length > 1}
                        customers={customers}
                        customerSites={customerSites}
                        locations={locations}
                        datePresets={planningDatePresets}
                        timezone={timezone}
                        mode={isExpanded ? "expanded" : "summary"}
                        onModeChange={(next) =>
                          next === "expanded"
                            ? handleAnchorExpand(anchor.uid)
                            : handleAnchorCollapse(anchor.uid)
                        }
                        onChange={(patch) =>
                          handleAnchorPatch(anchor.uid, patch)
                        }
                        onRemove={() => handleDelete(anchor.uid)}
                      />
                      {nextItem && nextItem.kind !== "transit" ? (
                        <PlanningTransitionRow
                          from={anchor}
                          to={
                            nextItem.kind === "anchor"
                              ? nextItem.anchor
                              : stopoverAsAnchor(
                                  nextItem.stopover,
                                  nextItem.stopover.uid,
                                )
                          }
                          transition={
                            planningTransitions.get(
                              transitionKey(
                                anchor.uid,
                                uidOf(nextItem),
                              ),
                            ) ?? emptyTransition()
                          }
                          modePreviews={previewsForPair(
                            anchor.uid,
                            uidOf(nextItem),
                          )}
                          onOpenChange={(open) => {
                            if (open)
                              prefetchPair(
                                anchor.uid,
                                uidOf(nextItem),
                              );
                          }}
                          onChange={(patch) =>
                            handleTransitionPatch(
                              anchor.uid,
                              uidOf(nextItem),
                              patch,
                            )
                          }
                        />
                      ) : null}
                      {nextItem && transitionToNext ? (
                        <TransitionMeta
                          transition={transitionToNext}
                          feasibility={computeFeasibility(
                            stop,
                            nextItem.stop,
                            transitionToNext,
                          )}
                        />
                      ) : null}
                      {/* Inline add affordances between anchor pairs
                          — adds a new anchor at this slot OR adds a
                          stopover between this anchor and the next
                          (only when no stopover already exists for
                          the pair). Mirrors the brief's UI. */}
                      {nextItem &&
                      item.kind === "anchor" &&
                      nextItem.kind !== "transit" ? (
                        transitFormFor &&
                        transitFormFor.beforeStopId === stop.id &&
                        transitFormFor.afterStopId === nextItem.stop.id ? (
                          <TransitLegForm
                            mode={transitFormFor.mode}
                            beforeLabel={
                              item.anchor.place?.label ?? "previous"
                            }
                            afterLabel={
                              nextItem.kind === "anchor"
                                ? nextItem.anchor.place?.label ?? "next"
                                : "next"
                            }
                            pending={pending}
                            onCancel={() => setTransitFormFor(null)}
                            onSubmit={(form) =>
                              handleInsertTransitLeg({
                                beforeStopId: stop.id,
                                afterStopId: nextItem.stop.id,
                                mode: transitFormFor.mode,
                                ...form,
                              })
                            }
                          />
                        ) : (
                          <div className="anchor-inline-adds">
                            <AddBetween
                              between
                              onAdd={() =>
                                handleInsertAnchorAt(nextItem.stop.sequence)
                              }
                            />
                            {nextItem.kind === "anchor" ? (
                              <>
                                <button
                                  type="button"
                                  className="brief-add-stop-trigger"
                                  onClick={() =>
                                    handleInsertStopoverBetween(
                                      stop.id,
                                      nextItem.stop.id,
                                    )
                                  }
                                  title="Drop in somewhere between these two anchors"
                                >
                                  + Add a stop between these
                                </button>
                                <button
                                  type="button"
                                  className="brief-add-stop-trigger"
                                  onClick={() =>
                                    setTransitFormFor({
                                      beforeStopId: stop.id,
                                      afterStopId: nextItem.stop.id,
                                      mode: "train",
                                    })
                                  }
                                  title="Add a train journey between these"
                                >
                                  + Train
                                </button>
                                <button
                                  type="button"
                                  className="brief-add-stop-trigger"
                                  onClick={() =>
                                    setTransitFormFor({
                                      beforeStopId: stop.id,
                                      afterStopId: nextItem.stop.id,
                                      mode: "flight",
                                    })
                                  }
                                  title="Add a flight between these"
                                >
                                  + Flight
                                </button>
                              </>
                            ) : null}
                          </div>
                        )
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            )}

            {/* Bottom-of-timeline add affordances. + Train and +
                Flight here append a transit chain at the end (no
                surrounding anchor to slot before) — handy for
                booking the journey home from a multi-day trip. */}
            {(() => {
              const last = sortedStops[sortedStops.length - 1];
              if (!last) {
                return (
                  <AddBetween
                    onAdd={() => handleInsertAnchorAt(0)}
                  />
                );
              }
              return (
                <InlineAddsRow
                  beforeStopId={last.id}
                  afterStopId={null}
                  insertAtSequence={(last.sequence ?? -1) + 1}
                  // Stopovers conceptually need a surrounding pair;
                  // at the very end of the timeline there's no
                  // 'next anchor' to fit between, so we hide the
                  // stopover button here.
                  showStopoverTrigger={false}
                  beforeLabel={
                    last.title ??
                    last.location?.name ??
                    "the last stop"
                  }
                  afterLabel="end of trip"
                  transitFormFor={transitFormFor}
                  setTransitFormFor={setTransitFormFor}
                  pending={pending}
                  onInsertAnchor={(seq) =>
                    handleInsertAnchorAt(seq ?? (last.sequence ?? -1) + 1)
                  }
                  onInsertStopover={() => {
                    // Unreachable — showStopoverTrigger is false at
                    // the bottom-of-timeline position.
                  }}
                  onInsertTransitLeg={(form) =>
                    handleInsertTransitLeg({
                      beforeStopId: last.id,
                      afterStopId: null,
                      mode: transitFormFor!.mode,
                      ...form,
                    })
                  }
                />
              );
            })()}
          </div>

          {/* Right: map + day digest */}
          <aside className="flex flex-col gap-5">
            {mapUrl ? (
              <div className="overflow-hidden rounded-md border border-rule bg-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mapUrl}
                  alt="Route map"
                  className="block w-full"
                  style={{ aspectRatio: "1 / 1", objectFit: "cover" }}
                />
              </div>
            ) : (
              <div
                className="flex h-[320px] items-center justify-center rounded-md border border-dashed border-rule-2 bg-card-2 text-center"
              >
                <span className="small px-6">
                  Map appears once stops have addresses.
                </span>
              </div>
            )}

            <div className="digest-panel">
              <div className="h">Day · digest</div>
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
            </div>
          </aside>
        </div>

        {/* Booking modal — transport */}
        {transportBookingFor ? (
          <div
            className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-ink/35 p-4 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) setTransportBookingFor(null);
            }}
          >
            <div className="my-8 w-full max-w-3xl">
              <AddTransportBookingForm
                fromStopId={transportBookingFor.stopId}
                fromStopLabel={transportBookingFor.label}
                initialMode={transportBookingFor.mode}
                customers={customers}
                customerSites={customerSites}
                locations={locations}
                onCancel={() => setTransportBookingFor(null)}
                onDone={() => {
                  setTransportBookingFor(null);
                  router.refresh();
                }}
              />
            </div>
          </div>
        ) : null}

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
      </div>
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

function StopBookingMenu({
  stop,
  pending,
  onAddTransport,
  onAddAccommodation,
}: {
  stop: StopRow;
  pending: boolean;
  onAddTransport: (mode: TransportBookingMode, label: string) => void;
  onAddAccommodation: (label: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const label =
    stop.customer_site?.name ??
    stop.customer?.name ??
    stop.location?.name ??
    stop.title ??
    "this point";

  const isStation = stop.location?.type === "station";

  const items: { mode: TransportBookingMode; label: string }[] = [
    { mode: "train", label: "Train" },
    { mode: "flight", label: "Flight" },
    { mode: "taxi", label: "Taxi" },
    { mode: "bus", label: "Bus" },
    { mode: "tube", label: "Tube" },
    { mode: "drive", label: "Car hire" },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="text-xs hover:underline disabled:opacity-50"
        style={{ color: "var(--gold-2)" }}
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
      >
        + Add booking
      </button>
      {open ? (
        <div
          className="absolute right-0 z-10 mt-1 w-44 overflow-hidden rounded-md border border-rule bg-card shadow-lg"
          role="menu"
        >
          {isStation ? (
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-xs hover:bg-gold-soft/40"
              style={{ background: "var(--gold-soft)" }}
              onClick={() => {
                setOpen(false);
                onAddTransport("train", label);
              }}
            >
              <span className="mr-2 inline-flex align-middle" style={{ color: "var(--gold-2)" }}>
                <TransportIcon.train size={13} />
              </span>
              Train (from {stop.location?.name ?? "station"})
            </button>
          ) : null}
          {items.map((it) => {
            const ItemIcon =
              it.mode === "train"
                ? TransportIcon.train
                : it.mode === "flight"
                  ? TransportIcon.flight
                  : it.mode === "taxi"
                    ? TransportIcon.taxi
                    : it.mode === "bus"
                      ? TransportIcon.bus
                      : it.mode === "tube"
                        ? TransportIcon.tube
                        : TransportIcon.drive;
            return (
              <button
                key={it.mode}
                type="button"
                role="menuitem"
                className="block w-full border-t border-rule/50 px-3 py-2 text-left text-xs hover:bg-card-2"
                onClick={() => {
                  setOpen(false);
                  onAddTransport(it.mode, label);
                }}
              >
                <span
                  className="mr-2 inline-flex align-middle"
                  style={{ color: "var(--ink-dim)" }}
                >
                  <ItemIcon size={13} />
                </span>
                {it.label}
              </button>
            );
          })}
          <button
            type="button"
            role="menuitem"
            className="block w-full border-t border-rule/50 px-3 py-2 text-left text-xs hover:bg-card-2"
            onClick={() => {
              setOpen(false);
              onAddAccommodation(label);
            }}
          >
            <span
              className="mr-2 inline-flex align-middle"
              style={{ color: "var(--ink-dim)" }}
            >
              <StopIcon.stay size={13} />
            </span>
            {stop.type === "accommodation" ? "Edit stay" : "Hotel / stay"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

// TransitionMeta — small inline row showing the computed travel
// duration + distance under a transition chip. Surfaces the data
// that lived inside the old TransitionRowView (computed by the
// editor's solver / Google Directions). The chip itself is now the
// shared PlanningTransitionRow.
// TransitStopCard — compact card for transit_departure /
// transit_arrival stops. Shows the station/airport name + time, with
// a small Remove button. Less affordance than an AnchorCard because
// these stops are facts of a booked train/flight, not free-form
// anchors the user fills in.
// InlineAddsRow — the row of dashed pills between two anchors that
// lets the user insert a new anchor, stopover, train leg or flight
// leg. Reused for: between anchor pairs, between home and the first
// anchor, and after the last anchor (where afterStopId is null and
// the inserts append at the end). When the user clicks + Train / +
// Flight, transitFormFor is set to the matching pair and the form
// renders in place of the pill row.
function InlineAddsRow({
  beforeStopId,
  afterStopId,
  insertAtSequence,
  showStopoverTrigger,
  beforeLabel,
  afterLabel,
  transitFormFor,
  setTransitFormFor,
  pending,
  onInsertAnchor,
  onInsertStopover,
  onInsertTransitLeg,
}: {
  beforeStopId: string;
  // null = append at end (no after-anchor to slot before).
  afterStopId: string | null;
  // Sequence to insert at when the user clicks + Add another. null
  // means append (max sequence + 1, handled inside the handler).
  insertAtSequence: number | null;
  showStopoverTrigger: boolean;
  beforeLabel: string;
  afterLabel: string;
  transitFormFor: {
    beforeStopId: string;
    afterStopId: string | null;
    mode: "train" | "flight";
  } | null;
  setTransitFormFor: (
    next:
      | {
          beforeStopId: string;
          afterStopId: string | null;
          mode: "train" | "flight";
        }
      | null,
  ) => void;
  pending: boolean;
  onInsertAnchor: (sequence: number | null) => void;
  onInsertStopover: () => void;
  onInsertTransitLeg: (form: {
    departHubId: string;
    departLabel: string;
    departTime: string;
    arriveHubId: string;
    arriveLabel: string;
    arriveTime: string;
    serviceNumber?: string;
  }) => void;
}) {
  const formActive =
    !!transitFormFor &&
    transitFormFor.beforeStopId === beforeStopId &&
    transitFormFor.afterStopId === afterStopId;

  if (formActive && transitFormFor) {
    return (
      <TransitLegForm
        mode={transitFormFor.mode}
        beforeLabel={beforeLabel}
        afterLabel={afterLabel}
        pending={pending}
        onCancel={() => setTransitFormFor(null)}
        onSubmit={onInsertTransitLeg}
      />
    );
  }

  return (
    <div className="anchor-inline-adds">
      <AddBetween between onAdd={() => onInsertAnchor(insertAtSequence)} />
      {showStopoverTrigger ? (
        <button
          type="button"
          className="brief-add-stop-trigger"
          onClick={onInsertStopover}
          title="Drop in somewhere between these two anchors"
        >
          + Add a stop between these
        </button>
      ) : null}
      <button
        type="button"
        className="brief-add-stop-trigger"
        onClick={() =>
          setTransitFormFor({ beforeStopId, afterStopId, mode: "train" })
        }
        title="Add a train journey here"
      >
        + Train
      </button>
      <button
        type="button"
        className="brief-add-stop-trigger"
        onClick={() =>
          setTransitFormFor({ beforeStopId, afterStopId, mode: "flight" })
        }
        title="Add a flight here"
      >
        + Flight
      </button>
    </div>
  );
}

function TransitStopCard({
  stop,
  direction,
  timezone,
  onRemove,
}: {
  // Structural shape — both the editor's StopRow and the shared
  // DbStop satisfy this. Card only needs title + start_time.
  stop: { title: string | null; start_time: string | null };
  direction: "departure" | "arrival";
  timezone: string;
  onRemove: () => void;
}) {
  const kindLabel =
    direction === "departure" ? "Depart" : "Arrive";
  const time = stop.start_time
    ? new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: timezone,
      }).format(new Date(stop.start_time))
    : "—";
  return (
    <section className="transit-stop-card">
      <div className="transit-stop-head">
        <span className="uc">{kindLabel}</span>
        <span className="transit-stop-time">{time}</span>
      </div>
      <h3 className="transit-stop-title">{stop.title ?? "Station"}</h3>
      <button
        type="button"
        className="transit-stop-remove"
        onClick={onRemove}
        aria-label="Remove transit stop"
      >
        Remove
      </button>
    </section>
  );
}

// TransitLegForm — inline form rendered between two anchors when the
// user clicks '+ Train' or '+ Flight'. Collects depart hub, arrive
// hub, depart time, arrive time, optional service number. Submits
// to insertTransitLeg, which writes both transit stops + the locked
// transition between them.
function TransitLegForm({
  mode,
  beforeLabel,
  afterLabel,
  pending,
  onCancel,
  onSubmit,
}: {
  mode: "train" | "flight";
  beforeLabel: string;
  afterLabel: string;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (form: {
    departHubId: string;
    departLabel: string;
    departTime: string;
    arriveHubId: string;
    arriveLabel: string;
    arriveTime: string;
    serviceNumber?: string;
  }) => void;
}) {
  const hubKind = mode === "train" ? "rail_station" : "airport";
  const noun = mode === "train" ? "station" : "airport";
  const [departHub, setDepartHub] = useState<{ id: string | null; label: string | null }>({ id: null, label: null });
  const [arriveHub, setArriveHub] = useState<{ id: string | null; label: string | null }>({ id: null, label: null });
  const [departTime, setDepartTime] = useState("");
  const [arriveTime, setArriveTime] = useState("");
  const [serviceNumber, setServiceNumber] = useState("");

  const ready =
    departHub.id != null &&
    arriveHub.id != null &&
    departHub.label != null &&
    arriveHub.label != null &&
    departTime !== "" &&
    arriveTime !== "";

  return (
    <div className="transit-leg-form">
      <header className="transit-leg-form-head">
        <span className="uc">
          {mode === "train" ? "Train" : "Flight"} from {beforeLabel} to{" "}
          {afterLabel}
        </span>
        <button
          type="button"
          className="transit-leg-form-cancel"
          onClick={onCancel}
          disabled={pending}
        >
          Cancel
        </button>
      </header>
      <div className="transit-leg-form-grid">
        <label className="brief-field">
          <span className="uc">Departing {noun}</span>
          <TransportHubPicker
            kind={hubKind}
            name="depart_hub"
            value={departHub}
            onChange={setDepartHub}
            placeholder={`Pick a ${noun}`}
          />
        </label>
        <label className="brief-field">
          <span className="uc">Departure time</span>
          <input
            type="datetime-local"
            className="field"
            value={departTime}
            onChange={(e) => setDepartTime(e.target.value)}
          />
        </label>
        <label className="brief-field">
          <span className="uc">Arriving {noun}</span>
          <TransportHubPicker
            kind={hubKind}
            name="arrive_hub"
            value={arriveHub}
            onChange={setArriveHub}
            placeholder={`Pick a ${noun}`}
          />
        </label>
        <label className="brief-field">
          <span className="uc">Arrival time</span>
          <input
            type="datetime-local"
            className="field"
            value={arriveTime}
            onChange={(e) => setArriveTime(e.target.value)}
          />
        </label>
        <label className="brief-field" style={{ gridColumn: "1 / -1" }}>
          <span className="uc">Service / flight number (optional)</span>
          <input
            type="text"
            className="field"
            value={serviceNumber}
            onChange={(e) => setServiceNumber(e.target.value)}
            placeholder={mode === "train" ? "9M14" : "BA245"}
          />
        </label>
      </div>
      <div className="transit-leg-form-actions">
        <button
          type="button"
          className="btn btn-gold"
          disabled={!ready || pending}
          onClick={() =>
            onSubmit({
              departHubId: departHub.id!,
              departLabel: departHub.label!,
              departTime,
              arriveHubId: arriveHub.id!,
              arriveLabel: arriveHub.label!,
              arriveTime,
              serviceNumber: serviceNumber.trim() || undefined,
            })
          }
        >
          Add {mode}
        </button>
      </div>
    </div>
  );
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

function TransitionMeta({
  transition,
  feasibility,
}: {
  transition: TransitionRow;
  feasibility?: FeasibilityFlag | null;
}) {
  const mins = transition.computed_duration_minutes ?? 0;
  const miles = Number(transition.distance_miles ?? 0);
  if (!mins && !miles && !feasibility) return null;
  return (
    <div
      style={{
        marginLeft: 56,
        fontSize: 11.5,
        color: "var(--ink-dim)",
        padding: "2px 0 6px",
        display: "flex",
        gap: 10,
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      {mins ? <span>{fmtDuration(mins)}</span> : null}
      {miles ? <span>{miles.toFixed(1)} mi</span> : null}
      {feasibility ? (
        <span
          className={
            feasibility.severity === "infeasible"
              ? "feasibility-flag feasibility-flag-bad"
              : "feasibility-flag feasibility-flag-tight"
          }
        >
          {feasibility.message}
        </span>
      ) : null}
    </div>
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
function buildClientStaticMapUrl(spec: {
  width: number;
  height: number;
  zoom?: number;
  center?: { lat: number; lng: number };
  markers?: { lat: number; lng: number; color?: string; label?: string }[];
  paths?: { encoded: string; color?: string; weight?: number }[];
}): string {
  const json = JSON.stringify({
    ...spec,
    markers: spec.markers ?? [],
    paths: spec.paths ?? [],
    // Pin the inline route maps to the Journies map style so the warm
    // editorial palette carries into every embedded map.
    style: "journies",
  });
  // base64url encode
  const b64 = btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `/api/maps/static?s=${b64}`;
}
