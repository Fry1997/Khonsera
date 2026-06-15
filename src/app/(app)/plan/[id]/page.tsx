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
import { PlanModeFlip } from "@/components/plan/plan-mode-flip";
import { PlanTitleEditor } from "@/components/plan/plan-title-editor";
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
import { resolveItineraryTimes } from "@/lib/actions/itineraries";
import { setTransitionMode } from "@/lib/actions/transitions";
import { inferAndUpdateSpan } from "@/lib/actions/events";
import { ensureHomeBookend } from "@/lib/actions/plan-edit";
import { checkLegFeasibility } from "@/lib/feasibility/check";
import { foldStopsToLegTickets } from "@/lib/tickets/from-stops";
import { IntentionCard } from "@/components/concierge";
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

type StopRow = {
  id: string;
  sequence: number;
  type: string;
  title: string | null;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  is_time_fixed: boolean | null;
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
      .select("id, sequence, type, title, start_time, end_time, duration_minutes, is_time_fixed, metadata, location:locations(name, latitude, longitude), customer_site:customer_sites(name, latitude, longitude), transport_hub:transport_hubs(code, name, latitude, longitude)")
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

  const { data: journey } = await supabase
    .from("itineraries")
    .select("id, title, mode, date_start, date_end, status")
    .eq("id", id)
    .maybeSingle();
  if (!journey) notFound();

  // Collapse any stray duplicate home stops (legacy data / earlier races). We do
  // NOT create here — creation lives in the mutations so concurrent renders can't
  // race and flash "home home … home home". Collapse is idempotent.
  await ensureHomeBookend(id, { create: false });

  let [{ data: s }, { data: t }, { data: i }] = await loadSpine(id);
  let stops = (s ?? []) as unknown as StopRow[];
  let transitions = (t ?? []) as unknown as TransRow[];

  // E3 — opening heals stale plans (incl. legacy data routed before the
  // transport-hub-coords fix / the distance fallback). Re-route any unbooked leg
  // missing a duration so it gets a real door-to-door time, then re-solve.
  // NOTE: render is READ-MOSTLY — do NOT re-sequence/re-thread here. Doing that
  // raced across concurrent renders (prefetch + navigate) and made the order +
  // times jump on every refresh. Re-sequencing lives in the mutations.
  const staleLegs = transitions.filter((x) => !x.is_locked && x.computed_duration_minutes == null);
  if (staleLegs.length > 0) {
    for (const leg of staleLegs) {
      await setTransitionMode({ id: leg.id, mode: leg.mode as Parameters<typeof setTransitionMode>[0]["mode"] });
    }
    await resolveItineraryTimes(id);
    [{ data: s }, { data: t }, { data: i }] = await loadSpine(id);
    stops = (s ?? []) as unknown as StopRow[];
    transitions = (t ?? []) as unknown as TransRow[];
  }

  await inferAndUpdateSpan(id);
  const { data: spanRow } = await supabase
    .from("itineraries")
    .select("date_start, date_end")
    .eq("id", id)
    .maybeSingle();
  const dateStart = (spanRow?.date_start as string) ?? (journey.date_start as string);
  const dateEnd = (spanRow?.date_end as string) ?? (journey.date_end as string);

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
    vars: buildVars(st),
  });
  const legOf = (tr: TransRow, from: StopRow, to: StopRow): LegVM => {
    const feas = tr.is_locked
      ? ({ state: "ok" } as const)
      : checkLegFeasibility({
          fromEnd: from.end_time ? new Date(from.end_time) : from.start_time ? new Date(from.start_time) : null,
          toStart: to.start_time ? new Date(to.start_time) : null,
          travelMinutes: tr.computed_duration_minutes,
        });
    const atRisk = feas.state === "tight" || feas.state === "late";
    return {
      id: `${tr.from_stop_id}->${tr.to_stop_id}`,
      mode: mapLegMode(tr.mode),
      fromLabel: from.title ?? "—",
      toLabel: to.title ?? "—",
      // You LEAVE a stop at its end_time (its "leave by"); fall back to start_time
      // for transit stops that only carry a departure. This stops the first leg
      // reading backwards (it was using home's phantom start_time).
      departure: from.end_time ?? from.start_time ?? undefined,
      arrival: to.start_time ?? undefined,
      notes: tr.computed_duration_minutes ? `${tr.computed_duration_minutes} min` : undefined,
      bookingStatus: tr.is_locked ? "booked_in_app" : "manual",
      atRisk,
      riskNote: atRisk && "message" in feas ? feas.message : undefined,
      buffer: {
        state: feas.state,
        slackMinutes: "slackMinutes" in feas ? feas.slackMinutes : undefined,
      },
    };
  };

  const constraints = await loadConstraints();
  const stopById = new Map(stops.map((st) => [st.id, st]));

  // Prep + outcome notes per commitment (P3). RLS already scopes to the viewer.
  const readiness = await loadReadiness(id);
  const allNotes = await listNotesForStops(stops.map((st) => st.id));
  const notesByStop = new Map<string, NoteVM[]>();
  for (const n of allNotes) {
    if (!n.stopId) continue;
    const arr = notesByStop.get(n.stopId) ?? [];
    arr.push(n);
    notesByStop.set(n.stopId, arr);
  }

  // PlacePicker data — saved places pin to the top, then Google autocomplete.
  // Lets manual Place/Appointment adds bind a real, geocoded location so the
  // leg to/from it routes (not a bare un-geocoded address string).
  const [{ data: pickCustomers }, { data: pickSites }, { data: pickLocations }] = await Promise.all([
    supabase.from("customers").select("id, name").eq("workspace_id", ctx.workspaceId).order("name"),
    supabase.from("customer_sites").select("id, customer_id, name, address").eq("workspace_id", ctx.workspaceId),
    supabase.from("locations").select("id, name, type, address").eq("workspace_id", ctx.workspaceId).order("type").order("name"),
  ]);

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
        units.push({
          key: `legpass-${lt.originStopId}`,
          entryId: lt.originStopId,
          exitId: lt.destStopId,
          pass: lt.ticket,
          // dest CRS disambiguates same-minute departures at a busy interchange
          // (Luton can have two 07:50s on different platforms — match the one
          // calling at this hop's destination, not just any train at that time).
          live: {
            crs: originStop?.transport_hub?.code ?? null,
            time: londonHHMM(iso),
            dest: lt.ticket.legs[0]?.destination.code ?? null,
          },
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
  const dayOf = (u: Unit): string | null => {
    const st = stopById.get(u.entryId);
    return st?.start_time ? new Date(st.start_time).toISOString().slice(0, 10) : null;
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
    const isBase = entryType === "start" || entryType === "end";
    const accommodation =
      entryType === "accommodation" ? accommodationFromMetadata(entryStop?.metadata) : null;
    const notes = u.anchor ? notesByStop.get(u.entryId) ?? [] : [];
    return { key: u.key, anchor: u.anchor, isBase, accommodation, notes, pass: u.pass, live: u.live, passDelete: u.passDelete, dayStart, after };
  });

  // Phase 8 — resolve each London transit leg to a live TfL plan; Phase 9 — when a
  // line on that route is disrupted, translate it into a consequence on the next
  // commitment (the live engine). Mock until TFL_APP_KEY is set.
  const statusRes = await tflLineStatus();
  const disrupted = new Map<string, TflLine>();
  if (statusRes.mode !== "unavailable") {
    for (const l of statusRes.data) if (l.state !== "good") disrupted.set(l.name.toLowerCase(), l);
  }
  const DELAY_FOR: Record<string, number> = { minor: 6, severe: 16, suspended: 35, info: 0 };
  const liveDelays: number[] = []; // every live delay on the day, for the whole-day cascade
  await Promise.all(
    nodes.map(async (n) => {
      if (n.after?.kind !== "leg") return;
      const fromStop = stopById.get(n.after.fromStopId);

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

  // Decision-clock (P9) — the day's single reassuring number: when to set off.
  const startStop = stops.find((s) => s.type === "start");
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
  const bookedConnections = await loadBookedConnections(id);
  const budget = await loadBudget(id);
  const locationShares = await listLocationShares(id);

  // Door-to-door map — the canonical plan view carries the same JourneyMap the
  // legacy editor did, built from the (coord-bearing) stops + transition polylines.
  const journeyMap = buildJourneyFromStops(
    stops as unknown as StopForMap[],
    transitions as unknown as TransitionForMap[],
    { id, eyebrow: `${spanLabel(dateStart, dateStart)} · DOOR TO DOOR`.toUpperCase() },
  );

  return (
    <div className="cc-screen" data-plan-state={planState} style={{ minHeight: "100%" }}>
      <header className="cc-event-head">
        <Link href={"/plan" as Route} className="cc-event-back">
          ← Plan
        </Link>
        <span className="cc-eyebrow">{spanLabel(dateStart, dateEnd)}</span>
        <div style={{ marginTop: 6 }}>
          <PlanTitleEditor itineraryId={id} title={title} named={named} />
        </div>
        <div style={{ marginTop: "var(--space-2)" }}>
          <PlanModeFlip itineraryId={id} mode={journey.mode === "work" ? "work" : "personal"} />
        </div>
      </header>

      {stops.length === 0 ? (
        <div className="cc-plan-empty">
          <p className="cc-plan-empty-lead">An empty spine, ready for the first fact.</p>
          <p className="cc-plan-empty-sub">Add an appointment or place below to begin.</p>
        </div>
      ) : (
        <>
          {intentions.length > 0 ? (
            <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              {intentions.map((it) => (
                <IntentionCard key={it.id} intention={it} />
              ))}
            </section>
          ) : null}

          {leaveByIso ? (
            <div className="cc-decision-clock">
              <span className="label">Set off by</span>
              <span className="figure">{londonHHMM(leaveByIso)}</span>
              {firstDest ? <span className="for">for {firstDest}</span> : null}
            </div>
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

          {journeyMap ? <PlanMap journey={journeyMap} /> : null}

          <PlanSpine nodes={nodes} journeyDate={dateStart} eventId={id} isWork={journey.mode === "work"} />

          {/* Trip tools — bookings, money, sharing, prep, constraints. Present but
              quiet: collapsed by default, opened when the user wants to manage. */}
          <details className="cc-plan-tools">
            <summary className="cc-plan-tools-summary">
              <span className="cc-plan-tools-title">Trip tools</span>
              <span className="cc-plan-tools-hint">bookings · budget · sharing · prep · constraints</span>
            </summary>
            <div className="cc-plan-tools-body">
              {bookedConnections.length > 0 ? <ManageBookings itineraryId={id} bookings={bookedConnections} /> : null}
              <BudgetPanel itineraryId={id} budget={budget} />
              <ShareControl itineraryId={id} isWork={journey.mode === "work"} shares={locationShares} arriveIso={tripEndIso} multiDay={multiDay} />
              <ReadinessPanel itineraryId={id} items={readiness} />
              <PlanConstraints initial={constraints} />
            </div>
          </details>
        </>
      )}

      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
        <PlanAdd
          journeyId={id}
          journeyDate={dateStart}
          customers={pickCustomers ?? []}
          customerSites={pickSites ?? []}
          locations={(pickLocations ?? []) as PlacePickerLocation[]}
        />
        <PlanImport
          itineraryId={id}
          lastStopId={stops.length ? stops[stops.length - 1].id : null}
          lastStopLabel={stops.length ? (stops[stops.length - 1].title ?? "your day") : "your day"}
        />
        <PlanCalendarImport itineraryId={id} />
        <FlightFinder itineraryId={id} defaultDate={dateStart} defaultPassenger={connDefaultPassenger} />
        <StayFinder itineraryId={id} defaultDate={dateStart} />
      </div>
    </div>
  );
}
