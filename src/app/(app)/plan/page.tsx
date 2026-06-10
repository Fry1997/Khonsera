import { PlanCapture } from "@/components/plan/plan-capture";
import { PlanAdd } from "@/components/plan/plan-add";
import { PlanConstraints } from "@/components/plan/plan-constraints";
import { loadConstraints } from "@/lib/actions/constraints";
import { PlanSpine, type SpineNode } from "@/components/plan/plan-spine";
import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { checkLegFeasibility } from "@/lib/feasibility/check";
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
} from "@/components/concierge";

// Plan — the single planner (display + input), rendered as Design's spine.
// Anchors carry the editable three-variable model (§5.3); the engine threads
// legs between them and re-solves on every edit.

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
    const v: AnchorVariable = {
      kind,
      iso: stop.start_time,
      display: kind === "approximate" ? `~${formatClock(stop.start_time)}` : formatClock(stop.start_time),
    };
    vars.arriveBy = v;
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

export default async function PlanPage() {
  const ctx = await requireUserContext();
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: journey } = await supabase
    .from("itineraries")
    .select("id, title, mode, date_start, date_end, status")
    .eq("mode", ctx.activeMode)
    .gte("date_end", today)
    .in("status", ["draft", "planning", "planned", "in_progress"])
    .order("date_start")
    .limit(1)
    .maybeSingle();

  let stops: StopRow[] = [];
  let transitions: TransRow[] = [];
  let intentions: IntentionVM[] = [];
  if (journey?.id) {
    const [{ data: s }, { data: t }, { data: i }] = await Promise.all([
      supabase
        .from("stops")
        .select("id, sequence, type, title, start_time, end_time, duration_minutes, is_time_fixed, metadata, location:locations(name)")
        .eq("itinerary_id", journey.id)
        .order("sequence"),
      supabase
        .from("transitions")
        .select("id, from_stop_id, to_stop_id, mode, is_locked, computed_duration_minutes")
        .eq("itinerary_id", journey.id),
      supabase
        .from("intentions")
        .select("id, description, target, buffer_minutes, state, flexibility, leave_by")
        .eq("itinerary_id", journey.id),
    ]);
    stops = (s ?? []) as never;
    transitions = (t ?? []) as never;
    intentions = (i ?? []).map((x) => ({
      id: x.id as string,
      description: x.description as string,
      target: (x.target as string | null) ?? undefined,
      state: x.state as IntentionVM["state"],
      flexibility: x.flexibility as IntentionVM["flexibility"],
      leaveBy: (x.leave_by as string | null) ?? undefined,
    }));
  }

  const transByPair = new Map<string, TransRow>();
  for (const t of transitions) transByPair.set(`${t.from_stop_id}->${t.to_stop_id}`, t);

  const anchorOf = (s: StopRow): AnchorVM => ({
    id: s.id,
    type: mapStopType(s.type),
    title: s.title ?? s.location?.name ?? "Stop",
    place: s.location?.name ?? undefined,
    time: s.start_time ? { from: s.start_time, to: s.end_time ?? undefined } : undefined,
    durationMinutes: s.duration_minutes ?? undefined,
    fixed: s.is_time_fixed ?? undefined,
    vars: buildVars(s),
  });
  const legOf = (t: TransRow, from: StopRow, to: StopRow): LegVM => {
    // Feasibility flags an at-risk leg (§5.9). A locked (booked) leg's 0m slack
    // is a fact, not a warning (CLAUDE.md hard-won fix) — skip the check.
    const feas = t.is_locked
      ? ({ state: "ok" } as const)
      : checkLegFeasibility({
          fromEnd: from.end_time ? new Date(from.end_time) : from.start_time ? new Date(from.start_time) : null,
          toStart: to.start_time ? new Date(to.start_time) : null,
          travelMinutes: t.computed_duration_minutes,
        });
    const atRisk = feas.state === "tight" || feas.state === "late";
    return {
      id: `${t.from_stop_id}->${t.to_stop_id}`,
      mode: mapLegMode(t.mode),
      fromLabel: from.title ?? "—",
      toLabel: to.title ?? "—",
      departure: from.start_time ?? undefined,
      arrival: to.start_time ?? undefined,
      notes: t.computed_duration_minutes ? `${t.computed_duration_minutes} min` : undefined,
      bookingStatus: t.is_locked ? "booked_in_app" : "manual",
      atRisk,
      riskNote: atRisk && "message" in feas ? feas.message : undefined,
    };
  };

  const constraints = await loadConstraints();
  const itineraryId = journey?.id as string;
  const nodes: SpineNode[] = stops.map((s, idx) => {
    const next = stops[idx + 1];
    let after: SpineNode["after"] = null;
    if (next) {
      const trans = transByPair.get(`${s.id}->${next.id}`);
      after = trans
        ? {
            kind: "leg",
            leg: legOf(trans, s, next),
            transitionId: trans.id,
            itineraryId,
            fromStopId: s.id,
            toStopId: next.id,
          }
        : {
            kind: "gap",
            gap: {
              id: `gap-${s.id}-${next.id}`,
              type: "transport_gap",
              fromLabel: s.title ?? "here",
              toLabel: next.title ?? "next",
              state: "open",
            } satisfies GapVM,
            itineraryId,
            fromStopId: s.id,
            toStopId: next.id,
          };
    }
    return { anchor: anchorOf(s), after };
  });

  // The five planner states (§5.9). empty/sparse/threaded by shape; at-risk when
  // any leg is flagged; "resolving" is a client state (a sheet open) on the spine.
  const anyAtRisk = nodes.some((n) => n.after?.kind === "leg" && n.after.leg.atRisk);
  const planState: "empty" | "sparse" | "threaded" | "at-risk" =
    stops.length === 0 ? "empty" : anyAtRisk ? "at-risk" : stops.length <= 2 ? "sparse" : "threaded";

  return (
    <div className="cc-screen" data-plan-state={planState} style={{ minHeight: "100%" }}>
      <header>
        <span className="cc-eyebrow">{ctx.activeMode === "work" ? "Work" : "Personal"} · Plan</span>
        <h1 className="cc-screen-title" style={{ marginTop: 6 }}>
          {journey?.title ?? "A clear day."}
        </h1>
      </header>

      {!journey || stops.length === 0 ? (
        <div style={{ textAlign: "center", padding: "var(--space-8) 0", color: "var(--ink-dim)" }}>
          <p className="cc-serif" style={{ fontSize: 18, color: "var(--ink-2)" }}>
            {journey ? "An empty spine, ready for the first fact." : "Nothing in motion."}
          </p>
          <p className="small" style={{ marginTop: 8 }}>Tell me the first thing you know.</p>
        </div>
      ) : (
        <>
          {intentions.length > 0 ? (
            <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              {intentions.map((i) => (
                <IntentionCard key={i.id} intention={i} />
              ))}
            </section>
          ) : null}

          <PlanConstraints initial={constraints} />

          <PlanSpine nodes={nodes} journeyDate={journey.date_start as string} />

          <PlanAdd journeyId={journey.id as string} journeyDate={journey.date_start as string} />
        </>
      )}

      <PlanCapture />
    </div>
  );
}
