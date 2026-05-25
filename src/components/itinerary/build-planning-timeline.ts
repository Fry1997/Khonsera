import type { TicketSegment } from "@/components/train-ticket-card";
import type { ModePreviewMap } from "./transition-row";
import type { Anchor, BriefTransition, Stopover, TimelineEntry } from "./types";
import type { DbStop, DbTransition, EditorTimelineItem } from "./from-db";
import type { StopoverBackCalc } from "./stopover-card";
import { emptyTransition, stopoverAsAnchor, transitionKey, transitStopAsAnchor } from "./helpers";

export type PlanningTimelineInput = {
  planningTimeline: EditorTimelineItem[];
  planningAnchors: Anchor[];
  sortedStops: DbStop[];
  transitions: DbTransition[];
  planningTransitions: Map<string, BriefTransition>;
  transitionByFrom: Map<string, DbTransition>;
  expandedUids: Set<string>;
  editedAnchors: Map<string, Anchor>;
  editedStopovers: Map<string, Stopover & { uid: string }>;
  timezone: string;
  previewsForPair: (fromId: string, toId: string) => ModePreviewMap;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  computeStopoverBackCalc: (...args: any[]) => StopoverBackCalc;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  computeFeasibility: (...args: any[]) => { severity: string; message: string } | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  routePreviews: { get: (...args: any[]) => { durationMinutes: number | null; distanceMiles: number | null } | "pending" | null };
  handlers: {
    handleAnchorExpand: (uid: string) => void;
    handleAnchorCollapse: (uid: string) => void;
    handleAnchorPatch: (uid: string, patch: Partial<Anchor>) => void;
    handleStopoverExpand: (uid: string) => void;
    handleStopoverCollapse: (uid: string) => void;
    handleStopoverPatch: (uid: string, patch: Partial<Stopover>) => void;
    handleDelete: (id: string) => void;
    handleTransitionPatch: (fromId: string, toId: string, patch: Partial<BriefTransition>) => void;
    prefetchPair: (fromId: string, toId: string) => void;
    handleInsertAnchorAt: (sequence: number) => void;
    handleInsertStopoverBetween: (fromId: string, toId: string) => void;
    handleInsertTransitLeg?: (opts: { beforeStopId: string; afterStopId: string | null; mode: string }) => void;
  };
  startStop?: DbStop | null;
};

function uidOf(it: EditorTimelineItem): string {
  return it.kind === "anchor"
    ? it.anchor.uid
    : it.kind === "stopover"
      ? it.stopover.uid
      : it.stop.id;
}

function fmtTime(iso: string | null, tz: string): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz,
  }).format(new Date(iso));
}

export function buildPlanningTimeline(input: PlanningTimelineInput): TimelineEntry[] {
  const {
    planningTimeline,
    planningAnchors,
    transitions,
    planningTransitions,
    transitionByFrom,
    expandedUids,
    editedAnchors,
    editedStopovers,
    timezone,
    previewsForPair,
    computeStopoverBackCalc,
    computeFeasibility,
    routePreviews,
    handlers,
    startStop,
  } = input;

  const result: TimelineEntry[] = [];

  // Home → first item gap
  if (startStop && planningTimeline.length > 0) {
    const first = planningTimeline[0];
    if (first.kind !== "transit") {
      const toAnchor = first.kind === "anchor"
        ? first.anchor
        : stopoverAsAnchor(first.stopover, first.stopover.uid);
      result.push({
        kind: "gap-transition",
        from: null,
        to: toAnchor,
        transition: planningTransitions.get(
          transitionKey(startStop.id, uidOf(first)),
        ) ?? emptyTransition(),
        fromVirtualLabel: startStop.location?.name ?? startStop.title ?? "Home",
        modePreviews: previewsForPair(startStop.id, uidOf(first)),
        onChange: (patch) => handlers.handleTransitionPatch(startStop.id, uidOf(first), patch),
        onOpenChange: (open) => {
          if (open) handlers.prefetchPair(startStop.id, uidOf(first));
        },
      });
    }
  }

  // Walk through timeline items
  for (let i = 0; i < planningTimeline.length; i++) {
    const item = planningTimeline[i];
    const nextItem = planningTimeline[i + 1];
    const stop = item.stop;
    const transitionToNext = nextItem ? transitionByFrom.get(stop.id) : null;

    if (item.kind === "transit") {
      buildTransitEntry(result, item, i, planningTimeline, transitionByFrom, timezone, handlers);
    } else if (item.kind === "stopover") {
      buildStopoverEntry(result, item, i, planningTimeline, input);
    } else {
      // Anchor
      buildAnchorEntry(result, item, planningAnchors, input);
    }

    // Transition to next item (if not a transit group — those handle their own)
    if (item.kind !== "transit" && nextItem) {
      const toAnchor = nextItem.kind === "anchor"
        ? nextItem.anchor
        : nextItem.kind === "stopover"
          ? stopoverAsAnchor(nextItem.stopover, nextItem.stopover.uid)
          : transitStopAsAnchor(nextItem.stop);

      const fromAnchor = item.kind === "anchor"
        ? (editedAnchors.get(item.anchor.uid) ?? item.anchor)
        : stopoverAsAnchor(
            editedStopovers.get(item.stopover.uid) ?? item.stopover,
            item.stopover.uid,
          );

      result.push({
        kind: "gap-transition",
        from: fromAnchor,
        to: toAnchor,
        transition: planningTransitions.get(
          transitionKey(stop.id, uidOf(nextItem)),
        ) ?? emptyTransition(),
        modePreviews: previewsForPair(stop.id, uidOf(nextItem)),
        onChange: (patch) => handlers.handleTransitionPatch(stop.id, uidOf(nextItem), patch),
        onOpenChange: (open) => {
          if (open) handlers.prefetchPair(stop.id, uidOf(nextItem));
        },
        transitionMeta: transitionToNext ? {
          durationMinutes: transitionToNext.computed_duration_minutes,
          distanceMiles: transitionToNext.distance_miles ? Number(transitionToNext.distance_miles) : null,
          feasibility: nextItem ? computeFeasibility(stop, nextItem.stop, transitionToNext) : null,
        } : undefined,
      });

      // Inline adds between anchor pairs
      if (item.kind === "anchor" && nextItem) {
        result.push({
          kind: "inline-adds",
          onAddAnchor: () => handlers.handleInsertAnchorAt(nextItem.stop.sequence),
          onAddStopover: nextItem.kind === "anchor"
            ? () => handlers.handleInsertStopoverBetween(stop.id, nextItem.stop.id)
            : undefined,
          onAddTransport: nextItem.kind === "anchor" && handlers.handleInsertTransitLeg
            ? () => handlers.handleInsertTransitLeg!({
                beforeStopId: stop.id,
                afterStopId: nextItem.stop.id,
                mode: "train",
              })
            : undefined,
        });
      }
    }
  }

  return result;
}

function buildTransitEntry(
  result: TimelineEntry[],
  item: Extract<EditorTimelineItem, { kind: "transit" }>,
  i: number,
  planningTimeline: EditorTimelineItem[],
  transitionByFrom: Map<string, DbTransition>,
  timezone: string,
  handlers: PlanningTimelineInput["handlers"],
) {
  const meta = item.stop.metadata as Record<string, unknown> | null;
  const transitTransition = transitionByFrom.get(item.stop.id);

  // Skip arrival stops that follow a locked ticket (the ticket shows arrival)
  const isActualArrival = (item.stop.type as string) === "transit_arrival";
  const prevItem = i > 0 ? planningTimeline[i - 1] : null;
  const prevIsTransitTicket =
    prevItem?.kind === "transit" &&
    transitionByFrom.get(prevItem.stop.id)?.is_locked;
  if (isActualArrival && prevIsTransitTicket) return;

  const nextItem = planningTimeline[i + 1];
  const showTicket =
    nextItem?.kind === "transit" && transitTransition?.is_locked;

  if (showTicket) {
    const nextMeta = nextItem!.stop.metadata as Record<string, unknown> | null;
    const ticketSeg: TicketSegment = {
      from_station: item.stop.title ?? "?",
      to_station: nextItem!.stop.title ?? "?",
      from_station_code: null,
      to_station_code: null,
      departure_date: item.stop.start_time?.slice(0, 10) ?? "",
      departure_time: fmtTime(item.stop.end_time ?? item.stop.start_time, timezone),
      arrival_time: fmtTime(nextItem!.stop.start_time, timezone),
      operator: (meta?.operator as string) ?? null,
      route_restriction: (meta?.route_restriction as string) ?? null,
      ticket_type: (meta?.ticket_type as string) ?? null,
      coach: null,
      seat: (meta?.seat as string) ?? null,
      barcode_ref: (meta?.barcode_ref as string) ?? (meta?.booking_reference as string) ?? null,
      barcode_data: (meta?.barcode_data as string) ?? null,
      price: (meta?.price as number) ?? null,
    };

    // Only emit on the departure stop — collect all consecutive locked legs
    if (item.transitDirection === "departure") {
      const legs: TicketSegment[] = [ticketSeg];
      // Look ahead for more chained legs
      let j = i + 1;
      while (j < planningTimeline.length - 1) {
        const curr = planningTimeline[j];
        const next = planningTimeline[j + 1];
        if (curr?.kind !== "transit" || next?.kind !== "transit") break;
        const t = transitionByFrom.get(curr.stop.id);
        if (!t?.is_locked) break;
        const currMeta = curr.stop.metadata as Record<string, unknown> | null;
        legs.push({
          from_station: curr.stop.title ?? "?",
          to_station: next.stop.title ?? "?",
          from_station_code: null,
          to_station_code: null,
          departure_date: curr.stop.start_time?.slice(0, 10) ?? "",
          departure_time: fmtTime(curr.stop.end_time ?? curr.stop.start_time, timezone),
          arrival_time: fmtTime(next.stop.start_time, timezone),
          operator: (currMeta?.operator as string) ?? null,
          route_restriction: (currMeta?.route_restriction as string) ?? null,
          ticket_type: (currMeta?.ticket_type as string) ?? null,
          coach: null,
          seat: (currMeta?.seat as string) ?? null,
          barcode_ref: (currMeta?.barcode_ref as string) ?? (currMeta?.booking_reference as string) ?? null,
          barcode_data: (currMeta?.barcode_data as string) ?? null,
          price: (currMeta?.price as number) ?? null,
        });
        j++;
      }

      const mode = (meta?.transport_mode as string) ?? "transport";
      const depTime = fmtTime(item.stop.end_time ?? item.stop.start_time, timezone);
      const dest = planningTimeline[i + legs.length]?.stop.title ?? "?";

      result.push({
        kind: "transport",
        uid: item.stop.id,
        label: `${depTime} ${mode} to ${dest}`,
        mode,
        legs,
        onRemove: () => handlers.handleDelete(item.stop.id),
      });
    }
  } else if (item.transitDirection === "departure") {
    // A departure stop without a locked ticket — show as a simple transport label
    const mode = (meta?.transport_mode as string) ?? "transport";
    const depTime = fmtTime(item.stop.end_time ?? item.stop.start_time, timezone);
    result.push({
      kind: "transport",
      uid: item.stop.id,
      label: `Booked ${mode} from ${item.stop.title ?? "?"}`,
      mode,
      legs: [],
      onRemove: () => handlers.handleDelete(item.stop.id),
    });
  }
}

function buildStopoverEntry(
  result: TimelineEntry[],
  item: Extract<EditorTimelineItem, { kind: "stopover" }>,
  i: number,
  planningTimeline: EditorTimelineItem[],
  input: PlanningTimelineInput,
) {
  const {
    transitions,
    expandedUids,
    editedStopovers,
    timezone,
    routePreviews,
    computeStopoverBackCalc,
    handlers,
  } = input;

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
    ? transitions.find((t) => t.from_stop_id === prevAnchorStop.id && t.to_stop_id === item.stop.id)
    : null;
  const legOut = nextAnchorStop
    ? transitions.find((t) => t.from_stop_id === item.stop.id && t.to_stop_id === nextAnchorStop.id)
    : null;

  const legInPreview = prevAnchorStop
    ? routePreviews.get(prevAnchorStop.id, item.stop.id, "drive")
    : null;
  const legOutPreview = nextAnchorStop
    ? routePreviews.get(item.stop.id, nextAnchorStop.id, "drive")
    : null;

  const backCalc = computeStopoverBackCalc(
    prevAnchorStop,
    nextAnchorStop,
    legIn ?? null,
    legOut ?? null,
    item.stopover.durationMins,
    timezone,
    legInPreview && legInPreview !== "pending" ? legInPreview.durationMinutes : null,
    legOutPreview && legOutPreview !== "pending" ? legOutPreview.durationMinutes : null,
  );

  const isExpanded = expandedUids.has(item.stopover.uid);
  const liveStopover = editedStopovers.get(item.stopover.uid) ?? item.stopover;

  result.push({
    kind: "stopover",
    uid: item.stopover.uid,
    stopover: liveStopover,
    fromAnchor: prevAnchor ?? stopoverAsAnchor(item.stopover, `placeholder-prev-${item.stop.id}`),
    toAnchor: nextAnchor ?? stopoverAsAnchor(item.stopover, `placeholder-next-${item.stop.id}`),
    expanded: isExpanded,
    backCalc,
    onModeChange: (next) =>
      next === "expanded"
        ? handlers.handleStopoverExpand(item.stopover.uid)
        : handlers.handleStopoverCollapse(item.stopover.uid),
    onChange: (patch) => handlers.handleStopoverPatch(item.stopover.uid, patch),
    onRemove: () => handlers.handleDelete(item.stop.id),
  });
}

function buildAnchorEntry(
  result: TimelineEntry[],
  item: Extract<EditorTimelineItem, { kind: "anchor" }>,
  planningAnchors: Anchor[],
  input: PlanningTimelineInput,
) {
  const { expandedUids, editedAnchors, handlers } = input;
  const anchor = item.anchor;
  const isExpanded = expandedUids.has(anchor.uid);
  const liveAnchor = editedAnchors.get(anchor.uid) ?? anchor;
  const anchorIdx = planningAnchors.findIndex((a) => a.uid === anchor.uid);

  result.push({
    kind: "anchor",
    uid: anchor.uid,
    anchor: liveAnchor,
    earlier: planningAnchors.slice(0, anchorIdx >= 0 ? anchorIdx : 0),
    expanded: isExpanded,
    onModeChange: (next) =>
      next === "expanded"
        ? handlers.handleAnchorExpand(anchor.uid)
        : handlers.handleAnchorCollapse(anchor.uid),
    onChange: (patch) => handlers.handleAnchorPatch(anchor.uid, patch),
    onRemove: () => handlers.handleDelete(anchor.uid),
  });
}
