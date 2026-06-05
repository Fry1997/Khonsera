// getPlanningViewData — the single page-level composer for the new planning
// view (Phase 5). Reads the itinerary's real stops + transitions and folds in
// the Phase 1–4 engine contracts (summary, trip-needs, appointment resolution,
// lifecycle) into one serialisable object the client `PlanningView` renders.
//
// The spine is built here, server-side, so the client component is a dumb
// renderer: an ordered list of stop-nodes and the legs between them, each
// already labelled and time-formatted in the workspace timezone.

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { getWorkspaceConfig } from "@/lib/flags/workspace-flags";
import { getItinerarySummary, getTripNeeds } from "@/lib/actions/planning";
import {
  resolveAppointment,
  appointmentMicrocopy,
  arriveAttribution,
  type ArriveValue,
  type DurationValue,
  type LeaveValue,
} from "@/lib/planning/appointment";
import { lifecycleState } from "@/lib/planning/booking-lifecycle";
import type { TripNeed } from "@/lib/planning/trip-needs";
import type { CostLine } from "@/lib/planning/summary";
import { formatTimeInTz } from "@/lib/types/time";

export type PlanningStopNode = {
  kind: "stop";
  id: string;
  nodeType: "home" | "gold" | "diamond" | "plain";
  time: string | null;
  label: string;
  title: string;
  // Appointment-only payload (nodeType gold).
  appointment?: {
    mode: string;
    arriveTime: string | null;
    leaveTime: string | null;
    durationMinutes: number | null;
    microcopy: string | null;
    attribution: string | null;
    durationKind: string | null;
  };
};

export type PlanningLegMode = {
  id: string;
  label: string;
  durationMin: number | null;
  recommended: boolean;
};

export type PlanningLegNode = {
  kind: "leg";
  transitionId: string | null;
  fromStopId: string;
  toStopId: string;
  // "train" renders as a booked rail card; "flex" renders the mode picker.
  variant: "train" | "flex";
  mode: string;
  locked: boolean;
  durationMin: number | null;
  chosenLabel: string;
  options: PlanningLegMode[];
  // train-only
  dep?: string | null;
  arr?: string | null;
};

export type PlanningSpineNode = PlanningStopNode | PlanningLegNode;

// One direction of a rail journey the PairedRailCard can fetch candidates for.
export type RailPairLeg = {
  fromStopId: string;
  toStopId: string;
  fromName: string;
  toName: string;
  fromCode: string | null;
  toCode: string | null;
  // Outbound: the time you must arrive by (the appointment). Return: the
  // earliest you can depart (the appointment's finish).
  arriveBy?: string | null;
  departAfter?: string | null;
};

export type RailPair = {
  outbound: RailPairLeg | null;
  return: RailPairLeg | null;
  // yyyy-mm-dd for the Trainline deeplink.
  outwardDate: string;
  returnDate: string | null;
};

export type PlanningViewData = {
  itinerary: {
    id: string;
    title: string;
    dateStart: string;
    dateEnd: string;
    status: string;
    travelStrategy: "rail" | "drive" | "mixed" | null;
  };
  lifecycle: {
    current: "Planning" | "Planned" | "Live" | "Completed";
    essentialsRemaining: number;
    canOverride: boolean;
  };
  header: {
    title: string;
    subtitle: string;
    summaryLine: string;
    costBreakdown: CostLine[];
  };
  digest: {
    stopCount: number;
    totalDistanceMi: number;
    totalDurationMin: number;
    totalCostPence: number;
    onSiteWindow: string | null;
  };
  spine: PlanningSpineNode[];
  needs: TripNeed[];
  railPair: RailPair | null;
  // Anchor for the "+" add sheet (transport booking / Gmail import attach here).
  lastStopId: string | null;
  lastStopLabel: string;
  timezone: string;
};

// Flexible modes offered in every gap picker (equal weight — no taxi default).
const FLEX_MODES: { id: string; label: string }[] = [
  { id: "walk", label: "Walk" },
  { id: "drive", label: "Drive" },
  { id: "taxi", label: "Taxi" },
  { id: "cycle", label: "Cycle" },
];

const LIFECYCLE_LABEL: Record<string, PlanningViewData["lifecycle"]["current"]> = {
  planning: "Planning",
  planned: "Planned",
  in_progress: "Live",
  completed: "Completed",
  cancelled: "Planning",
  draft: "Planning",
};

function fmt(iso: string | null, tz: string): string | null {
  return iso ? formatTimeInTz(new Date(iso), tz) : null;
}

function fmtMoney(pence: number): string {
  return `£${(pence / 100).toFixed(pence % 100 === 0 ? 0 : 2)}`;
}

function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

type StopRow = {
  id: string;
  type: string;
  title: string | null;
  start_time: string | null;
  end_time: string | null;
  arrive_value: ArriveValue | null;
  duration_value: DurationValue | null;
  leave_value: LeaveValue | null;
  location: { name: string | null } | { name: string | null }[] | null;
  customer_site: { name: string | null } | { name: string | null }[] | null;
  transport_hub:
    | { name: string | null; code: string | null }
    | { name: string | null; code: string | null }[]
    | null;
};

function one<T>(v: T | T[] | null): T | null {
  if (v == null) return null;
  return (Array.isArray(v) ? v[0] : v) ?? null;
}

function placeName(s: StopRow): string {
  return (
    one(s.customer_site)?.name ||
    one(s.location)?.name ||
    one(s.transport_hub)?.name ||
    s.title ||
    ""
  );
}

function nodeTypeFor(type: string): PlanningStopNode["nodeType"] {
  if (type === "start" || type === "end") return "home";
  if (type === "appointment") return "gold";
  if (type === "transit_departure" || type === "transit_arrival") return "diamond";
  return "plain";
}

function stopLabel(type: string): string {
  switch (type) {
    case "start": return "Leave home";
    case "end": return "Home";
    case "appointment": return "Appointment";
    case "accommodation": return "Stay";
    case "transit_departure": return "Depart";
    case "transit_arrival": return "Arrive";
    case "meal": return "Meal";
    case "event": return "Event";
    default: return type;
  }
}

export async function getPlanningViewData(
  itineraryId: string,
): Promise<PlanningViewData | null> {
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const wsCfg = await getWorkspaceConfig(ctx.workspaceId);
  const tz = wsCfg.timezone;

  const { data: itinerary } = await supabase
    .from("itineraries")
    .select("id, title, date_start, date_end, status, travel_strategy")
    .eq("id", itineraryId)
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();
  if (!itinerary) return null;

  const { data: stops } = await supabase
    .from("stops")
    .select(
      `id, sequence, type, title, start_time, end_time,
       arrive_value, duration_value, leave_value,
       location:locations(name),
       customer_site:customer_sites(name),
       transport_hub:transport_hubs(name, code)`,
    )
    .eq("itinerary_id", itineraryId)
    .order("sequence");

  const stopRows = (stops ?? []) as unknown as (StopRow & { sequence: number })[];
  const stopIds = stopRows.map((s) => s.id);

  const [{ data: transitions }, { data: previewRows }] = await Promise.all([
    supabase
      .from("transitions")
      .select(
        "id, from_stop_id, to_stop_id, mode, computed_duration_minutes, is_locked",
      )
      .eq("itinerary_id", itineraryId),
    stopIds.length > 0
      ? supabase
          .from("route_preview_cache")
          .select("from_stop_id, to_stop_id, mode, duration_minutes")
          .in("from_stop_id", stopIds)
      : Promise.resolve({ data: [] as never[] }),
  ]);
  const trans = transitions ?? [];
  const transByFrom = new Map<string, (typeof trans)[number]>();
  for (const t of trans) transByFrom.set(t.from_stop_id as string, t);

  // preview cache → duration by `${from}|${to}|${mode}`
  const previewDur = new Map<string, number | null>();
  for (const p of previewRows ?? []) {
    previewDur.set(
      `${p.from_stop_id}|${p.to_stop_id}|${p.mode}`,
      (p.duration_minutes as number | null) ?? null,
    );
  }

  // ── build the spine ─────────────────────────────────────────────────────
  const spine: PlanningSpineNode[] = [];
  let onSiteWindow: string | null = null;

  for (let i = 0; i < stopRows.length; i++) {
    const s = stopRows[i];
    const nodeType = nodeTypeFor(s.type);

    const node: PlanningStopNode = {
      kind: "stop",
      id: s.id,
      nodeType,
      time: fmt(s.start_time, tz),
      label: stopLabel(s.type),
      title: placeName(s),
    };

    if (s.type === "appointment") {
      const resolved = resolveAppointment({
        arrive: s.arrive_value ?? undefined,
        duration: s.duration_value ?? undefined,
        leave: s.leave_value ?? undefined,
      });
      node.appointment = {
        mode: resolved.mode,
        arriveTime: fmt(resolved.arrive.time, tz),
        leaveTime: fmt(resolved.leave.time, tz),
        durationMinutes: resolved.duration.minutes,
        microcopy: appointmentMicrocopy(resolved, { timezone: tz }),
        attribution: arriveAttribution(resolved, { timezone: tz }),
        durationKind: resolved.duration.kind,
      };
      if (resolved.arrive.time && resolved.leave.time) {
        onSiteWindow = `${fmt(resolved.arrive.time, tz)} – ${fmt(resolved.leave.time, tz)}`;
      }
    }

    spine.push(node);

    // Leg to the next stop.
    const next = stopRows[i + 1];
    if (!next) continue;
    const t = transByFrom.get(s.id);
    const mode = (t?.mode as string | undefined) ?? "walk";
    const locked = (t?.is_locked as boolean | undefined) ?? false;
    const isTrain = locked && ["train", "flight", "bus", "tube"].includes(mode);

    if (isTrain) {
      spine.push({
        kind: "leg",
        transitionId: (t?.id as string) ?? null,
        fromStopId: s.id,
        toStopId: next.id,
        variant: "train",
        mode,
        locked,
        durationMin: (t?.computed_duration_minutes as number | null) ?? null,
        chosenLabel: mode,
        options: [],
        dep: fmt(s.start_time, tz),
        arr: fmt(next.start_time, tz),
      });
    } else {
      const options: PlanningLegMode[] = FLEX_MODES.map((m) => ({
        id: m.id,
        label: m.label,
        durationMin:
          m.id === mode
            ? ((t?.computed_duration_minutes as number | null) ??
              previewDur.get(`${s.id}|${next.id}|${m.id}`) ??
              null)
            : (previewDur.get(`${s.id}|${next.id}|${m.id}`) ?? null),
        recommended: m.id === mode,
      }));
      const chosen = options.find((o) => o.recommended) ?? options[0];
      spine.push({
        kind: "leg",
        transitionId: (t?.id as string) ?? null,
        fromStopId: s.id,
        toStopId: next.id,
        variant: "flex",
        mode,
        locked,
        durationMin: chosen?.durationMin ?? null,
        chosenLabel: chosen?.label ?? "Walk",
        options,
      });
    }
  }

  // ── rail pair (for the PairedRailCard) ──────────────────────────────────
  // Find the focal appointment; train legs before it are outbound, after it
  // are return. We surface the first of each so the card can fetch candidates.
  const focalIdx = (() => {
    const a = stopRows.findIndex((s) => s.type === "appointment");
    if (a >= 0) return a;
    const e = stopRows.findIndex((s) => s.type === "end");
    return e >= 0 ? e : stopRows.length - 1;
  })();
  const focalStop = stopRows[focalIdx];

  const railLeg = (i: number): RailPairLeg => {
    const from = stopRows[i];
    const to = stopRows[i + 1];
    return {
      fromStopId: from.id,
      toStopId: to.id,
      fromName: placeName(from),
      toName: placeName(to),
      fromCode: one(from.transport_hub)?.code ?? null,
      toCode: one(to.transport_hub)?.code ?? null,
    };
  };

  let outbound: RailPairLeg | null = null;
  let ret: RailPairLeg | null = null;
  for (let i = 0; i < stopRows.length - 1; i++) {
    const t = transByFrom.get(stopRows[i].id);
    if (!t || t.mode !== "train" || !t.is_locked) continue;
    if (!outbound && i + 1 <= focalIdx) {
      outbound = { ...railLeg(i), arriveBy: focalStop?.start_time ?? null };
    } else if (!ret && i >= focalIdx) {
      ret = {
        ...railLeg(i),
        departAfter: focalStop?.end_time ?? focalStop?.start_time ?? null,
      };
    }
  }

  const railPair: RailPair | null =
    outbound || ret
      ? {
          outbound,
          return: ret,
          outwardDate: (itinerary.date_start as string).slice(0, 10),
          returnDate: ret ? (itinerary.date_start as string).slice(0, 10) : null,
        }
      : null;

  const lastStop = stopRows[stopRows.length - 1];

  // ── contracts ───────────────────────────────────────────────────────────
  const summaryRes = await getItinerarySummary(itineraryId);
  const needsRes = await getTripNeeds(itineraryId);
  const summary = summaryRes.ok
    ? summaryRes.value
    : {
        stopCount: stopRows.length,
        totalDistanceMi: 0,
        totalDurationMin: 0,
        totalCostPence: 0,
        costBreakdown: [],
        essentialsRemaining: 0,
      };

  const summaryBits = [
    `${summary.stopCount} stop${summary.stopCount === 1 ? "" : "s"}`,
    summary.totalDistanceMi > 0 ? `${summary.totalDistanceMi} mi` : null,
    summary.totalDurationMin > 0 ? fmtDuration(summary.totalDurationMin) : null,
    summary.totalCostPence > 0 ? fmtMoney(summary.totalCostPence) : null,
  ].filter(Boolean);

  const firstPlace = stopRows.find((s) => s.type === "start");
  const focal =
    stopRows.find((s) => s.type === "appointment") ??
    stopRows.find((s) => s.type === "end");
  const subtitleBits = [
    fmtDateShort(itinerary.date_start, tz),
    firstPlace && focal && placeName(firstPlace) && placeName(focal)
      ? `${placeName(firstPlace)} → ${placeName(focal)}`
      : null,
  ].filter(Boolean);

  const statusKey = itinerary.status as string;
  const current = LIFECYCLE_LABEL[statusKey] ?? "Planning";

  return {
    itinerary: {
      id: itinerary.id as string,
      title: (itinerary.title as string | null) ?? "Untitled trip",
      dateStart: itinerary.date_start as string,
      dateEnd: itinerary.date_end as string,
      status: statusKey,
      travelStrategy:
        (itinerary.travel_strategy as "rail" | "drive" | "mixed" | null) ?? null,
    },
    lifecycle: {
      current,
      essentialsRemaining: summary.essentialsRemaining,
      // Offer manual advance once planning is done but nothing's auto-advanced.
      canOverride: current === "Planning" && summary.essentialsRemaining === 0,
    },
    header: {
      title: (itinerary.title as string | null) ?? "Untitled trip",
      subtitle: subtitleBits.join(" · "),
      summaryLine: summaryBits.join(" · "),
      costBreakdown: summary.costBreakdown,
    },
    digest: {
      stopCount: summary.stopCount,
      totalDistanceMi: summary.totalDistanceMi,
      totalDurationMin: summary.totalDurationMin,
      totalCostPence: summary.totalCostPence,
      onSiteWindow,
    },
    spine,
    needs: needsRes.ok ? needsRes.value : [],
    railPair,
    lastStopId: lastStop?.id ?? null,
    lastStopLabel: lastStop ? placeName(lastStop) || "the last stop" : "the last stop",
    timezone: tz,
  };
}

function fmtDateShort(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}
