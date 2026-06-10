import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { PlanCapture } from "@/components/plan/plan-capture";
import { PlanAdd } from "@/components/plan/plan-add";
import { PlanConstraints } from "@/components/plan/plan-constraints";
import { loadConstraints } from "@/lib/actions/constraints";
import { PlanSpine, type SpineNode } from "@/components/plan/plan-spine";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { resolveItineraryTimes } from "@/lib/actions/itineraries";
import { inferAndUpdateSpan } from "@/lib/actions/events";
import { checkLegFeasibility } from "@/lib/feasibility/check";
import { foldStopsToTickets } from "@/lib/tickets/from-stops";
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
  location: { name?: string } | null;
};
type TransRow = {
  id: string;
  from_stop_id: string;
  to_stop_id: string;
  mode: string;
  is_locked: boolean | null;
  computed_duration_minutes: number | null;
};

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
  if (stop.start_time) {
    const kind = arriveKind(stop);
    vars.arriveBy = {
      kind,
      iso: stop.start_time,
      display: kind === "approximate" ? `~${formatClock(stop.start_time)}` : formatClock(stop.start_time),
    } satisfies AnchorVariable;
  }
  if (stop.duration_minutes != null) {
    const kind = (stop.metadata?.var_duration_kind as AnchorVariableKind) ?? "precise";
    vars.duration = { kind, minutes: stop.duration_minutes, display: durationDisplay(stop.duration_minutes) };
  }
  if (stop.end_time) {
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
      .select("id, sequence, type, title, start_time, end_time, duration_minutes, is_time_fixed, metadata, location:locations(name)")
      .eq("itinerary_id", itineraryId)
      .order("sequence"),
    supabase
      .from("transitions")
      .select("id, from_stop_id, to_stop_id, mode, is_locked, computed_duration_minutes")
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

  let [{ data: s }, { data: t }, { data: i }] = await loadSpine(id);
  let stops = (s ?? []) as unknown as StopRow[];
  let transitions = (t ?? []) as unknown as TransRow[];

  // E3 — opening re-runs the solver (guarded) so legacy/stale plans don't show
  // bare legs. Only when a transition lacks a computed duration.
  const needsSolve = transitions.length > 0 && transitions.some((x) => x.computed_duration_minutes == null);
  if (needsSolve) {
    await resolveItineraryTimes(id);
    [{ data: s }, { data: t }, { data: i }] = await loadSpine(id);
    stops = (s ?? []) as unknown as StopRow[];
    transitions = (t ?? []) as unknown as TransRow[];
  }

  // Backfill the span from the facts (§5) — extends a legacy single-day Event to
  // its real bounds (return travel / hotel). Idempotent; reflect it in the header.
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
      departure: from.start_time ?? undefined,
      arrival: to.start_time ?? undefined,
      notes: tr.computed_duration_minutes ? `${tr.computed_duration_minutes} min` : undefined,
      bookingStatus: tr.is_locked ? "booked_in_app" : "manual",
      atRisk,
      riskNote: atRisk && "message" in feas ? feas.message : undefined,
    };
  };

  const constraints = await loadConstraints();
  const stopById = new Map(stops.map((st) => [st.id, st]));

  // Collapse each booked transit run (departure → changeover(s) → arrival) into a
  // single docked Pass node (proposal §8); the internal locked legs fold into the
  // ticket. A return is a second Pass downstream — the timeline carries the order.
  const folded = foldStopsToTickets(
    stops.map((st) => ({ id: st.id, type: st.type, title: st.title, start_time: st.start_time, metadata: st.metadata })),
  );
  const runByDeparture = new Map(folded.map((f) => [f.departureStopId, f]));
  const consumed = new Set<string>();
  for (const f of folded) for (const sid of f.stopIds) if (sid !== f.departureStopId) consumed.add(sid);

  type Unit = { key: string; entryId: string; exitId: string; anchor?: AnchorVM; pass?: TicketVM };
  const units: Unit[] = [];
  for (const st of stops) {
    if (consumed.has(st.id)) continue;
    const run = runByDeparture.get(st.id);
    if (run) {
      units.push({ key: `pass-${st.id}`, entryId: st.id, exitId: run.arrivalStopId, pass: run.ticket });
    } else {
      units.push({ key: `anchor-${st.id}`, entryId: st.id, exitId: st.id, anchor: anchorOf(st) });
    }
  }

  const nodes: SpineNode[] = units.map((u, idx) => {
    const next = units[idx + 1];
    let after: SpineNode["after"] = null;
    if (next) {
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
    return { key: u.key, anchor: u.anchor, pass: u.pass, after };
  });

  const anyAtRisk = nodes.some((n) => n.after?.kind === "leg" && n.after.leg.atRisk);
  const planState: "empty" | "sparse" | "threaded" | "at-risk" =
    stops.length === 0 ? "empty" : anyAtRisk ? "at-risk" : stops.length <= 2 ? "sparse" : "threaded";

  const title = journey.title || spanLabel(dateStart, dateStart);

  return (
    <div className="cc-screen" data-plan-state={planState} style={{ minHeight: "100%" }}>
      <header className="cc-event-head">
        <Link href={"/plan" as Route} className="cc-event-back">
          ← Plan
        </Link>
        <span className="cc-eyebrow">{spanLabel(dateStart, dateEnd)}</span>
        <h1 className="cc-screen-title" style={{ marginTop: 6 }}>
          {title}
        </h1>
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

          <PlanConstraints initial={constraints} />

          <PlanSpine nodes={nodes} journeyDate={dateStart} />
        </>
      )}

      <PlanAdd journeyId={id} journeyDate={dateStart} />

      <PlanCapture eventId={id} />
    </div>
  );
}
