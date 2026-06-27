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
import { buildJourneyFromStops, type StopForMap, type TransitionForMap } from "@/components/journey-map/from-stops";
import { accommodationFromMetadata } from "@/lib/accommodation/types";
import { listNotesForStops, type NoteVM } from "@/lib/actions/notes";
import { loadReadiness } from "@/lib/actions/readiness";
import { ReadinessPanel } from "@/components/plan/readiness-panel";
import { PlanNudges } from "@/components/plan/plan-nudges";
import { loadNudges } from "@/lib/actions/context";
import { tflLegPlan, tflLineStatus, inGreaterLondon, type LatLng, type TflLine } from "@/lib/integrations/tfl";
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

// Plan — the Event DETAIL (proposal §3b). The single spine, scoped to one Event:
// capture (manual add), the three-variable AnchorCard, leg comparison, constraints,
// the five planner states. Opening re-runs the solver (guarded, E3) so legacy
// plans don't show bare legs.

function mapStopType(t: string): AnchorType {
  if (t.includes("appointment")) return "appointment";
  if (t.includes("flight")) return "flight";
  if (t.includes("arrival") || t.includes("transit")) return "transport_arrival";
  if (t.includes("checkin") || t.includes("check_in")) return "accommodation_check_in";
  if (t.includes("checkout") || t.includes("check_out")) return "accommodation_check_out";
  if (t.includes("hotel") || t.includes("accommodation")) return "accommodation_check_in";
  return "custom";
}
const LEG_MODES = new Set(["walk", "drive", "taxi", "bus", "tube", "train", "flight", "mixed"]);
const mapLegMode = (m: string): LegMode => (LEG_MODES.has(m) ? m : "mixed") as LegMode;

function coordOfStop(s: StopRow | undefined): LatLng | null {
  if (!s) return null;
  const lat = s.customer_site?.latitude ?? s.location?.latitude ?? s.transport_hub?.latitude ?? null;
  const lng = s.customer_site?.longitude ?? s.location?.longitude ?? s.transport_hub?.longitude ?? null;
  return lat == null || lng == null ? null : { lat, lng };
}

const londonHHMM = (iso?: string | null): string | null =>
  iso
    ? new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso))
    : null;

// The YYYY-MM-DD prefix of an ISO timestamp — matches the span inference that
// used to live in inferAndUpdateSpan (a plain slice, not a tz conversion).
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
  location: { name?: string | null; latitude?: number | null; longitude?: number | null } | null;
  customer_site: { name?: string | null; latitude?: number | null; longitude?: number | null } | null;
  transport_hub: { code?: string | null; name?: string | null; latitude?: number | null; longitude?: number | null } | null;
};
type TransRow = {
  id: string;
  from_stop_id: string;
  to_stop_id: string;
  mode: string;
  is_locked: boolean | null;
  computed_duration_minutes: number | null;
};

// The booked return = the first LOCKED (booked-in-app) rail departure that
// leaves after the outbound has arrived. Its departure is a hard, perishable
// commitment — miss it and the ticket's gone — so recovery protects it.
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
  // Home `start` is where the day BEGINS — it has no "arrive by", only a "leave
  // by" (when you set off, derived from the first fixed thing downstream). Home
  // `end` is the reverse: only an "arrive by" (when you get back), no "leave by".
  // Without this the start showed a phantom arrive-by that broke the first leg.
  const isStart = stop.type === "start";
  const isEnd = stop.type === "end";

  if (stop.start_time && !isStart) {
    const kind = arriveKind(stop);
    vars.arriveBy = {
      kind,
      iso: stop.start_time,
      display: kind === "approximate" ? `~${formatClock(stop.start_time)}` : formatClock(stop.start_time),
    } satisfies AnchorVariable;
  }
  if (stop.duration_minutes != null && !isStart && !isEnd) {
    const kind = (stop.metadata?.var_duration_kind as AnchorVariableKind) ?? "precise";
    vars.duration = { kind, minutes: stop.duration_minutes, display: durationDisplay(stop.duration_minutes) };
  }
  if (stop.end_time && !isEnd) {
    const kind = (stop.metadata?.var_leave_kind as AnchorVariableKind) ?? "derived";
    vars.leaveBy = { kind, iso: stop.end_time, display: formatClock(stop.end_time) };
  }
  return Object.keys(vars).length ? vars : undefined;
}

function spanLabel(start: string, end: string): string {
  const fmt = (s: string) =>
    new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(new Date(s));
  return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
}

async function loadSpine(itineraryId: string) {
  const supabase = await createClient();
  return Promise.all([
    supabase
      .from("stops")
      .select("id, sequence, type, title, start_time, end_time, duration_minutes, is_time_fixed, app_mode, metadata, location:locations(name, latitude, longitude), customer_site:customer_sites(name, latitude, longitude), transport_hub:transport_hubs(code, name, latitude, longitude)")
      .eq("itinerary_id", itineraryId)
      .order("sequence"),
    supabase
      .from("transitions")
      .select("id, from_stop_id, to_stop_id, mode, is_locked, computed_duration_minutes, overview_polyline")
      .eq("itinerary_id", itineraryId),
    supabase
      .from("intentions")
      .select("id, description, target, buffer_minutes, state, flexibility, leave_by")
      .eq("itinerary_id", itineraryId),
  ]);
}

export default async function PlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireUserContext();
  const supabase = await createClient();

  // Fetch the journey and collapse any stray duplicate home stops concurrently —
  // they're independent (one reads itineraries, the other dedupes stops). We do
  // NOT create home here — creation lives in the mutations so concurrent renders
  // can't race and flash "home home … home home". Collapse is idempotent.
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

  // E3 — opening heals stale plans (incl. legacy data routed before the
  // transport-hub-coords fix / the distance fallback). Re-route any unbooked leg
  // missing a duration so it gets a real door-to-door time, then re-solve.
  // NOTE: render is READ-MOSTLY — do NOT re-sequence/re-thread here. Doing that
  // raced across concurrent renders (prefetch + navigate) and made the order +
  // times jump on every refresh. Re-sequencing lives in the mutations.
  //
  // ONLY heal legs we can actually route: both endpoints must be geocoded. A leg
  // with an un-geocoded endpoint will NEVER get a duration from routing, so
  // re-routing it was burning an external route call + a full re-solve on EVERY
  // open (the planning-tab slowness — a few un-routable legs = several seconds
  // per navigation). Leave those null (honest "travel needed") until the endpoint
  // gains coords; a real edit re-routes them. The per-leg setTransitionMode
  // already re-solves, so no trailing whole-itinerary resolve is needed.
  const coordById = new Map(stops.map((st) => [st.id, coordOfStop(st)] as const));
  const staleLegs = transitions.filter(
    (x) =>
      !x.is_locked &&
      x.computed_duration_minutes == null &&
      !!coordById.get(x.from_stop_id) &&
      !!coordById.get(x.to_stop_id),
  );
  if (staleLegs.length > 0) {
    for (const leg of staleLegs) {
      await setTransitionMode({ id: leg.id, mode: leg.mode as Parameters<typeof setTransitionMode>[0]["mode"] });
    }
    [{ data: s }, { data: t }, { data: i }] = await loadSpine(id);
    stops = (s ?? []) as unknown as StopRow[];
    transitions = (t ?? []) as unknown as TransRow[];
  }

  // Day span — earliest/latest stop date, never narrower than the stored span.
  // Computed from the stops we ALREADY loaded (was: inferAndUpdateSpan re-read
  // the journey + every stop, then a third query re-fetched the span — three
  // serial round trips on every render for a value we already have in hand).
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
    stopDates.length && stopDates[stopDates.length - 1] > (journey.date_end as string)
      ? stopDates[stopDates.length - 1]
      : (journey.date_end as string);
  // Persist only if the stored span actually drifted — fire-and-forget so the
  // write never blocks the render (the value above is already correct for paint).
  if (dateStart !== journey.date_start || dateEnd !== journey.date_end) {
    void supabase
      .from("itineraries")
      .update({ date_start: dateStart, date_end: dateEnd })
      .eq("id", id)
      .then(() => undefined);
  }

  const intentions: IntentionVM[] = (i ?? []).map((x) => ({
    id: x.id as string,
    description: x.description as string,
    target: (x.target as string | null) ?? undefined,
    state: x.state as IntentionVM["state"],
    flexibility: x.flexibility as IntentionVM["flexibility"],
    leaveBy: (x.leave_by as string | null) ?? undefined,
  }));

  const transByPair = new Map<string, TransRow>();
  for (const tr of transitions) transByPair.set(`${tr.from_stop_id}->${tr.to_stop_id}`, tr);

  const anchorOf = (st: StopRow): AnchorVM => ({
    id: st.id,
    type: mapStopType(st.type),
    title: st.title ?? st.location?.name ?? "Stop",
    place: st.location?.name ?? undefined,
    time: st.start_time ? { from: st.start_time, to: st.end_time ?? undefined } : undefined,
    durationMinutes: st.duration_minutes ?? undefined,
    fixed: st.is_time_fixed ?? undefined,
    mode: st.app_mode ?? undefined,
    vars: buildVars(st),
  });
  const legOf = (tr: TransRow, from: StopRow, to: StopRow): LegVM => {
    // A warning is only honest when arriving INTO a FIXED time (a train you must
    // catch, a meeting with a hard arrive-by). When the destination is flexible
    // the solver simply slides it — there's nothing to be late for, so we don't
    // moan about slack on a route we freely built. When it IS fixed, the comfort
    // buffer for that stop is the "comfortable" threshold, so the slack we report
    // is measured against the early-margin the user actually wants.
    const toFixed = to.is_time_fixed === true;
    const feas = tr.is_locked || !toFixed
      ? ({ state: "ok" } as const)
      : checkLegFeasibility({
          fromEnd: from.end_time ? new Date(from.end_time) : from.start_time ? new Date(from.start_time) : null,
          toStart: to.start_time ? new Date(to.start_time) : null,
          travelMinutes: tr.computed_duration_minutes,
          bufferMinutes: comfortBufferMinutes(
            { type: to.type, mode: stopModeOf(to, tr.mode) },
            profile,
          ),
        });
    const atRisk = feas.state === "tight" || feas.state === "late";
    // You LEAVE at the from stop's end_time; you ARRIVE travel-minutes later — which,
    // with a comfort buffer, is EARLIER than the fixed event. Show that real arrival
    // (not the event time) so the buffer is visible as a gap, and surface the spare
    // minutes explicitly ("12 min spare") instead of a vague "Comfortable".
    const departIso = from.end_time ?? from.start_time ?? undefined;
    const travelMin = tr.computed_duration_minutes;
    const realArrivalIso =
      departIso && travelMin != null
        ? new Date(new Date(departIso).getTime() + travelMin * 60_000).toISOString()
        : (to.start_time ?? undefined);
    // Spare = how early you land before a FIXED commitment (the buffer made real).
    const spareMinutes =
      toFixed && to.start_time && realArrivalIso
        ? Math.round((new Date(to.start_time).getTime() - new Date(realArrivalIso).getTime()) / 60_000)
        : undefined;
    // "Take me there" deep-link into the point-to-point router, pre-filling the
    // leg's destination — present only when the destination carries a coordinate.
    const toCoord = coordOfStop(to);
    const navHref = toCoord
      ? `/navigate?${new URLSearchParams({ dlat: String(toCoord.lat), dlng: String(toCoord.lng), dname: to.title ?? "Destination" }).toString()}`
      : undefined;
    return {
      id: `${tr.from_stop_id}->${tr.to_stop_id}`,
      mode: mapLegMode(tr.mode),
      fromLabel: from.title ?? "—",
      toLabel: to.title ?? "—",
      departure: departIso,
      arrival: realArrivalIso,
      arriveBeforeLabel: spareMinutes != null && spareMinutes > 0 ? (to.title ?? undefined) : undefined,
      notes: travelMin ? `${travelMin} min` : undefined,
      bookingStatus: tr.is_locked ? "booked_in_app" : "manual",
      navHref,
      atRisk,
      riskNote: atRisk && "message" in feas ? feas.message : undefined,
      buffer: {
        state: feas.state,
        // The spare margin, shown for every classification (not just 'tight') so the
        // buffer is always legible: "X min spare before your event".
        slackMinutes: "slackMinutes" in feas ? feas.slackMinutes : spareMinutes,
      },
    };
  };

  const stopById = new Map(stops.map((st) => [st.id, st]));

  // Independent readers in parallel. This was a 6-deep SERIAL waterfall (and each
  // reader re-runs its own auth lookup) — ~1s of pure blocking before the cards
  // could render. They don't depend on each other or on the node graph, so one
  // Promise.all collapses the wait to the slowest single reader. RLS scopes each
  // to the viewer. (loadNudges stays separate below — it needs the built nodes.)
  // Independent readers in ONE parallel wave — none depend on each other or on the
  // node graph, so the wait collapses to the slowest single reader. Includes the
  // PlacePicker data (customers/sites/locations) and the travel profile, which used
  // to run as their own separate awaited waves AFTER this one. RLS scopes each to
  // the viewer. (loadNudges stays separate below — it needs the built nodes.)
  const [
    constraints, readiness, allNotes, bookedConnections, budget, locationShares,
    { data: profile },
    { data: pickCustomers }, { data: pickSites }, { data: pickLocations },
  ] = await Promise.all([
    loadConstraints(),
    loadReadiness(id),
    listNotesForStops(stops.map((st) => st.id)),
    loadBookedConnections(id),
    loadBudget(id),
    listLocationShares(id),
    supabase
      .from("travel_profiles")
      .select("default_arrival_buffer_minutes, default_airport_buffer_minutes, default_meeting_buffer_minutes")
      .eq("user_id", ctx.userId)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle(),
    supabase.from("customers").select("id, name").eq("workspace_id", ctx.workspaceId).order("name"),
    supabase.from("customer_sites").select("id, customer_id, name, address").eq("workspace_id", ctx.workspaceId),
    supabase.from("locations").select("id, name, type, address").eq("workspace_id", ctx.workspaceId).order("type").order("name"),
  ]);
  const notesByStop = new Map<string, NoteVM[]>();
  for (const n of allNotes) {
    if (!n.stopId) continue;
    const arr = notesByStop.get(n.stopId) ?? [];
    arr.push(n);
    notesByStop.set(n.stopId, arr);
  }

  // Render each booked rail hop (departure→change, change→arrival, …) as its OWN
  // docked Pass card with that hop's stations, times, platform + live status (user
  // request). The internal locked legs surface AS cards, not folded away; a return
  // is just the next run downstream — the timeline carries the order.
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
  // All stops belonging to a run are represented inside the leg cards.
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
    passDelete?: string | null; // run departure stop id, on the first leg only
    continuesRun?: boolean; // next unit is this run's next hop → suppress the leg/gap between
  };
  const units: Unit[] = [];
  for (const st of stops) {
    if (consumed.has(st.id)) {
      // Emit the run's hop cards once — when we reach its departure stop. Change /
      // arrival stops are part of a hop already, so we skip them here.
      const legs = runLegs.get(st.id);
      if (!legs) continue;
      legs.forEach((lt, idx) => {
        const originStop = stopById.get(lt.originStopId);
        const iso = originStop?.type === "transit_changeover" ? originStop.end_time : originStop?.start_time;
        // Live departure status is only fetched (client-side, via LivePass) when
        // this hop leaves around NOW — otherwise a future day's 08:15 would show
        // TODAY's 08:15 platform/timing. Window: 1h after → 3h before departure.
        const ms = iso ? new Date(iso).getTime() : null;
        const liveNow = ms != null && ms >= Date.now() - 60 * 60_000 && ms <= Date.now() + 180 * 60_000;
        units.push({
          key: `legpass-${lt.originStopId}`,
          entryId: lt.originStopId,
          exitId: lt.destStopId,
          pass: lt.ticket,
          // dest CRS disambiguates same-minute departures at a busy interchange
          // (Luton can have two 07:50s on different platforms — match the one
          // calling at this hop's destination, not just any train at that time).
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
    units.push({ key: `anchor-${st.id}`, entryId: st.id, exitId: st.id, anchor: anchorOf(st) });
  }

  // Day dividers on multi-day Events (proposal §5/chunk 5): label the first node
  // of each calendar day "Day N · Wed 25 Jun".
  const multiDay = dateStart !== dateEnd;
  // Day key in the DISPLAY timezone (Europe/London), not UTC — a 00:30 BST stop is
  // 23:30 UTC the day before; a UTC slice would mis-attribute it and mis-number the
  // day divider. en-CA yields YYYY-MM-DD.
  const londonDayKey = (iso: string): string =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  const dayOf = (u: Unit): string | null => {
    const st = stopById.get(u.entryId);
    return st?.start_time ? londonDayKey(st.start_time) : null;
  };
  const fmtDay = (d: string) =>
    new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${d}T12:00:00`));
  let lastDay: string | null = null;

  const nodes: SpineNode[] = units.map((u, idx) => {
    const next = units[idx + 1];
    let after: SpineNode["after"] = null;

    let dayStart: string | undefined;
    if (multiDay) {
      const d = dayOf(u);
      if (d && d !== lastDay) {
        lastDay = d;
        const dayNum = Math.round((new Date(`${d}T12:00:00`).getTime() - new Date(`${dateStart}T12:00:00`).getTime()) / 86_400_000) + 1;
        dayStart = `Day ${dayNum} · ${fmtDay(d)}`;
      }
    }
    // Within a single run, consecutive hops share the change station — no walk/gap
    // card belongs between them (the train carries straight through the change).
    if (next && !u.continuesRun) {
      const fromStop = stopById.get(u.exitId)!;
      const toStop = stopById.get(next.entryId)!;
      const tr = transByPair.get(`${u.exitId}->${next.entryId}`);
      after = tr
        ? { kind: "leg", leg: legOf(tr, fromStop, toStop), transitionId: tr.id, itineraryId: id, fromStopId: u.exitId, toStopId: next.entryId }
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
    // Home `start`/`end` stops are the day's base (origin / return-home), not
    // editable anchors. Flag them so the spine renders a fixed home card.
    const entryStop = stopById.get(u.entryId);
    const entryType = entryStop?.type;
    // The auto "Back to your car" waypoint renders like a base node — quiet and
    // not editable/removable (it's derived, not a fact the user placed).
    const isCollectCar = (entryStop?.metadata as Record<string, unknown> | null)?.kind === "collect_car";
    const isBase = entryType === "start" || entryType === "end" || isCollectCar;
    const accommodation =
      entryType === "accommodation" ? accommodationFromMetadata(entryStop?.metadata) : null;
    const notes = u.anchor ? notesByStop.get(u.entryId) ?? [] : [];
    return { key: u.key, anchor: u.anchor, isBase, baseEyebrow: isCollectCar ? "Back to your car" : undefined, accommodation, notes, pass: u.pass, live: u.live, passDelete: u.passDelete, dayStart, after };
  });

  // Live status (Darwin departures, TfL line status + leg plans) is only meaningful
  // for trains leaving around NOW — a live board has a ~few-hour horizon. Without
  // this guard, opening a FUTURE day (e.g. the 25th) matched its 08:15 against
  // TODAY's 08:15 board and showed the wrong platform/timing. Only enrich legs whose
  // scheduled departure sits in the live window.
  const nowMs = Date.now();
  const LIVE_BEFORE_MS = 60 * 60_000; // up to 1h after a scheduled departure
  const LIVE_AHEAD_MS = 180 * 60_000; // up to 3h before — the board's useful horizon
  const inLiveWindow = (iso?: string | null): boolean => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return t >= nowMs - LIVE_BEFORE_MS && t <= nowMs + LIVE_AHEAD_MS;
  };
  const anyLiveLeg = nodes.some((n) => n.after?.kind === "leg" && inLiveWindow(stopById.get(n.after.fromStopId)?.start_time));

  // Phase 8 — resolve each London transit leg to a live TfL plan; Phase 9 — when a
  // line on that route is disrupted, translate it into a consequence on the next
  // commitment (the live engine). Mock until TFL_APP_KEY is set. Only when the day
  // actually has a leg leaving around now.
  const disrupted = new Map<string, TflLine>();
  if (anyLiveLeg) {
    const statusRes = await tflLineStatus();
    if (statusRes.mode !== "unavailable") {
      for (const l of statusRes.data) if (l.state !== "good") disrupted.set(l.name.toLowerCase(), l);
    }
  }
  const DELAY_FOR: Record<string, number> = { minor: 6, severe: 16, suspended: 35, info: 0 };
  const liveDelays: number[] = []; // every live delay on the day, for the whole-day cascade
  await Promise.all(
    nodes.map(async (n) => {
      if (n.after?.kind !== "leg") return;
      const fromStop = stopById.get(n.after.fromStopId);
      // Future/past days never hit a live board.
      if (!inLiveWindow(fromStop?.start_time)) return;

      // Rail path — a booked train leg → live Darwin status → engine consequence.
      // Dormant (no call) unless DARWIN_LDBWS_KEY is set, so no false alarms.
      const crs = fromStop?.transport_hub?.code ?? null;
      if (n.after.leg.bookingStatus === "booked_in_app" && crs && fromStop?.start_time) {
        const live = await liveDeparture(crs, londonHHMM(fromStop.start_time) ?? "");
        if (live) {
          const m = /\+(\d+)/.exec(live.detail ?? "");
          const delayMin = live.label === "Cancelled" ? 999 : m ? Number(m[1]) : 0;
          if (delayMin > 0) {
            liveDelays.push(delayMin === 999 ? 60 : delayMin);
            const to = stopById.get(n.after.toStopId);
            const text = to?.start_time
              ? delayConsequence(
                  { id: n.after.toStopId, intoName: to.title ?? "your destination", arriveIso: to.start_time, deadlineIso: to.start_time, kind: "connection" },
                  delayMin === 999 ? 60 : delayMin,
                ).text
              : live.label;
            const severe = delayMin >= 16 || delayMin === 999;
            n.after.liveAlert = { title: live.label, text, state: severe ? "severe" : "minor" };

            // Recovery (P11) — a cancelled/severely-delayed booked train → the way
            // out: the next services to your destination + each one's consequence.
            const destCrs = to?.transport_hub?.code ?? null;
            if (severe && destCrs && to?.start_time && fromStop.start_time) {
              const durationMin = Math.round((new Date(to.start_time).getTime() - new Date(fromStop.start_time).getTime()) / 60_000);
              const { candidates, sample } = await nextRailServices({
                originCrs: crs,
                destCrs,
                destName: to.title ?? destCrs,
                afterIso: fromStop.start_time,
                durationMin,
                // Coords unlock OTP cross-network detours; null-safe so the band
                // degrades to Darwin same-route when coords/OTP are absent.
                originCoord: coordOfStop(fromStop),
                destCoord: coordOfStop(to),
              });
              const nextC = stops.find((s) => s.start_time && new Date(s.start_time).getTime() > new Date(to.start_time!).getTime() && s.type !== "start" && s.type !== "end" && s.type !== "accommodation");
              const commitment = nextC?.start_time ? { name: nextC.title ?? "your next commitment", byIso: nextC.start_time } : null;
              // Outbound+return as one unit (P11): the booked return is the next
              // locked rail departure downstream of this break. A way-out that
              // lands after it leaves strands you — surface that on every option.
              const returnDep = bookedReturnDeparture(stops, transitions, to.start_time);
              const protectedReturn = returnDep ? { label: londonHHMM(returnDep.iso) ?? "return", departIso: returnDep.iso } : null;
              const options = buildRecoveryOptions(candidates, commitment, protectedReturn);
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
      const hit = plan.plan.legs.find((l) => l.line && disrupted.has(l.line.toLowerCase()));
      if (hit?.line) {
        const st = disrupted.get(hit.line.toLowerCase())!;
        plan.disruption = { line: st.name, state: st.state, status: st.status };
        const to = stopById.get(n.after.toStopId);
        const addMin = DELAY_FOR[st.state] ?? 0;
        if (addMin > 0) liveDelays.push(addMin);
        if (to?.start_time && addMin > 0) {
          plan.consequence = delayConsequence(
            { id: n.after.toStopId, intoName: to.title ?? "your next stop", arriveIso: to.start_time, deadlineIso: to.start_time, kind: "commitment" },
            addMin,
          ).text;
        }
      }
      n.after.tflPlan = plan;
    }),
  );

  const anyAtRisk = nodes.some((n) => n.after?.kind === "leg" && n.after.leg.atRisk);
  const planState: "empty" | "sparse" | "threaded" | "at-risk" =
    stops.length === 0 ? "empty" : anyAtRisk ? "at-risk" : stops.length <= 2 ? "sparse" : "threaded";

  const named = !!(journey.title && String(journey.title).trim());
  const title = named ? (journey.title as string) : spanLabel(dateStart, dateStart);

  // ── Day-header inputs (recomposed to the full-day planner design) ──────────
  // Mono date eyebrow (THU 25 JUN) over the day's PURPOSE as the H1. The purpose
  // is the most "what the day is for" label: a real appointment/event title, else
  // the named plan title, else the span. Mirrors today/page.tsx's day header so
  // the two surfaces read identically. Travel/base bookend stops never qualify.
  const dateEyebrow = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "2-digit",
    month: "short",
  })
    .format(new Date(`${dateStart}T12:00:00`))
    .toUpperCase();
  const isTravelType = (t: string) =>
    t.includes("departure") || t.includes("arrival") || t.includes("changeover") || t.includes("transit");
  const primaryAnchor =
    stops.find((s) => s.type.includes("appointment")) ??
    stops.find(
      (s) => s.type !== "start" && s.type !== "end" && s.type !== "accommodation" && !isTravelType(s.type) && (s.title?.trim() || s.location?.name),
    ) ??
    null;
  const dayPurpose =
    (named ? (journey.title as string).trim() : "") ||
    primaryAnchor?.title?.trim() ||
    primaryAnchor?.location?.name?.trim() ||
    title;
  // The day's note — the stated Intention, rendered as the Satoshi-light upright
  // standfirst (NO serif, NO italic). Omitted entirely when there's no note.
  const dayNote = intentions[0]?.description?.trim() || null;

  // Decision-clock (P9) — the day's single reassuring number: when to set off.
  const startStop = stops.find((s) => s.type === "start");
  const baseLabel =
    startStop?.location?.name ?? startStop?.customer_site?.name ?? startStop?.transport_hub?.name ?? null;
  const leaveByIso = startStop?.end_time ?? null;
  const firstLeg = transitions.find((tr) => tr.from_stop_id === startStop?.id);
  const firstDest = firstLeg ? stopById.get(firstLeg.to_stop_id)?.title ?? null : null;

  // Fragility (P10) — is the day one delay from collapse? Read the thinnest
  // connection from the legs' buffer classification (P6).
  const fragSlacks: number[] = [];
  let weakestInto: string | null = null;
  let weakestVal = Infinity;
  for (const n of nodes) {
    if (n.after?.kind !== "leg") continue;
    const b = n.after.leg.buffer;
    if (!b || b.state === "ok" || b.state === "unknown") continue;
    const slack = b.state === "late" ? -1 : b.slackMinutes ?? 0;
    fragSlacks.push(slack);
    if (slack < weakestVal) {
      weakestVal = slack;
      weakestInto = n.after.leg.toLabel;
    }
  }
  const frag = fragility(fragSlacks);

  // Whole-day live re-solve (P10) — when a live delay is on the day, cascade it
  // across the remaining commitments and surface the day-level ripple.
  const dayDelay = liveDelays.length ? Math.max(...liveDelays) : 0;
  let ripple: string | null = null;
  if (dayDelay > 0) {
    const conns = stops
      .filter((s) => s.type !== "start" && s.type !== "end" && s.type !== "accommodation" && s.start_time)
      .map((s) => ({ id: s.id, intoName: s.title ?? "your next thing", arriveIso: s.start_time!, deadlineIso: s.start_time!, kind: "commitment" as const }));
    const cons = cascade(conns, dayDelay);
    const worst = cons.find((c) => c.broken);
    ripple = worst ? `The day's running ~${dayDelay} min behind — ${worst.text}` : `The day's running ~${dayDelay} min behind.`;
  }

  // Contextual nudges (P12) — the care layer. Weather on the leave-home leg →
  // "leave earlier"; a thin airport buffer → "get fast-track". Confirmable, never
  // auto-applied. Facts come from the stops we already loaded.
  const nowIso = new Date().toISOString();
  const nudgeLegs = nodes
    .filter((n) => n.after?.kind === "leg")
    .map((n) => {
      const after = n.after as Extract<SpineNode["after"], { kind: "leg" }>;
      const fromStop = stopById.get(after.fromStopId);
      const toStop = stopById.get(after.toStopId);
      const coord = coordOfStop(toStop);
      return {
        legId: after.leg.id,
        mode: after.leg.mode,
        toLabel: toStop?.title ?? "your stop",
        departIso: fromStop?.end_time ?? fromStop?.start_time ?? null,
        lat: coord?.lat ?? null,
        lng: coord?.lng ?? null,
        isFirstLeaveHome: fromStop?.type === "start",
      };
    });
  // A flight anchor carries its airport buffer as the gap between arriving at the
  // airport (start_time) and the flight departing (end_time). The SAME buffer
  // drives two mirror rules: thin → fast-track (P12), long → lounge (P13).
  const flightStops = stops.filter(
    (s) => s.type.includes("flight") && s.start_time && s.end_time && new Date(s.end_time!).getTime() > new Date(s.start_time!).getTime(),
  );
  const airportLabel = (s: StopRow) => s.title ?? s.transport_hub?.name ?? "the airport";
  const nudgeFlights = flightStops.map((s) => ({
    flightStopId: s.id,
    airport: airportLabel(s),
    flightDepartIso: s.end_time!,
    arriveAirportIso: s.start_time!,
  }));
  const nudgeLounges = flightStops.map((s) => ({
    flightStopId: s.id,
    airport: airportLabel(s),
    dwellMin: Math.round((new Date(s.end_time!).getTime() - new Date(s.start_time!).getTime()) / 60_000),
    boardingIso: s.end_time!,
  }));

  // Parking: a drive/taxi leg arriving at an airport on a flight day → pre-book.
  const tripEndIso = stops[stops.length - 1]?.end_time ?? stops[stops.length - 1]?.start_time ?? `${dateEnd}T18:00:00`;
  const nudgeParkings = nodes
    .filter((n) => n.after?.kind === "leg")
    .map((n) => n.after as Extract<SpineNode["after"], { kind: "leg" }>)
    .filter((after) => {
      const toStop = stopById.get(after.toStopId);
      return (after.leg.mode === "drive" || after.leg.mode === "taxi") && !!toStop?.type.includes("flight");
    })
    .map((after) => {
      const fromStop = stopById.get(after.fromStopId);
      const toStop = stopById.get(after.toStopId)!;
      return {
        legId: after.leg.id,
        site: `${airportLabel(toStop)} parking`,
        arriveIso: toStop.start_time ?? fromStop?.end_time ?? nowIso,
        departIso: fromStop?.end_time ?? fromStop?.start_time ?? nowIso,
        untilIso: tripEndIso,
      };
    });

  // Gate change: the live gate comes from AeroDataBox (mock until keyed); we diff
  // it against the gate the plan last knew (metadata.gate). Needs a flight number
  // (metadata.flight_number/service_number) + a baseline gate to diff — flights
  // without those simply don't check. (The continuous day-of poll + last-seen
  // diff is the positioned day-of follow-on.)
  const nudgeGateFlights = flightStops
    .filter((s) => (s.metadata?.flight_number || s.metadata?.service_number) && s.metadata?.gate)
    .map((s) => ({
      flightStopId: s.id,
      airport: airportLabel(s),
      flightNumber: String(s.metadata?.flight_number ?? s.metadata?.service_number),
      baselineGate: String(s.metadata?.gate),
      walkMin: Number(s.metadata?.gate_walk_min ?? 7),
      boardingIso: s.end_time!,
      dateIso: s.start_time!,
    }));

  const nudges = await loadNudges({
    itineraryId: id,
    nowIso,
    legs: nudgeLegs,
    flights: nudgeFlights,
    lounges: nudgeLounges,
    parkings: nudgeParkings,
    gateFlights: nudgeGateFlights,
  });

  // Flight finder (ED-Flight) — passenger defaults from the profile for a quick book.
  const [pgiven = "", pfamily = ""] = String(ctx.fullName ?? "").trim().split(/\s+/);
  const connDefaultPassenger = { givenName: pgiven, familyName: pfamily, email: ctx.email ?? "" };
  // bookedConnections, budget, locationShares loaded earlier in the parallel batch.

  // Door-to-door map — the canonical plan view carries the same JourneyMap the
  // legacy editor did, built from the (coord-bearing) stops + transition polylines.
  const journeyMap = buildJourneyFromStops(
    stops as unknown as StopForMap[],
    transitions as unknown as TransitionForMap[],
    { id, eyebrow: `${spanLabel(dateStart, dateStart)} · DOOR TO DOOR`.toUpperCase() },
  );

  return (
    <div className="cc-screen" data-plan-state={planState} style={{ minHeight: "100%" }}>
      {/* TopBar — a detail page keeps the ← Plan back button (founder ruling); the
          add affordance opens the same toolkit, ⋯ is the per-day overflow. NO
          global work/personal toggle (retired): work is a per-item tag. */}
      <header className="cc-plan-topbar">
        <Link href={"/plan" as Route} className="cc-event-back">
          ← Plan
        </Link>
        {/* The primary action, where you'd expect it: a persistent + Add at the
            top of the day. Opens the same sheet as Build-the-day's tile. No
            global work/personal toggle (retired) — work is a per-item tag. */}
        <PlanAdd
          variant="primary"
          journeyId={id}
          journeyDate={dateStart}
          customers={pickCustomers ?? []}
          customerSites={pickSites ?? []}
          locations={(pickLocations ?? []) as PlacePickerLocation[]}
        />
      </header>

      {/* DayHeader — mono date eyebrow → the day's PURPOSE as the H1 → From {base}
          origin → "THE POINT OF THE DAY" upright Satoshi-light standfirst. The
          base + intention stay editable in place (PlanBase / PlanIntention). */}
      <header className="cc-day-header">
        <span className="cc-day-header-eyebrow">{dateEyebrow}</span>
        <div className="cc-day-purpose-edit" style={{ marginTop: 6 }}>
          {/* The PURPOSE as the H1 — editable. When the day has its own title we
              edit that; when unnamed we show the derived purpose (the primary
              appointment) but the editor still writes the JOURNEY title, never the
              anchor's name. */}
          <PlanTitleEditor itineraryId={id} title={named ? (journey.title as string) : dayPurpose} named={named} />
        </div>
        <PlanBase
          itineraryId={id}
          baseLabel={baseLabel}
          customers={pickCustomers ?? []}
          customerSites={pickSites ?? []}
          locations={(pickLocations ?? []) as PlacePickerLocation[]}
        />
        <PlanIntention itineraryId={id} initial={dayNote} />
      </header>

      {stops.length === 0 ? (
        <div className="cc-plan-empty">
          <p className="cc-plan-empty-lead">An empty day, ready to thread.</p>
          <p className="cc-plan-empty-sub">
            {baseLabel ? <>Starting from <strong>{baseLabel}</strong>. Add</> : <>Set your base above, then add</>} your
            first thing below — a meeting, a train, a stay — or import from your inbox, and Khonsera threads the rest.
          </p>
        </div>
      ) : (
        <>
          {/* SetOffHero — the day's single calm instruction: the leave-by as the
              giant debossed figure, seated in a lifted cotton sheet (the same
              .cc-setoff treatment Today's live hero uses, here static from the
              solved leave-by). Omitted when the day has no computed set-off. */}
          {leaveByIso ? (
            (() => {
              const clock = londonHHMM(leaveByIso);
              const parts = clock ? clock.split(":") : null;
              return (
                <section className="cc-setoff">
                  <div className="pg cc-setoff-sheet">
                    <div className="cc-setoff-eyb">
                      <span className="cc-setoff-kicker">Set off by</span>
                      {firstDest ? <span className="cc-setoff-for">for {firstDest}</span> : null}
                    </div>
                    {parts ? (
                      <div className="mono engr-deep cc-setoff-figure" aria-label={`Set off by ${clock}`}>
                        <span>{parts[0]}</span>
                        <span className="cc-setoff-colon">:</span>
                        <span>{parts[1]}</span>
                      </div>
                    ) : null}
                  </div>
                </section>
              );
            })()
          ) : null}

          {ripple ? (
            <div className="cc-day-ripple">
              <span className="text">{ripple}</span>
            </div>
          ) : null}

          {frag.fragile ? (
            <p className="cc-fragility">
              <strong>Tight plan</strong> — only {Math.max(0, frag.weakestSlackMin ?? 0)} min into {weakestInto ?? "a connection"}. One delay and the day breaks; add a buffer while you can.
            </p>
          ) : null}

          {/* Primary — the day itself: what to do now, the live picture, the map,
              and the threaded spine. (Deep review 2026-06-15: the day reads first;
              the operational tools move below into a single collapsed region so the
              page is a hierarchy, not a 16-panel pile.) */}
          <PlanNudges itineraryId={id} nudges={nudges} />

          {/* RouteMap — the real JourneyMap as a restrained paper map of the day's
              door-to-door route, framed like Today's. */}
          {journeyMap ? (
            <section className="cc-today-map" aria-label="The day's route">
              <span className="cc-today-map-eyebrow">The route, door to door</span>
              <PlanMap journey={journeyMap} />
            </section>
          ) : null}

          <PlanSpine
            nodes={nodes}
            journeyDate={dateStart}
            eventId={id}
            isWork={journey.mode === "work"}
            customers={pickCustomers ?? []}
            customerSites={pickSites ?? []}
            locations={(pickLocations ?? []) as PlacePickerLocation[]}
          />

          {/* TripTools — the operational tray: BOOKINGS · BUDGET · SHARING · PREP ·
              CONSTRAINTS, plus the BUILD THE DAY group (the add/import/finder
              toolkit, folded in here per the design rather than a loose bottom
              row). Collapsed by default; opened to manage. */}
          <details className="cc-plan-tools">
            <summary className="cc-plan-tools-summary">
              <span className="cc-plan-tools-title">Trip tools</span>
              <span className="cc-plan-tools-hint">bookings · budget · sharing · prep · constraints · build</span>
            </summary>
            <div className="cc-plan-tools-body">
              {bookedConnections.length > 0 ? <ManageBookings itineraryId={id} bookings={bookedConnections} /> : null}
              <BudgetPanel itineraryId={id} budget={budget} />
              <ShareControl itineraryId={id} isWork={journey.mode === "work"} shares={locationShares} arriveIso={tripEndIso} multiDay={multiDay} />
              <ReadinessPanel itineraryId={id} items={readiness} />
              <PlanConstraints initial={constraints} />

              {/* BUILD THE DAY — the same add/import/finder actions, grouped (Scan
                  email · Add a fact · From calendar · Find a flight · Find a stay). */}
              <div className="cc-build-day">
                <span className="cc-build-day-eyebrow">Build the day</span>
                <div className="cc-build-day-actions">
                  <PlanImport
                    itineraryId={id}
                    lastStopId={stops.length ? stops[stops.length - 1].id : null}
                    lastStopLabel={stops.length ? (stops[stops.length - 1].title ?? "your day") : "your day"}
                  />
                </div>
                <div className="cc-build-day-tiles">
                  <PlanAdd
                    journeyId={id}
                    journeyDate={dateStart}
                    customers={pickCustomers ?? []}
                    customerSites={pickSites ?? []}
                    locations={(pickLocations ?? []) as PlacePickerLocation[]}
                  />
                  <PlanCalendarImport itineraryId={id} />
                  <FlightFinder itineraryId={id} defaultDate={dateStart} defaultPassenger={connDefaultPassenger} />
                  <StayFinder itineraryId={id} defaultDate={dateStart} />
                </div>
              </div>
            </div>
          </details>
        </>
      )}

      {/* Empty day still needs the toolkit reachable — keep BUILD THE DAY available
          when there are no stops yet so a blank plan can be filled. */}
      {stops.length === 0 ? (
        <div className="cc-build-day" style={{ marginTop: "var(--space-4)" }}>
          <span className="cc-build-day-eyebrow">Build the day</span>
          <div className="cc-build-day-actions">
            <PlanImport
              itineraryId={id}
              lastStopId={null}
              lastStopLabel="your day"
            />
          </div>
          <div className="cc-build-day-tiles">
            <PlanAdd
              journeyId={id}
              journeyDate={dateStart}
              customers={pickCustomers ?? []}
              customerSites={pickSites ?? []}
              locations={(pickLocations ?? []) as PlacePickerLocation[]}
            />
            <PlanCalendarImport itineraryId={id} />
            <FlightFinder itineraryId={id} defaultDate={dateStart} defaultPassenger={connDefaultPassenger} />
            <StayFinder itineraryId={id} defaultDate={dateStart} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
