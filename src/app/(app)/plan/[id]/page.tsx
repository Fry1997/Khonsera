import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { PlanAdd } from "@/components/plan/plan-add";
import type { PlacePickerLocation } from "@/components/place-picker";
import { PlanImport } from "@/components/plan/plan-import";
import { PlanCalendarImport } from "@/components/plan/plan-calendar-import";
import { FlightFinder } from "@/components/plan/flight-finder";
import { StayFinder } from "@/components/plan/stay-finder";
import { ManageBookings } from "@/components/plan/manage-bookings";
import { loadBookedConnections } from "@/lib/actions/connections";
import { BudgetPanel } from "@/components/plan/budget-panel";
import { loadBudget } from "@/lib/actions/budget";
import { ShareControl } from "@/components/plan/share-control";
import { listLocationShares } from "@/lib/actions/sharing";
import { PlanConstraints } from "@/components/plan/plan-constraints";
import { loadConstraints } from "@/lib/actions/constraints";
import { PlanSpine, type SpineNode } from "@/components/plan/plan-spine";
import { PlanMap } from "@/components/plan/plan-map";
import { PlanTitleEditor } from "@/components/plan/plan-title-editor";
import { PlanBase } from "@/components/plan/plan-base";
import { PlanIntention } from "@/components/plan/plan-intention";
import {
  buildJourneyFromStops,
  type StopForMap,
  type TransitionForMap,
} from "@/components/journey-map/from-stops";
import { accommodationFromMetadata } from "@/lib/accommodation/types";
import { listNotesForStops, type NoteVM } from "@/lib/actions/notes";
import { loadReadiness } from "@/lib/actions/readiness";
import { ReadinessPanel } from "@/components/plan/readiness-panel";
import { PlanNudges } from "@/components/plan/plan-nudges";
import { loadNudges } from "@/lib/actions/context";
import {
  tflLegPlan,
  tflLineStatus,
  inGreaterLondon,
  type LatLng,
  type TflLine,
} from "@/lib/integrations/tfl";
import { liveDeparture } from "@/lib/integrations/darwin";
import { delayConsequence, fragility, cascade } from "@/lib/live/engine";
import { nextRailServices } from "@/lib/recovery/provider";
import { buildRecoveryOptions } from "@/lib/recovery/engine";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { setTransitionMode } from "@/lib/actions/transitions";
import { ensureHomeBookend } from "@/lib/actions/plan-edit";
import { checkLegFeasibility } from "@/lib/feasibility/check";
import { comfortBufferMinutes, stopModeOf } from "@/lib/itinerary/buffers";
import { deriveReviewLeaveBy } from "@/lib/actions/review-derive";
import { foldStopsToLegTickets } from "@/lib/tickets/from-stops";
import {
  formatClock,
  type AnchorVM,
  type AnchorType,
  type AnchorVariable,
  type AnchorVariableKind,
  type LegMode,
  type LegVM,
  type GapVM,
  type IntentionVM,
  type TicketVM,
} from "@/components/concierge";

function mapStopType(t: string): AnchorType {
  if (t === "shift") return "shift";
  if (t.includes("appointment")) return "appointment";
  if (t.includes("flight")) return "flight";
  if (t.includes("arrival") || t.includes("transit"))
    return "transport_arrival";
  if (t.includes("checkin") || t.includes("check_in"))
    return "accommodation_check_in";
  if (t.includes("checkout") || t.includes("check_out"))
    return "accommodation_check_out";
  if (t.includes("hotel") || t.includes("accommodation"))
    return "accommodation_check_in";
  return "custom";
}
const LEG_MODES = new Set([
  "walk",
  "drive",
  "taxi",
  "bus",
  "tube",
  "train",
  "flight",
  "mixed",
]);
const mapLegMode = (m: string): LegMode =>
  (LEG_MODES.has(m) ? m : "mixed") as LegMode;
function coordOfStop(s: StopRow | undefined): LatLng | null {
  if (!s) return null;
  const lat =
    s.customer_site?.latitude ??
    s.location?.latitude ??
    s.transport_hub?.latitude ??
    null;
  const lng =
    s.customer_site?.longitude ??
    s.location?.longitude ??
    s.transport_hub?.longitude ??
    null;
  return lat == null || lng == null ? null : { lat, lng };
}
const londonHHMM = (iso?: string | null): string | null =>
  iso
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(iso))
    : null;
const ymdLocal = (iso?: string | null): string | null => {
  if (!iso) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(iso);
  return m ? m[1] : null;
};

type StopRow = {
  id: string;
  sequence: number;
  type: string;
  title: string | null;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  is_time_fixed: boolean | null;
  app_mode: "work" | "personal" | null;
  metadata: Record<string, unknown> | null;
  location: {
    name?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  customer_site: {
    name?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  transport_hub: {
    code?: string | null;
    name?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
};
type TransRow = {
  id: string;
  from_stop_id: string;
  to_stop_id: string;
  mode: string;
  is_locked: boolean | null;
  computed_duration_minutes: number | null;
};
function bookedReturnDeparture(
  stops: StopRow[],
  transitions: TransRow[],
  afterIso: string,
): { iso: string } | null {
  const afterMs = new Date(afterIso).getTime();
  const byId = new Map(stops.map((st) => [st.id, st]));
  let best: { iso: string; ms: number } | null = null;
  for (const tr of transitions) {
    if (!tr.is_locked) continue;
    const from = byId.get(tr.from_stop_id);
    if (!from?.transport_hub?.code || !from.start_time) continue;
    const ms = new Date(from.start_time).getTime();
    if (ms <= afterMs) continue;
    if (!best || ms < best.ms) best = { iso: from.start_time, ms };
  }
  return best ? { iso: best.iso } : null;
}
function durationDisplay(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}
function arriveKind(stop: StopRow): AnchorVariableKind {
  const k = stop.metadata?.var_arrive_kind as AnchorVariableKind | undefined;
  if (k) return k;
  if ((stop.metadata?.timing_mode as string) === "maximize") return "maximise";
  return stop.is_time_fixed ? "precise" : "approximate";
}
function buildVars(stop: StopRow): AnchorVM["vars"] {
  const vars: NonNullable<AnchorVM["vars"]> = {};
  const isStart = stop.type === "start";
  const isEnd = stop.type === "end";
  const isShift = stop.type === "shift";
  if (stop.start_time && !isStart) {
    const kind = arriveKind(stop);
    vars.arriveBy = {
      kind: isShift ? "precise" : kind,
      iso: stop.start_time,
      display: isShift
        ? formatClock(stop.start_time)
        : kind === "approximate"
          ? `~${formatClock(stop.start_time)}`
          : formatClock(stop.start_time),
    } satisfies AnchorVariable;
  }
  if (stop.duration_minutes != null && !isStart && !isEnd)
    vars.duration = {
      kind: "precise",
      minutes: stop.duration_minutes,
      display: durationDisplay(stop.duration_minutes),
    };
  if (stop.end_time && !isEnd)
    vars.leaveBy = {
      kind: isShift
        ? "precise"
        : ((stop.metadata?.var_leave_kind as AnchorVariableKind) ?? "derived"),
      iso: stop.end_time,
      display: formatClock(stop.end_time),
    };
  return Object.keys(vars).length ? vars : undefined;
}
function spanLabel(start: string, end: string): string {
  const fmt = (s: string) =>
    new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(new Date(s));
  return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
}
async function loadSpine(itineraryId: string) {
  const supabase = await createClient();
  return Promise.all([
    supabase
      .from("stops")
      .select(
        "id, sequence, type, title, start_time, end_time, duration_minutes, is_time_fixed, app_mode, metadata, location:locations(name, latitude, longitude), customer_site:customer_sites(name, latitude, longitude), transport_hub:transport_hubs(code, name, latitude, longitude)",
      )
      .eq("itinerary_id", itineraryId)
      .order("sequence"),
    supabase
      .from("transitions")
      .select(
        "id, from_stop_id, to_stop_id, mode, is_locked, computed_duration_minutes, overview_polyline",
      )
      .eq("itinerary_id", itineraryId),
    supabase
      .from("intentions")
      .select(
        "id, description, target, buffer_minutes, state, flexibility, leave_by",
      )
      .eq("itinerary_id", itineraryId),
  ]);
}

export default async function PlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const [{ data: journey }] = await Promise.all([
    supabase
      .from("itineraries")
      .select("id, title, mode, date_start, date_end, status")
      .eq("id", id)
      .maybeSingle(),
    ensureHomeBookend(id, { create: false }),
  ]);
  if (!journey) notFound();
  let [{ data: s }, { data: t }, { data: i }] = await loadSpine(id);
  let stops = (s ?? []) as unknown as StopRow[];
  let transitions = (t ?? []) as unknown as TransRow[];
  const coordById = new Map(
    stops.map((st) => [st.id, coordOfStop(st)] as const),
  );
  const staleLegs = transitions.filter(
    (x) =>
      !x.is_locked &&
      x.computed_duration_minutes == null &&
      !!coordById.get(x.from_stop_id) &&
      !!coordById.get(x.to_stop_id),
  );
  if (staleLegs.length > 0) {
    for (const leg of staleLegs)
      await setTransitionMode({
        id: leg.id,
        mode: leg.mode as Parameters<typeof setTransitionMode>[0]["mode"],
      });
    [{ data: s }, { data: t }, { data: i }] = await loadSpine(id);
    stops = (s ?? []) as unknown as StopRow[];
    transitions = (t ?? []) as unknown as TransRow[];
  }
  const stopDates: string[] = [];
  for (const st of stops) {
    const a = ymdLocal(st.start_time);
    const b = ymdLocal(st.end_time);
    if (a) stopDates.push(a);
    if (b) stopDates.push(b);
  }
  stopDates.sort();
  const dateStart =
    stopDates.length && stopDates[0] < (journey.date_start as string)
      ? stopDates[0]
      : (journey.date_start as string);
  const dateEnd =
    stopDates.length &&
    stopDates[stopDates.length - 1] > (journey.date_end as string)
      ? stopDates[stopDates.length - 1]
      : (journey.date_end as string);
  if (dateStart !== journey.date_start || dateEnd !== journey.date_end)
    void supabase
      .from("itineraries")
      .update({ date_start: dateStart, date_end: dateEnd })
      .eq("id", id)
      .then(() => undefined);
  const intentions: IntentionVM[] = (i ?? []).map((x) => ({
    id: x.id as string,
    description: x.description as string,
    target: (x.target as string | null) ?? undefined,
    state: x.state as IntentionVM["state"],
    flexibility: x.flexibility as IntentionVM["flexibility"],
    leaveBy: (x.leave_by as string | null) ?? undefined,
  }));
  const transByPair = new Map<string, TransRow>();
  for (const tr of transitions)
    transByPair.set(`${tr.from_stop_id}->${tr.to_stop_id}`, tr);
  const anchorOf = (st: StopRow): AnchorVM => ({
    id: st.id,
    type: mapStopType(st.type),
    title: st.title ?? st.location?.name ?? "Stop",
    place: st.location?.name ?? undefined,
    time: st.start_time
      ? { from: st.start_time, to: st.end_time ?? undefined }
      : undefined,
    durationMinutes: st.duration_minutes ?? undefined,
    fixed: st.is_time_fixed ?? undefined,
    mode: st.app_mode ?? undefined,
    vars: buildVars(st),
  });
  const legOf = (tr: TransRow, from: StopRow, to: StopRow): LegVM => {
    const toFixed = to.is_time_fixed === true;
    const bufferMinutes =
      to.type === "shift"
        ? 0
        : comfortBufferMinutes(
            { type: to.type, mode: stopModeOf(to, tr.mode) },
            profile,
          );
    const feas =
      tr.is_locked || !toFixed
        ? ({ state: "ok" } as const)
        : checkLegFeasibility({
            fromEnd: from.end_time
              ? new Date(from.end_time)
              : from.start_time
                ? new Date(from.start_time)
                : null,
            toStart: to.start_time ? new Date(to.start_time) : null,
            travelMinutes: tr.computed_duration_minutes,
            bufferMinutes,
          });
    const atRisk = feas.state === "tight" || feas.state === "late";
    const departIso = from.end_time ?? from.start_time ?? undefined;
    const travelMin = tr.computed_duration_minutes;
    const realArrivalIso =
      departIso && travelMin != null
        ? new Date(
            new Date(departIso).getTime() + travelMin * 60_000,
          ).toISOString()
        : (to.start_time ?? undefined);
    const spareMinutes =
      toFixed && to.start_time && realArrivalIso
        ? Math.round(
            (new Date(to.start_time).getTime() -
              new Date(realArrivalIso).getTime()) /
              60_000,
          )
        : undefined;
    const toCoord = coordOfStop(to);
    const navHref =
      toCoord && !["walk", "drive"].includes(tr.mode)
        ? `/navigate?${new URLSearchParams({ dlat: String(toCoord.lat), dlng: String(toCoord.lng), dname: to.title ?? "Destination" }).toString()}`
        : undefined;
    return {
      id: `${tr.from_stop_id}->${tr.to_stop_id}`,
      mode: mapLegMode(tr.mode),
      fromLabel: from.title ?? "—",
      toLabel: to.title ?? "—",
      departure: departIso,
      arrival: realArrivalIso,
      arriveBeforeLabel:
        spareMinutes != null && spareMinutes > 0
          ? (to.title ?? undefined)
          : undefined,
      notes: travelMin ? `${travelMin} min` : undefined,
      bookingStatus: tr.is_locked ? "booked_in_app" : "manual",
      navHref,
      atRisk,
      riskNote: atRisk && "message" in feas ? feas.message : undefined,
      buffer: {
        state: feas.state,
        slackMinutes: "slackMinutes" in feas ? feas.slackMinutes : spareMinutes,
      },
    };
  };
  const stopById = new Map(stops.map((st) => [st.id, st]));
  const [
    constraints,
    readiness,
    allNotes,
    bookedConnections,
    budget,
    locationShares,
    { data: profile },
    { data: pickCustomers },
    { data: pickSites },
    { data: pickLocations },
  ] = await Promise.all([
    loadConstraints(),
    loadReadiness(id),
    listNotesForStops(stops.map((st) => st.id)),
    loadBookedConnections(id),
    loadBudget(id),
    listLocationShares(id),
    supabase
      .from("travel_profiles")
      .select(
        "default_arrival_buffer_minutes, default_airport_buffer_minutes, default_meeting_buffer_minutes",
      )
      .eq("user_id", ctx.userId)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle(),
    supabase
      .from("customers")
      .select("id, name")
      .eq("workspace_id", ctx.workspaceId)
      .order("name"),
    supabase
      .from("customer_sites")
      .select("id, customer_id, name, address")
      .eq("workspace_id", ctx.workspaceId),
    supabase
      .from("locations")
      .select("id, name, type, address")
      .eq("workspace_id", ctx.workspaceId)
      .order("type")
      .order("name"),
  ]);
  const notesByStop = new Map<string, NoteVM[]>();
  for (const n of allNotes) {
    if (!n.stopId) continue;
    const arr = notesByStop.get(n.stopId) ?? [];
    arr.push(n);
    notesByStop.set(n.stopId, arr);
  }
  const legTickets = foldStopsToLegTickets(
    stops.map((st) => ({
      id: st.id,
      type: st.type,
      title: st.title,
      start_time: st.start_time,
      end_time: st.end_time,
      code: st.transport_hub?.code ?? null,
      metadata: st.metadata,
    })),
  );
  const runLegs = new Map<string, typeof legTickets>();
  const consumed = new Set<string>();
  for (const lt of legTickets) {
    consumed.add(lt.originStopId);
    consumed.add(lt.destStopId);
    const arr = runLegs.get(lt.runDepartureStopId) ?? [];
    arr.push(lt);
    runLegs.set(lt.runDepartureStopId, arr);
  }
  type Unit = {
    key: string;
    entryId: string;
    exitId: string;
    anchor?: AnchorVM;
    pass?: TicketVM;
    live?: { crs: string | null; time: string | null; dest: string | null };
    passDelete?: string | null;
    continuesRun?: boolean;
  };
  const units: Unit[] = [];
  for (const st of stops) {
    if (st.type === "start" || st.type === "end") continue;
    if (consumed.has(st.id)) {
      const legs = runLegs.get(st.id);
      if (!legs) continue;
      legs.forEach((lt, idx) => {
        const originStop = stopById.get(lt.originStopId);
        const iso =
          originStop?.type === "transit_changeover"
            ? originStop.end_time
            : originStop?.start_time;
        const ms = iso ? new Date(iso).getTime() : null;
        const liveNow =
          ms != null &&
          ms >= Date.now() - 60 * 60_000 &&
          ms <= Date.now() + 180 * 60_000;
        units.push({
          key: `legpass-${lt.originStopId}`,
          entryId: lt.originStopId,
          exitId: lt.destStopId,
          pass: lt.ticket,
          live: liveNow
            ? {
                crs: originStop?.transport_hub?.code ?? null,
                time: londonHHMM(iso),
                dest: lt.ticket.legs[0]?.destination.code ?? null,
              }
            : { crs: null, time: null, dest: null },
          passDelete: lt.isFirstLeg ? lt.runDepartureStopId : null,
          continuesRun: idx < legs.length - 1,
        });
      });
      continue;
    }
    units.push({
      key: `anchor-${st.id}`,
      entryId: st.id,
      exitId: st.id,
      anchor: anchorOf(st),
    });
  }
  const multiDay = dateStart !== dateEnd;
  const londonDayKey = (iso: string): string =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
  const dayOf = (u: Unit): string | null => {
    const st = stopById.get(u.entryId);
    return st?.start_time ? londonDayKey(st.start_time) : null;
  };
  const fmtDay = (d: string) =>
    new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(new Date(`${d}T12:00:00`));
  let lastDay: string | null = null;
  const nodes: SpineNode[] = units.map((u, idx) => {
    const next = units[idx + 1];
    let after: SpineNode["after"] = null;
    let dayStart: string | undefined;
    if (multiDay) {
      const d = dayOf(u);
      if (d && d !== lastDay) {
        lastDay = d;
        const dayNum =
          Math.round(
            (new Date(`${d}T12:00:00`).getTime() -
              new Date(`${dateStart}T12:00:00`).getTime()) /
              86_400_000,
          ) + 1;
        dayStart = `Day ${dayNum} · ${fmtDay(d)}`;
      }
    }
    if (next && !u.continuesRun) {
      const fromStop = stopById.get(u.exitId)!;
      const toStop = stopById.get(next.entryId)!;
      const tr = transByPair.get(`${u.exitId}->${next.entryId}`);
      after = tr
        ? {
            kind: "leg",
            leg: legOf(tr, fromStop, toStop),
            transitionId: tr.id,
            itineraryId: id,
            fromStopId: u.exitId,
            toStopId: next.entryId,
          }
        : {
            kind: "gap",
            gap: {
              id: `gap-${u.exitId}-${next.entryId}`,
              type: "transport_gap",
              fromLabel: fromStop?.title ?? "here",
              toLabel: toStop?.title ?? "next",
              state: "open",
            } satisfies GapVM,
            itineraryId: id,
            fromStopId: u.exitId,
            toStopId: next.entryId,
          };
    }
    const entryStop = stopById.get(u.entryId);
    const accommodation =
      entryStop?.type === "accommodation"
        ? accommodationFromMetadata(entryStop?.metadata)
        : null;
    const notes = u.anchor ? (notesByStop.get(u.entryId) ?? []) : [];
    return {
      key: u.key,
      anchor: u.anchor,
      isBase: false,
      accommodation,
      notes,
      pass: u.pass,
      live: u.live,
      passDelete: u.passDelete,
      dayStart,
      after,
    };
  });

  const nowMs = Date.now();
  const LIVE_BEFORE_MS = 60 * 60_000;
  const LIVE_AHEAD_MS = 180 * 60_000;
  const inLiveWindow = (iso?: string | null): boolean => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return t >= nowMs - LIVE_BEFORE_MS && t <= nowMs + LIVE_AHEAD_MS;
  };
  const anyLiveLeg = nodes.some(
    (n) =>
      n.after?.kind === "leg" &&
      inLiveWindow(stopById.get(n.after.fromStopId)?.start_time),
  );
  const disrupted = new Map<string, TflLine>();
  if (anyLiveLeg) {
    const statusRes = await tflLineStatus();
    if (statusRes.mode !== "unavailable")
      for (const l of statusRes.data)
        if (l.state !== "good") disrupted.set(l.name.toLowerCase(), l);
  }
  const DELAY_FOR: Record<string, number> = {
    minor: 6,
    severe: 16,
    suspended: 35,
    info: 0,
  };
  const liveDelays: number[] = [];
  await Promise.all(
    nodes.map(async (n) => {
      if (n.after?.kind !== "leg") return;
      const fromStop = stopById.get(n.after.fromStopId);
      if (!inLiveWindow(fromStop?.start_time)) return;
      const crs = fromStop?.transport_hub?.code ?? null;
      if (
        n.after.leg.bookingStatus === "booked_in_app" &&
        crs &&
        fromStop?.start_time
      ) {
        const live = await liveDeparture(
          crs,
          londonHHMM(fromStop.start_time) ?? "",
        );
        if (live) {
          const m = /\+(\d+)/.exec(live.detail ?? "");
          const delayMin =
            live.label === "Cancelled" ? 999 : m ? Number(m[1]) : 0;
          if (delayMin > 0) {
            liveDelays.push(delayMin === 999 ? 60 : delayMin);
            const to = stopById.get(n.after.toStopId);
            const text = to?.start_time
              ? delayConsequence(
                  {
                    id: n.after.toStopId,
                    intoName: to.title ?? "your destination",
                    arriveIso: to.start_time,
                    deadlineIso: to.start_time,
                    kind: "connection",
                  },
                  delayMin === 999 ? 60 : delayMin,
                ).text
              : live.label;
            const severe = delayMin >= 16 || delayMin === 999;
            n.after.liveAlert = {
              title: live.label,
              text,
              state: severe ? "severe" : "minor",
            };
            const destCrs = to?.transport_hub?.code ?? null;
            if (severe && destCrs && to?.start_time && fromStop.start_time) {
              const durationMin = Math.round(
                (new Date(to.start_time).getTime() -
                  new Date(fromStop.start_time).getTime()) /
                  60_000,
              );
              const { candidates, sample } = await nextRailServices({
                originCrs: crs,
                destCrs,
                destName: to.title ?? destCrs,
                afterIso: fromStop.start_time,
                durationMin,
                originCoord: coordOfStop(fromStop),
                destCoord: coordOfStop(to),
              });
              const nextC = stops.find(
                (s) =>
                  s.start_time &&
                  new Date(s.start_time).getTime() >
                    new Date(to.start_time!).getTime() &&
                  s.type !== "start" &&
                  s.type !== "end" &&
                  s.type !== "accommodation",
              );
              const commitment = nextC?.start_time
                ? {
                    name: nextC.title ?? "your next commitment",
                    byIso: nextC.start_time,
                  }
                : null;
              const returnDep = bookedReturnDeparture(
                stops,
                transitions,
                to.start_time,
              );
              const protectedReturn = returnDep
                ? {
                    label: londonHHMM(returnDep.iso) ?? "return",
                    departIso: returnDep.iso,
                  }
                : null;
              const options = buildRecoveryOptions(
                candidates,
                commitment,
                protectedReturn,
              );
              if (options.length) n.after.recovery = { options, sample };
            }
          }
        }
      }
      const fromC = coordOfStop(fromStop);
      const toC = coordOfStop(stopById.get(n.after.toStopId));
      if (!inGreaterLondon(fromC) || !inGreaterLondon(toC)) return;
      const plan = await tflLegPlan(fromC!, toC!);
      if (!plan) return;
      const hit = plan.plan.legs.find(
        (l) => l.line && disrupted.has(l.line.toLowerCase()),
      );
      if (hit?.line) {
        const st = disrupted.get(hit.line.toLowerCase())!;
        plan.disruption = { line: st.name, state: st.state, status: st.status };
        const to = stopById.get(n.after.toStopId);
        const addMin = DELAY_FOR[st.state] ?? 0;
        if (addMin > 0) liveDelays.push(addMin);
        if (to?.start_time && addMin > 0)
          plan.consequence = delayConsequence(
            {
              id: n.after.toStopId,
              intoName: to.title ?? "your next stop",
              arriveIso: to.start_time,
              deadlineIso: to.start_time,
              kind: "commitment",
            },
            addMin,
          ).text;
      }
      n.after.tflPlan = plan;
    }),
  );
  const anyAtRisk = nodes.some(
    (n) => n.after?.kind === "leg" && n.after.leg.atRisk,
  );
  const planState: "empty" | "sparse" | "threaded" | "at-risk" =
    stops.length === 0
      ? "empty"
      : anyAtRisk
        ? "at-risk"
        : stops.length <= 2
          ? "sparse"
          : "threaded";
  const named = !!(journey.title && String(journey.title).trim());
  const title = named
    ? (journey.title as string)
    : spanLabel(dateStart, dateStart);
  const dateEyebrow = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "2-digit",
    month: "short",
  })
    .format(new Date(`${dateStart}T12:00:00`))
    .toUpperCase();
  const isTravelType = (t: string) =>
    t.includes("departure") ||
    t.includes("arrival") ||
    t.includes("changeover") ||
    t.includes("transit");
  const primaryAnchor =
    stops.find((s) => s.type === "shift") ??
    stops.find((s) => s.type.includes("appointment")) ??
    stops.find(
      (s) =>
        s.type !== "start" &&
        s.type !== "end" &&
        s.type !== "accommodation" &&
        !isTravelType(s.type) &&
        (s.title?.trim() || s.location?.name),
    ) ??
    null;
  const dayPurpose =
    (named ? (journey.title as string).trim() : "") ||
    primaryAnchor?.title?.trim() ||
    primaryAnchor?.location?.name?.trim() ||
    title;
  const startStop = stops.find((s) => s.type === "start");
  const baseLabel =
    startStop?.location?.name ??
    startStop?.customer_site?.name ??
    startStop?.transport_hub?.name ??
    null;
  const leaveByIso = deriveReviewLeaveBy(stops, transitions);
  const firstLeg = transitions.find((tr) => tr.from_stop_id === startStop?.id);
  const firstDest = firstLeg
    ? (stopById.get(firstLeg.to_stop_id)?.title ?? null)
    : null;
  const fragSlacks: number[] = [];
  let weakestInto: string | null = null;
  let weakestVal = Infinity;
  for (const n of nodes) {
    if (n.after?.kind !== "leg") continue;
    const b = n.after.leg.buffer;
    if (!b || b.state === "ok" || b.state === "unknown") continue;
    const slack = b.state === "late" ? -1 : (b.slackMinutes ?? 0);
    fragSlacks.push(slack);
    if (slack < weakestVal) {
      weakestVal = slack;
      weakestInto = n.after.leg.toLabel;
    }
  }
  const frag = fragility(fragSlacks);
  const dayDelay = liveDelays.length ? Math.max(...liveDelays) : 0;
  let ripple: string | null = null;
  if (dayDelay > 0) {
    const conns = stops
      .filter(
        (s) =>
          s.type !== "start" &&
          s.type !== "end" &&
          s.type !== "accommodation" &&
          s.start_time,
      )
      .map((s) => ({
        id: s.id,
        intoName: s.title ?? "your next thing",
        arriveIso: s.start_time!,
        deadlineIso: s.start_time!,
        kind: "commitment" as const,
      }));
    const cons = cascade(conns, dayDelay);
    const worst = cons.find((c) => c.broken);
    ripple = worst
      ? `The day's running ~${dayDelay} min behind — ${worst.text}`
      : `The day's running ~${dayDelay} min behind.`;
  }
  const nudgeRows = await loadNudges(id, nodes);
  const planMapStops: StopForMap[] = stops.map((st) => ({
    id: st.id,
    title: st.title,
    location: st.location,
    customer_site: st.customer_site,
    transport_hub: st.transport_hub,
  }));
  const planMapTransitions: TransitionForMap[] = transitions.map((tr) => ({
    from_stop_id: tr.from_stop_id,
    mode: tr.mode,
    overview_polyline: null,
    computed_duration_minutes: tr.computed_duration_minutes,
  }));
  const journeyMap = buildJourneyFromStops(planMapStops, planMapTransitions, {
    id,
    eyebrow: `${dateEyebrow} · DOOR TO DOOR`,
  });

  return (
    <main className="cc-plan-detail" data-state={planState}>
      <div className="cc-plan-grid">
        <section className="cc-plan-primary" aria-label="Day plan">
          <header className="cc-day-header">
            <span className="cc-day-header-eyebrow">{dateEyebrow}</span>
            <h1 className="cc-day-purpose-edit">
              <PlanTitleEditor
                itineraryId={id}
                title={dayPurpose}
                named={named}
              />
            </h1>
            <PlanBase itineraryId={id} label={baseLabel} />
            <PlanIntention itineraryId={id} intentions={intentions} />
          </header>
          {leaveByIso ? (
            <div className="cc-decision-clock">
              <span>Leave by</span>
              <strong>{formatClock(leaveByIso)}</strong>
              {firstDest ? <small>for {firstDest}</small> : null}
            </div>
          ) : null}
          {ripple ? <p className="cc-ripple">{ripple}</p> : null}
          <PlanSpine
            nodes={nodes}
            journeyDate={dateStart}
            eventId={id}
            isWork={journey.mode === "work"}
            customers={pickCustomers ?? []}
            customerSites={pickSites ?? []}
            locations={(pickLocations ?? []) as PlacePickerLocation[]}
          />
          <PlanNudges itineraryId={id} nudges={nudgeRows} />
          <ReadinessPanel itineraryId={id} items={readiness} />
        </section>
        <aside className="cc-plan-context" aria-label="Plan map and trip tools">
          {journeyMap ? <PlanMap journey={journeyMap} /> : null}
          <ManageBookings itineraryId={id} bookings={bookedConnections} />
          <section className="cc-plan-context-bundle">
            <input
              id={`day-tools-${id}`}
              className="cc-plan-context-toggle"
              type="checkbox"
            />
            <label htmlFor={`day-tools-${id}`}>
              <span>
                <strong>Day tools</strong>
                <small>Budget, sharing, constraints and additions</small>
              </span>
              <span aria-hidden>+</span>
            </label>
            <div className="cc-plan-context-body">
              <BudgetPanel itineraryId={id} data={budget} />
              <ShareControl itineraryId={id} shares={locationShares} />
              <PlanConstraints data={constraints} />
              <section className="cc-plan-tools" aria-label="Add to plan">
                <PlanAdd
                  journeyId={id}
                  journeyDate={dateStart}
                  customers={pickCustomers ?? []}
                  customerSites={pickSites ?? []}
                  locations={(pickLocations ?? []) as PlacePickerLocation[]}
                />
                <PlanImport journeyId={id} />
                <PlanCalendarImport journeyId={id} />
                <FlightFinder
                  journeyId={id}
                  passenger={{
                    givenName: "",
                    familyName: "",
                    email: ctx.email ?? "",
                  }}
                />
                <StayFinder journeyId={id} />
              </section>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
