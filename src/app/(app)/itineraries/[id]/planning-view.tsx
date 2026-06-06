"use client";

// PlanningView — the new planning screen (Phase 5). A dumb-ish renderer over
// the composed `PlanningViewData`: lifecycle band, trip header + summary, the
// day spine (stop nodes + the legs between them), THIS TRIP NEEDS, and the day
// digest. Interactions dispatch the existing/Phase-2–4 server actions and
// refresh. Visual grammar (time rail, gold nodes, mono eyebrows, cards) matches
// the design; tokens come from globals.css.

import { useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  ChevronRight,
  ChevronDown,
  MapPin,
  Footprints,
  Car,
  Bike,
  Train,
} from "lucide-react";
import { setTransitionMode, upsertTransition } from "@/lib/actions/transitions";
import { setTravelStrategy, setAppointmentTiming } from "@/lib/actions/planning";
import { updateItinerary } from "@/lib/actions/itineraries";
import { AddSheet, type Pickers } from "./planning-add-sheet";
import { PairedRailCard } from "./paired-rail-card";
import { TrainTicketCard } from "@/components/train-ticket-card";
import type {
  PlanningViewData,
  PlanningSpineNode,
  PlanningLegNode,
  PlanningStopNode,
  PlanningLegMode,
} from "./planning-data";

const RAIL = 26;
const mono: CSSProperties = { fontFamily: "var(--mono)", fontVariantNumeric: "tabular-nums" };

function errMessage(e: unknown): string {
  if (e && typeof e === "object") {
    if ("message" in e && typeof (e as { message?: unknown }).message === "string")
      return (e as { message: string }).message;
    if ("kind" in e)
      return String((e as { kind: unknown }).kind).replace(/_/g, " ");
  }
  return "Something went wrong";
}

// ── controller ───────────────────────────────────────────────────────────────
function usePlanningActions(itineraryId: string) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: unknown }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(errMessage(res.error));
      router.refresh();
    });
  }

  return {
    pending,
    error,
    chooseMode(leg: PlanningLegNode, modeId: string) {
      // No 'cycle' transition mode yet — fold it to walk so the leg still saves.
      const mode = (modeId === "cycle" ? "walk" : modeId) as
        | "walk"
        | "drive"
        | "taxi";
      run(() =>
        leg.transitionId
          ? setTransitionMode({ id: leg.transitionId, mode })
          : upsertTransition({
              itinerary_id: itineraryId,
              from_stop_id: leg.fromStopId,
              to_stop_id: leg.toStopId,
              mode,
            }),
      );
    },
    setStrategy(strategy: "rail" | "drive" | "mixed") {
      run(() => setTravelStrategy({ itinerary_id: itineraryId, strategy }));
    },
    setDuration(stopId: string, minutes: number | null, maximise: boolean) {
      run(() =>
        setAppointmentTiming({
          stop_id: stopId,
          duration: maximise
            ? { minutes: null, kind: "maximise" }
            : { minutes, kind: "precise" },
        }),
      );
    },
    setDates(start: string, end: string) {
      run(() =>
        updateItinerary({ id: itineraryId, date_start: start, date_end: end }),
      );
    },
  };
}

type Actions = ReturnType<typeof usePlanningActions>;

// ── rail atoms ───────────────────────────────────────────────────────────────
function StopDot({ type }: { type: PlanningStopNode["nodeType"] }) {
  if (type === "gold")
    return (
      <span style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--gold)", display: "inline-block", boxShadow: "0 0 0 4px var(--paper), 0 0 0 5px var(--gold-soft)" }} />
    );
  if (type === "diamond")
    return (
      <span style={{ width: 11, height: 11, background: "var(--card)", border: "1.5px solid var(--ink-2)", transform: "rotate(45deg)", display: "inline-block", boxShadow: "0 0 0 4px var(--paper)" }} />
    );
  if (type === "home")
    return (
      <span style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--card)", border: "1px solid var(--rule-2)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        <MapPin size={11} color="var(--ink-2)" />
      </span>
    );
  return (
    <span style={{ width: 13, height: 13, borderRadius: "50%", background: "var(--card)", border: "1.5px solid var(--rule-2)", display: "inline-block", boxShadow: "0 0 0 4px var(--paper)" }} />
  );
}

function Row({ dot, children, last }: { dot: ReactNode; children: ReactNode; last?: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `${RAIL}px 1fr`, columnGap: 13 }}>
      <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
        <div style={{ position: "absolute", top: -2, bottom: last ? "50%" : -2, left: "50%", width: 1, background: "var(--rule-2)", transform: "translateX(-0.5px)" }} />
        <div style={{ position: "relative", zIndex: 1, marginTop: 16 }}>{dot}</div>
      </div>
      <div style={{ paddingTop: 8, paddingBottom: last ? 0 : 14, minWidth: 0 }}>{children}</div>
    </div>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span style={{ ...mono, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink-dim)" }}>{children}</span>
  );
}

// ── header ───────────────────────────────────────────────────────────────────
function LifecycleBand({ current, canOverride }: PlanningViewData["lifecycle"]) {
  const steps = ["Planning", "Planned", "Live", "Completed"];
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {steps.map((s) => {
          const active = s === current;
          return (
            <span key={s} style={{ ...mono, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: active ? "var(--ink)" : "var(--ink-faint)", fontWeight: active ? 600 : 400 }}>{s}</span>
          );
        })}
      </div>
      {canOverride && <span style={{ fontFamily: "var(--sans)", fontSize: 11.5, color: "var(--gold-2)" }}>Advance →</span>}
    </div>
  );
}

// Editable trip dates. The date label reads as plain subtitle text but is
// tappable; tapping reveals start/end date inputs. Saving (or editing the date
// of a fresh trip) is the "first change" that commits a draft into the lists.
function HeaderDates({
  header,
  dateStart,
  dateEnd,
  onSetDates,
  pending,
}: {
  header: PlanningViewData["header"];
  dateStart: string;
  dateEnd: string;
  onSetDates: (start: string, end: string) => void;
  pending: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [start, setStart] = useState(dateStart);
  const [end, setEnd] = useState(dateEnd);

  if (editing) {
    const inputStyle: CSSProperties = { ...mono, fontSize: 12, padding: "5px 8px", borderRadius: 5, border: "1px solid var(--rule-2)", background: "var(--card)", color: "var(--ink)" };
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 8, flexWrap: "wrap" }}>
        <input type="date" value={start} style={inputStyle} onChange={(e) => { setStart(e.target.value); if (end < e.target.value) setEnd(e.target.value); }} />
        <span style={{ color: "var(--ink-faint)" }}>→</span>
        <input type="date" value={end} min={start} style={inputStyle} onChange={(e) => setEnd(e.target.value)} />
        <button disabled={pending} onClick={() => { onSetDates(start, end || start); setEditing(false); }} style={{ padding: "5px 12px", borderRadius: 5, border: "none", background: "var(--ink)", color: "var(--paper)", fontFamily: "var(--sans)", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>Save</button>
        <button onClick={() => { setStart(dateStart); setEnd(dateEnd); setEditing(false); }} style={{ padding: "5px 8px", background: "transparent", border: "none", color: "var(--ink-dim)", fontFamily: "var(--sans)", fontSize: 12, cursor: "pointer" }}>Cancel</button>
      </div>
    );
  }

  return (
    <div style={{ ...mono, fontSize: 11, color: "var(--ink-dim)", marginTop: 7, letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 6 }}>
      <button onClick={() => setEditing(true)} title="Change dates" style={{ ...mono, fontSize: 11, letterSpacing: "0.04em", color: "var(--gold-2)", background: "transparent", border: "none", borderBottom: "1px dotted var(--gold)", padding: "0 0 1px", cursor: "pointer" }}>{header.dateLabel}</button>
      {header.routeLabel && <span>· {header.routeLabel}</span>}
    </div>
  );
}

function TripHeader({
  header,
  dateStart,
  dateEnd,
  onAdd,
  onSetDates,
  pending,
}: {
  header: PlanningViewData["header"];
  dateStart: string;
  dateEnd: string;
  onAdd: () => void;
  onSetDates: (start: string, end: string) => void;
  pending: boolean;
}) {
  const [exp, setExp] = useState(false);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontFamily: "var(--display)", fontSize: 30, fontWeight: 500, letterSpacing: "-0.025em", color: "var(--ink)", margin: 0, lineHeight: 1.06 }}>{header.title}</h1>
          <HeaderDates header={header} dateStart={dateStart} dateEnd={dateEnd} onSetDates={onSetDates} pending={pending} />
        </div>
        <button title="Add to this trip" onClick={onAdd} style={{ width: 38, height: 38, borderRadius: "50%", flexShrink: 0, background: "var(--ink)", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <Plus size={18} color="var(--paper)" />
        </button>
      </div>
      {header.summaryLine && (
        <div style={{ marginTop: 14 }}>
          <button onClick={() => setExp((e) => !e)} style={{ width: "100%", textAlign: "left", background: "transparent", borderTop: "1px solid var(--rule)", borderBottom: "1px solid var(--rule)", borderLeft: "none", borderRight: "none", padding: "11px 0", cursor: header.costBreakdown.length ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ ...mono, fontSize: 11.5, color: "var(--ink-2)" }}>{header.summaryLine}</span>
            {header.costBreakdown.length > 0 && (
              <span style={{ transform: exp ? "rotate(180deg)" : "none", color: "var(--ink-faint)", display: "inline-flex" }}><ChevronDown size={13} /></span>
            )}
          </button>
          {exp && (
            <div style={{ padding: "12px 2px 4px" }}>
              {header.costBreakdown.map((c) => (
                <div key={c.category} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", ...mono, fontSize: 11.5 }}>
                  <span style={{ color: "var(--ink-dim)", textTransform: "capitalize" }}>{c.category}</span>
                  <span style={{ color: "var(--ink)" }}>£{(c.amountPence / 100).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── journey strategy chip ────────────────────────────────────────────────────
function JourneyMode({ strategy, actions }: { strategy: "rail" | "drive" | "mixed" | null; actions: Actions }) {
  const opts: ("rail" | "drive" | "mixed")[] = ["rail", "drive", "mixed"];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Eyebrow>Strategy</Eyebrow>
      <div style={{ display: "flex", gap: 3, padding: 3, borderRadius: 6, background: "var(--ink-soft)", border: "1px solid var(--rule)" }}>
        {opts.map((o) => {
          const sel = strategy === o;
          return (
            <button key={o} disabled={actions.pending} onClick={() => actions.setStrategy(o)} style={{ padding: "5px 12px", borderRadius: 3, ...mono, fontSize: 9.5, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", border: "none", background: sel ? "var(--card)" : "transparent", color: sel ? "var(--ink)" : "var(--ink-dim)", fontWeight: sel ? 600 : 400, boxShadow: sel ? "0 1px 3px rgba(30,24,18,0.12)" : "none" }}>{o}</button>
          );
        })}
      </div>
    </div>
  );
}

// ── leg: mode picker ─────────────────────────────────────────────────────────
function ModeGlyph({ id, size = 17, color }: { id: string; size?: number; color: string }) {
  if (id === "drive" || id === "taxi") return <Car size={size} color={color} />;
  if (id === "cycle") return <Bike size={size} color={color} />;
  return <Footprints size={size} color={color} />;
}

// Equal-weight mode picker (brief §5): all modes shown as chips of the same
// visual weight, the engine's pick marked with a quiet gold dot. No "taxi as
// default", no collapsing behind a "change" link.
function LegPicker({ leg, actions }: { leg: PlanningLegNode; actions: Actions }) {
  const chosenId = leg.options.find((o) => o.recommended)?.id ?? leg.mode;
  return (
    <div style={{ paddingTop: 4 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {leg.options.map((m: PlanningLegMode) => {
          const sel = m.id === chosenId;
          return (
            <button
              key={m.id}
              disabled={actions.pending}
              onClick={() => actions.chooseMode(leg, m.id)}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 11px", borderRadius: 20, border: `1px solid ${sel ? "var(--gold)" : "var(--rule-2)"}`, background: sel ? "var(--gold-soft)" : "var(--card)", cursor: "pointer" }}
            >
              <ModeGlyph id={m.id} size={14} color={sel ? "var(--gold-2)" : "var(--ink-dim)"} />
              <span style={{ fontFamily: "var(--sans)", fontSize: 12.5, color: "var(--ink)", fontWeight: sel ? 500 : 400 }}>{m.label}</span>
              {m.durationMin != null && <span style={{ ...mono, fontSize: 11, color: "var(--ink-dim)" }}>{m.durationMin}m</span>}
              {m.recommended && <span title="Recommended" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--gold)" }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── leg: booked train card ───────────────────────────────────────────────────
// Reuses the shared TrainTicketCard (stations, depart/arrive, ticket type,
// route, operator, price, Aztec barcode). Falls back to a bare time card only
// when the leg carries no ticket metadata.
function TrainLeg({ leg }: { leg: PlanningLegNode }) {
  if (leg.ticket) {
    return <TrainTicketCard segment={leg.ticket} compact />;
  }
  return (
    <div style={{ borderRadius: 10, background: "var(--card)", border: "1px solid var(--rule)", boxShadow: "0 8px 26px -18px rgba(30,24,18,0.4)", padding: "13px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Train size={14} color="var(--ink-2)" />
        <Eyebrow>Rail · booked leg</Eyebrow>
      </div>
      <div style={{ ...mono, fontSize: 16, color: "var(--ink)" }}>
        {leg.dep ?? "—"} <span style={{ color: "var(--gold)" }}>→</span> {leg.arr ?? "—"}
        {leg.durationMin != null && <span style={{ fontSize: 11, color: "var(--ink-dim)", marginLeft: 8 }}>{leg.durationMin}m</span>}
      </div>
    </div>
  );
}

// ── appointment card ─────────────────────────────────────────────────────────
function AppointmentCard({ node, actions }: { node: PlanningStopNode; actions: Actions }) {
  const a = node.appointment!;
  const quick: { label: string; minutes: number | null; maximise?: boolean }[] = [
    { label: "1h", minutes: 60 },
    { label: "2h", minutes: 120 },
    { label: "3h", minutes: 180 },
    { label: "Max", minutes: null, maximise: true },
  ];
  return (
    <div style={{ borderRadius: 10, background: "var(--card)", border: "1px solid var(--gold)", padding: "16px 17px 18px", boxShadow: "0 10px 28px -18px rgba(184,137,63,0.5)" }}>
      <div style={{ marginBottom: 10 }}><Eyebrow>Appointment</Eyebrow></div>
      <div style={{ fontFamily: "var(--display)", fontSize: 21, fontWeight: 500, letterSpacing: "-0.015em", color: "var(--ink)", lineHeight: 1.1 }}>{node.title || "Appointment"}</div>

      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 7 }}>
        <Field label="Arrive" value={a.arriveTime} note={a.attribution ? "set by your travel" : undefined} />
        {a.leaveTime && (
          <Field label="On-site" value={`${a.arriveTime ?? "—"}–${a.leaveTime}`} note={a.durationMinutes != null ? fmtDur(a.durationMinutes) : undefined} />
        )}
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
        {quick.map((q) => (
          <button key={q.label} disabled={actions.pending} onClick={() => actions.setDuration(node.id, q.minutes, !!q.maximise)} style={{ flex: 1, padding: "8px 4px", borderRadius: 4, ...mono, fontSize: 11, cursor: "pointer", border: "1px solid var(--rule-2)", background: a.durationKind === "maximise" && q.maximise ? "var(--gold-soft)" : a.durationMinutes === q.minutes ? "var(--gold-soft)" : "transparent", color: "var(--ink)" }}>{q.label}</button>
        ))}
      </div>

      {a.microcopy && (
        <div style={{ marginTop: 14, paddingTop: 13, borderTop: "1px solid var(--rule)", fontFamily: "var(--serif)", fontSize: 14, color: "var(--ink)", lineHeight: 1.45 }}>{a.microcopy}</div>
      )}
    </div>
  );
}

function Field({ label, value, note }: { label: string; value: string | null; note?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
      <span style={{ ...mono, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-dim)", width: 52, flexShrink: 0 }}>{label}</span>
      <span style={{ ...mono, fontSize: 14, color: "var(--ink)" }}>{value ?? "—"}</span>
      {note && <span style={{ fontFamily: "var(--sans)", fontSize: 11.5, color: "var(--gold-2)" }}>{note}</span>}
    </div>
  );
}

// ── stop node body ───────────────────────────────────────────────────────────
function StopBody({ node, actions }: { node: PlanningStopNode; actions: Actions }) {
  if (node.nodeType === "gold") return <AppointmentCard node={node} actions={actions} />;
  return (
    <div style={{ paddingTop: 7 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
        {node.time && <span style={{ ...mono, fontSize: 12, color: "var(--ink-2)" }}>{node.time}</span>}
        <Eyebrow>{node.label}</Eyebrow>
      </div>
      {node.title && <div style={{ fontFamily: "var(--serif)", fontSize: 16, color: "var(--ink)" }}>{node.title}</div>}
    </div>
  );
}

// ── panels ───────────────────────────────────────────────────────────────────
function ThisTripNeeds({ needs }: { needs: PlanningViewData["needs"] }) {
  if (!needs.length) return null;
  return (
    <div>
      <div style={{ marginBottom: 4 }}>
        <span style={{ ...mono, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--ink-dim)" }}>This trip needs</span>
      </div>
      {needs.map((n) => (
        <div key={`${n.action_type}:${n.target_id}`} style={{ display: "flex", alignItems: "center", gap: 11, padding: "13px 2px", borderTop: "1px solid var(--rule)" }}>
          <span style={{ width: 18, height: 18, borderRadius: "50%", border: "1px solid var(--gold)", color: "var(--gold)", ...mono, fontSize: 11, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>·</span>
          <span style={{ flex: 1, fontFamily: "var(--serif)", fontSize: 14.5, color: "var(--ink)" }}>{n.label}</span>
          {n.when && <span style={{ ...mono, fontSize: 10, color: "var(--ink-dim)" }}>{n.when}</span>}
          <ChevronRight size={13} color="var(--ink-faint)" />
        </div>
      ))}
    </div>
  );
}

function Digest({ digest }: { digest: PlanningViewData["digest"] }) {
  const rows: [string, string, boolean?][] = [
    ...(digest.onSiteWindow ? ([["On-site window", digest.onSiteWindow, true]] as [string, string, boolean][]) : []),
    ["Travel time", digest.totalDurationMin > 0 ? fmtDur(digest.totalDurationMin) : "—"],
    ["Distance", digest.totalDistanceMi > 0 ? `${digest.totalDistanceMi} mi` : "—"],
    ["Costs", digest.totalCostPence > 0 ? `£${(digest.totalCostPence / 100).toFixed(2)}` : "—", true],
  ];
  return (
    <div>
      <div style={{ marginBottom: 4 }}>
        <span style={{ ...mono, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--ink-dim)" }}>Day · digest</span>
      </div>
      {rows.map(([k, v, big]) => (
        <div key={k} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, padding: "12px 0", borderTop: "1px solid var(--rule)" }}>
          <span style={{ ...mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-dim)" }}>{k}</span>
          <span style={{ fontFamily: big ? "var(--display)" : "var(--mono)", fontSize: big ? 18 : 13, fontWeight: big ? 500 : 400, color: "var(--ink)" }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

// ── screen ───────────────────────────────────────────────────────────────────
export function PlanningView({ data, pickers }: { data: PlanningViewData; pickers: Pickers }) {
  const actions = usePlanningActions(data.itinerary.id);
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div style={{ background: "var(--paper)", minHeight: "100%", padding: "6px 20px 40px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <a href="/itineraries" style={{ ...mono, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-dim)", textDecoration: "none" }}>← All trips</a>

        <div style={{ marginTop: 14 }}><LifecycleBand {...data.lifecycle} /></div>
        <div style={{ marginTop: 16 }}>
          <TripHeader
            header={data.header}
            dateStart={data.itinerary.dateStart}
            dateEnd={data.itinerary.dateEnd}
            onAdd={() => setAddOpen(true)}
            onSetDates={actions.setDates}
            pending={actions.pending}
          />
        </div>

        {actions.error && (
          <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 6, background: "var(--rust-2)", color: "var(--rust)", fontFamily: "var(--sans)", fontSize: 12 }}>{actions.error}</div>
        )}

        {/* The trip-level rail-vs-drive chip only makes sense once there's a
            journey to make — i.e. a destination beyond home. Don't ask "train
            or car?" before the user has added where they're going. */}
        {data.spine.some((n) => n.kind === "leg") && (
          <div style={{ marginTop: 20 }}>
            <JourneyMode strategy={data.itinerary.travelStrategy} actions={actions} />
          </div>
        )}

        {data.railPair && (
          <div style={{ marginTop: 18 }}>
            <PairedRailCard railPair={data.railPair} timezone={data.timezone} />
          </div>
        )}

        <div style={{ marginTop: 18 }}>
          {data.spine.map((n: PlanningSpineNode, i) => {
            const last = i === data.spine.length - 1;
            if (n.kind === "stop") {
              return (
                <Row key={n.id} dot={<StopDot type={n.nodeType} />} last={last}>
                  <StopBody node={n} actions={actions} />
                </Row>
              );
            }
            // leg
            const dot = <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--paper)", border: "1.5px solid var(--rule-2)", display: "inline-block" }} />;
            return (
              <Row key={`leg-${i}`} dot={dot} last={last}>
                {n.variant === "train" ? <TrainLeg leg={n} /> : <LegPicker leg={n} actions={actions} />}
              </Row>
            );
          })}
        </div>

        {data.needs.length > 0 && <div style={{ marginTop: 26 }}><ThisTripNeeds needs={data.needs} /></div>}
        <div style={{ marginTop: 28 }}><Digest digest={data.digest} /></div>
      </div>

      {addOpen && (
        <AddSheet
          itineraryId={data.itinerary.id}
          pickers={pickers}
          lastStopId={data.lastStopId}
          lastStopLabel={data.lastStopLabel}
          onClose={() => setAddOpen(false)}
        />
      )}
    </div>
  );
}

function fmtDur(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}
