import type { TicketSegment } from "@/components/train-ticket-card";
import type { GapMode, GapPreview } from "@/components/gap-mode-picker";
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
  gapPreviewsForPair: (fromId: string, toId: string) => Partial<Record<GapMode, GapPreview>>;
  onSetGapMode: (fromId: string, toId: string, mode: GapMode) => void;
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
    gapPreviewsForPair,
    onSetGapMode,
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
    if (first.kind === "transit") {
      // Home → station: show GapModePicker (walk/drive/taxi to station)
      const toLabel = first.stop.title ?? "station";
      const fromLabel = startStop.location?.name ?? startStop.title ?? "Home";
      const trans = planningTransitions.get(
        transitionKey(startStop.id, uidOf(first)),
      ) ?? emptyTransition();
      const currentMode = trans.mode as string;
      const selectedGap: GapMode | null =
        currentMode === "walk" || currentMode === "drive" || currentMode === "taxi"
          ? currentMode : null;
      result.push({
        kind: "gap-mode",
        fromLabel,
        toLabel,
        selected: selectedGap,
        previews: gapPreviewsForPair(startStop.id, uidOf(first)),
        onSelect: (mode: GapMode) => {
          if (mode === "walk" || mode === "drive" || mode === "taxi") {
            onSetGapMode(startStop.id, uidOf(first), mode);
          }
        },
      });
    } else {
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

      // After a transit group, if the next item is an anchor (or
      // stopover), show a GapModePicker for the last-mile walk from
      // the arrival station to the destination.
      const groupEndItem = planningTimeline[groupEnd];
      const afterGroup = planningTimeline[groupEnd + 1];
      if (groupEndItem && afterGroup && afterGroup.kind !== "transit") {
        const fromLabel = groupEndItem.stop.title ?? "station";
        const toLabel = afterGroup.kind === "anchor"
          ? (afterGroup.anchor.place?.label ?? afterGroup.stop.title ?? "destination")
          : (afterGroup.stop.title ?? "destination");
        const trans = planningTransitions.get(
          transitionKey(groupEndItem.stop.id, afterGroup.stop.id),
        ) ?? emptyTransition();
        const currentMode = trans.mode as string;
        const selectedGap: GapMode | null =
          currentMode === "walk" || currentMode === "drive" || currentMode === "taxi"
            ? currentMode : null;
        result.push({
          kind: "gap-mode",
          fromLabel,
          toLabel,
          selected: selectedGap,
          previews: gapPreviewsForPair(groupEndItem.stop.id, afterGroup.stop.id),
          onSelect: (mode: GapMode) => {
            if (mode === "walk" || mode === "drive" || mode === "taxi") {
              onSetGapMode(groupEndItem.stop.id, afterGroup.stop.id, mode);
            }
          },
        });
      }
    } else if (item.kind === "stopover") {
      buildStopoverEntry(result, item, i, planningTimeline, input);
    } else {
      // Find the nearest transit arrival before and transit departure
      // after this anchor — needed for maximize-info + free-time.
      const prevTransitArrival = findNearestTransit(planningTimeline, i, "before");
      const nextTransitDeparture = findNearestTransit(planningTimeline, i, "after");

      buildAnchorEntry(result, item, planningAnchors, input,
        prevTransitArrival, nextTransitDeparture);

      // Free-time hint: if the anchor has a fixed end time and there's
      // a departure coming, show how much free time the user has.
      if (
        item.anchor.timingMode !== "maximize" &&
        item.anchor.time &&
        item.anchor.durationMins &&
        nextTransitDeparture
      ) {
        const [ah, am] = item.anchor.time.split(":").map(Number);
        const endMin = ah * 60 + am + item.anchor.durationMins;
        const departMin = isoToMinutes(nextTransitDeparture, timezone);
        const freeMin = departMin - endMin;
        if (freeMin > 60) {
          const depTime = fmtTime(nextTransitDeparture, timezone);
          const freeH = Math.floor(freeMin / 60);
          const freeM = freeMin % 60;
          result.push({
            kind: "free-time",
            durationLabel: `${freeH}h${freeM > 0 ? ` ${freeM}m` : ""}`,
            beforeLabel: `before your ${depTime} departure`,
            onAddStop: () => handlers.handleInsertAnchorAt(item.stop.sequence + 1),
          });
        }
      }
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

      let transition = planningTransitions.get(
        transitionKey(stop.id, uidOf(nextItem)),
      ) ?? emptyTransition();

      if (
        (transition.mode as string) === "auto" &&
        !transition.booked &&
        nextItem.kind === "transit"
      ) {
        transition = { ...transition, mode: "walk" };
      }

      // Inline adds BEFORE the gap-mode picker — adding a stop between
      // the anchor and the station should come before choosing how you
      // get to the station.
      if (item.kind === "anchor" && nextItem) {
        result.push({
          kind: "inline-adds",
          onAddAnchor: () => handlers.handleInsertAnchorAt(nextItem.stop.sequence),
          onAddStopover: nextItem.kind === "anchor"
            ? () => handlers.handleInsertStopoverBetween(stop.id, nextItem.stop.id)
            : undefined,
        });
      }

      // Local connections (anchor ↔ transit stop) get the multi-badge
      // GapModePicker so the user sees walk/drive/taxi with times at a
      // glance — same UX as the brief page.
      if (nextItem.kind === "transit" && !transition.booked) {
        const fromLabel = fromAnchor.place?.label ?? stop.title ?? "here";
        const toLabel = nextItem.stop.title ?? "station";
        const currentMode = transition.mode as GapMode | string;
        const selectedGap: GapMode | null =
          currentMode === "walk" || currentMode === "drive" || currentMode === "taxi"
            ? currentMode
            : null;
        result.push({
          kind: "gap-mode",
          fromLabel,
          toLabel,
          selected: selectedGap,
          previews: gapPreviewsForPair(stop.id, uidOf(nextItem)),
          onSelect: (mode: GapMode) => {
            if (mode === "walk" || mode === "drive" || mode === "taxi") {
              onSetGapMode(stop.id, uidOf(nextItem), mode);
            }
          },
        });
      } else {
        result.push({
          kind: "gap-transition",
          from: fromAnchor,
          to: toAnchor,
          transition,
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
      }
    }
  }

  // Context-gap: when two transport groups appear with NO anchor
  // between them (user hasn't said what they're doing in that city),
  // show "You're in Derby for 6h 36m" with a prompt to add a stop.
  // Skip when there's already an anchor/stopover between the transports.
  const transportEntries = result.filter((e) => e.kind === "transport");
  for (let ti = 0; ti < transportEntries.length - 1; ti++) {
    const prev = transportEntries[ti] as Extract<TimelineEntry, { kind: "transport" }>;
    const next = transportEntries[ti + 1] as Extract<TimelineEntry, { kind: "transport" }>;
    const prevIdx = result.indexOf(prev);
    const nextIdx = result.indexOf(next);
    const between = result.slice(prevIdx + 1, nextIdx);
    const hasAnchor = between.some(
      (e) => e.kind === "anchor" || e.kind === "stopover",
    );
    if (hasAnchor) continue;
    const prevLegs = prev.legs;
    const nextLegs = next.legs;
    if (!prevLegs.length || !nextLegs.length) continue;
    const arriveTime = prevLegs[prevLegs.length - 1].arrival_time;
    const departTime = nextLegs[0].departure_time;
    const location = prevLegs[prevLegs.length - 1].to_station;
    if (!arriveTime || !departTime) continue;
    const [ah, am] = arriveTime.split(":").map(Number);
    const [dh, dm] = departTime.split(":").map(Number);
    const gap = (dh * 60 + dm) - (ah * 60 + am);
    if (gap <= 0) continue;
    const gH = Math.floor(gap / 60);
    const gM = gap % 60;
    const label = gH > 0
      ? `${gH}h${gM > 0 ? ` ${gM}m` : ""}`
      : `${gM}m`;
    const insertAt = prevIdx + 1;
    result.splice(insertAt, 0, {
      kind: "context-gap",
      location,
      durationLabel: label,
      onAddStop: () => {
        const nextStop = planningTimeline.find(
          (it) => it.kind === "transit" && it.stop.title === nextLegs[0].from_station,
        );
        handlers.handleInsertAnchorAt(nextStop?.stop.sequence ?? 0);
      },
    });
  }

  // Last transit → Home gap: show GapModePicker for the last mile home
  const lastTransitArr = planningTimeline
    .filter((it) => it.kind === "transit")
    .map((it) => it.stop)
    .filter((s) => {
      const meta = s.metadata as Record<string, unknown> | null;
      return meta?.kind === "transit_arrival";
    })
    .pop();
  const endStop = input.sortedStops.find((s) => s.type === "end") ?? startStop;
  if (lastTransitArr && endStop) {
    const fromLabel = lastTransitArr.title ?? "station";
    const toLabel = endStop.location?.name ?? endStop.title ?? "Home";
    const trans = planningTransitions.get(
      transitionKey(lastTransitArr.id, endStop.id),
    ) ?? emptyTransition();
    const currentMode = trans.mode as string;
    const selectedGap: GapMode | null =
      currentMode === "walk" || currentMode === "drive" || currentMode === "taxi"
        ? currentMode : null;
    result.push({
      kind: "gap-mode",
      fromLabel,
      toLabel,
      selected: selectedGap,
      previews: gapPreviewsForPair(lastTransitArr.id, endStop.id),
      onSelect: (mode: GapMode) => {
        if (mode === "walk" || mode === "drive" || mode === "taxi") {
          onSetGapMode(lastTransitArr.id, endStop.id, mode);
        }
      },
    });
  }

  // Home-return: show estimated home arrival after the last transport.
  if (lastTransitArr?.start_time) {
    const arrMin = isoToMinutes(lastTransitArr.start_time, timezone);
    const homeTransition = endStop
      ? transitions.find((t) => t.from_stop_id === lastTransitArr.id && t.to_stop_id === endStop.id)
      : transitions.find((t) => t.from_stop_id === lastTransitArr.id);
    const travelHome = homeTransition?.computed_duration_minutes ?? 0;
    const homeMin = arrMin + travelHome;
    result.push({
      kind: "home-return",
      arriveBy: minutesToHHMM(homeMin),
    });
  }

  return result;
}

function findNearestTransit(
  timeline: EditorTimelineItem[],
  fromIdx: number,
  direction: "before" | "after",
): string | null {
  const step = direction === "before" ? -1 : 1;
  for (let j = fromIdx + step; j >= 0 && j < timeline.length; j += step) {
    const it = timeline[j];
    if (it.kind !== "transit") continue;
    const meta = it.stop.metadata as Record<string, unknown> | null;
    if (direction === "before" && meta?.kind === "transit_arrival") {
      return it.stop.start_time;
    }
    if (direction === "after" && meta?.kind === "transit_departure") {
      return it.stop.end_time ?? it.stop.start_time;
    }
  }
  return null;
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
  prevTransitArrival: string | null,
  nextTransitDeparture: string | null,
) {
  const { expandedUids, editedAnchors, transitions, timezone, handlers } = input;
  const anchor = item.anchor;
  const isExpanded = expandedUids.has(anchor.uid);
  const liveAnchor = editedAnchors.get(anchor.uid) ?? anchor;
  const anchorIdx = planningAnchors.findIndex((a) => a.uid === anchor.uid);

  let maximizeInfo: { durationMins: number; arriveBy: string; leaveBy: string; travelNote?: string } | undefined = undefined;
  if (liveAnchor.timingMode === "maximize" && prevTransitArrival && nextTransitDeparture) {
    const arriveMin = isoToMinutes(prevTransitArrival, timezone);
    const departMin = isoToMinutes(nextTransitDeparture, timezone);
    const inTrans = findTransitionDuration(transitions, item.stop, "inbound");
    const outTrans = findTransitionDuration(transitions, item.stop, "outbound");
    const BUFFER = 10;
    const effectiveArrive = arriveMin + inTrans;
    const effectiveDepart = departMin - BUFFER - outTrans;
    const maxDur = effectiveDepart - effectiveArrive;
    if (maxDur > 0) {
      maximizeInfo = {
        durationMins: maxDur,
        arriveBy: minutesToHHMM(effectiveArrive),
        leaveBy: minutesToHHMM(effectiveDepart),
        travelNote: inTrans || outTrans
          ? `${inTrans}m in + ${outTrans}m out + ${BUFFER}m buffer`
          : undefined,
      };
    }
  }

  result.push({
    kind: "anchor",
    uid: anchor.uid,
    anchor: liveAnchor,
    earlier: planningAnchors.slice(0, anchorIdx >= 0 ? anchorIdx : 0),
    expanded: isExpanded,
    maximizeInfo,
    onModeChange: (next) =>
      next === "expanded"
        ? handlers.handleAnchorExpand(anchor.uid)
        : handlers.handleAnchorCollapse(anchor.uid),
    onChange: (patch) => handlers.handleAnchorPatch(anchor.uid, patch),
    onRemove: () => handlers.handleDelete(anchor.uid),
  });
}

function isoToMinutes(iso: string, tz: string): number {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz,
  }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

function minutesToHHMM(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function findTransitionDuration(
  transitions: DbTransition[],
  stop: DbStop,
  direction: "inbound" | "outbound",
): number {
  const t = direction === "inbound"
    ? transitions.find((tr) => tr.to_stop_id === stop.id)
    : transitions.find((tr) => tr.from_stop_id === stop.id);
  return t?.computed_duration_minutes ?? 0;
}
