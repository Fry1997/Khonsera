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

  // Pre-compute transit groups: consecutive transit stops → single transport entry
  const transitGroupStart = new Map<number, number>(); // index → group end index (inclusive)
  const consumedByGroup = new Set<number>();
  for (let i = 0; i < planningTimeline.length; i++) {
    if (planningTimeline[i].kind !== "transit" || consumedByGroup.has(i)) continue;
    let end = i;
    while (end + 1 < planningTimeline.length && planningTimeline[end + 1].kind === "transit") {
      end++;
    }
    if (end > i) {
      transitGroupStart.set(i, end);
      for (let j = i + 1; j <= end; j++) consumedByGroup.add(j);
    } else {
      transitGroupStart.set(i, i);
    }
  }

  // Walk through timeline items
  for (let i = 0; i < planningTimeline.length; i++) {
    if (consumedByGroup.has(i)) continue;

    const item = planningTimeline[i];
    const nextItem = planningTimeline[i + 1];
    const stop = item.stop;
    const transitionToNext = nextItem ? transitionByFrom.get(stop.id) : null;

    if (item.kind === "transit") {
      const groupEnd = transitGroupStart.get(i) ?? i;
      buildTransitGroup(result, i, groupEnd, planningTimeline, transitionByFrom, timezone, handlers);
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

function buildTransitGroup(
  result: TimelineEntry[],
  startIdx: number,
  endIdx: number,
  planningTimeline: EditorTimelineItem[],
  transitionByFrom: Map<string, DbTransition>,
  timezone: string,
  handlers: PlanningTimelineInput["handlers"],
) {
  const groupStops = [];
  for (let j = startIdx; j <= endIdx; j++) {
    groupStops.push(planningTimeline[j]);
  }

  // Build one ticket segment for each consecutive pair in the group
  const legs: TicketSegment[] = [];
  for (let j = 0; j < groupStops.length - 1; j++) {
    const from = groupStops[j];
    const to = groupStops[j + 1];
    const fromMeta = from.stop.metadata as Record<string, unknown> | null;
    legs.push({
      from_station: from.stop.title ?? "?",
      to_station: to.stop.title ?? "?",
      from_station_code: null,
      to_station_code: null,
      departure_date: from.stop.start_time?.slice(0, 10) ?? "",
      departure_time: fmtTime(from.stop.end_time ?? from.stop.start_time, timezone),
      arrival_time: fmtTime(to.stop.start_time, timezone),
      operator: (fromMeta?.operator as string) ?? null,
      route_restriction: (fromMeta?.route_restriction as string) ?? null,
      ticket_type: (fromMeta?.ticket_type as string) ?? null,
      coach: null,
      seat: (fromMeta?.seat as string) ?? null,
      barcode_ref: (fromMeta?.barcode_ref as string) ?? (fromMeta?.booking_reference as string) ?? null,
      barcode_data: (fromMeta?.barcode_data as string) ?? null,
      price: (fromMeta?.price as number) ?? null,
    });
  }

  const first = groupStops[0];
  const last = groupStops[groupStops.length - 1];
  const firstMeta = first.stop.metadata as Record<string, unknown> | null;
  const mode = (firstMeta?.transport_mode as string) ?? "train";
  const depTime = fmtTime(first.stop.end_time ?? first.stop.start_time, timezone);
  const dest = last.stop.title ?? "?";

  result.push({
    kind: "transport",
    uid: first.stop.id,
    label: `${depTime} ${mode} to ${dest}`,
    mode,
    legs,
    onRemove: () => handlers.handleDelete(first.stop.id),
  });
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
