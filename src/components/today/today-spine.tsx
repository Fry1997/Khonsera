"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import type { SpineAnchor } from "./spine-model";
import { navigateHref, londonClock, roleLabel } from "./spine-model";
import { pickNextIndex, READINESS_BUFFER_MIN, STATION_BUFFER_MIN, type EngineAnchor } from "@/lib/today/engine";
import { computeGaps, type GapStop } from "@/lib/planning/gaps";
import { ModeTag } from "@/components/concierge/mode-tag";
import { LivePass } from "@/components/plan/live-pass";
import { ScanView } from "@/components/concierge";
import type { TicketVM, BarcodeVM } from "@/components/concierge";

// Today's spine — the whole day threaded on the rail, rebuilt to the v7 "paper"
// language. Nodes are debossed icon medallions (filled charcoal for a real
// place; a light pressed well for a transit/changeover leg) centred on the rail;
// cards are cotton sheets (`.pg`). A live NOW pulse sits at the current time;
// done anchors recede above it (collapsed behind "Earlier"), the next one is
// lifted with a quiet gold accent, the rest wait below. `now` ticks every 30s so
// events visibly move up past NOW with no reload. Every anchor/leg with a
// coordinate carries a Navigate link into the point-to-point router.

const TYPE_LABEL: Record<SpineAnchor["type"], string> = {
  appointment: "Appointment",
  reservation: "Reservation",
  accommodation_check_in: "Check-in",
  accommodation_check_out: "Check-out",
  transport_arrival: "Arrival",
  flight: "Flight",
  custom: "Stop",
};

type Row =
  | { kind: "anchor"; anchor: SpineAnchor; state: "past" | "next" | "future"; late?: boolean }
  | { kind: "now" };

type AnchorRow = Extract<Row, { kind: "anchor" }>;

export function TodaySpine({ anchors, nextId, nowOverride }: { anchors: SpineAnchor[]; nextId?: string | null; nowOverride?: number | null }) {
  const [internalNow, setInternalNow] = useState(() => Date.now());
  const [showPast, setShowPast] = useState(false);
  // One ScanView for every inline pass node — the barrier surface (the saved
  // Aztec), opened from a pass's "Show ticket" without leaving the spine.
  const [scan, setScan] = useState<{ summary: string; barcodes: BarcodeVM[] } | null>(null);
  const openScan = (ticket: TicketVM) => {
    const leg = ticket.legs[0];
    if (!leg?.barcodes?.length) return;
    setScan({ summary: `${ticket.operator} · ${leg.origin.place} → ${leg.destination.place}`, barcodes: leg.barcodes });
  };

  useEffect(() => {
    if (nowOverride != null) return; // driven externally (demo time-travel)
    const t = setInterval(() => setInternalNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [nowOverride]);

  const now = nowOverride ?? internalNow;

  // Pick the next obligation with the SAME engine logic the live card uses, so a
  // late-but-unreached obligation stays in front here too rather than reeling
  // into the past behind NOW. Falls back to the server-provided nextId.
  const engineNextId = useMemo(() => {
    const ea: EngineAnchor[] = anchors.map((a) => ({
      id: a.id,
      startMs: a.arriveByIso ? Date.parse(a.arriveByIso) : null,
      endMs: a.endIso ? Date.parse(a.endIso) : null,
      plannedTravelMinutes: a.plannedTravelMinutes,
      isStation: !!a.station,
    }));
    const idx = pickNextIndex(ea, now);
    return idx != null ? anchors[idx].id : null;
  }, [anchors, now]);
  const activeNextId = engineNextId ?? nextId;

  // Genuine spare time before each anchor — the leftover once the leg INTO it is
  // taken out of the window from the previous stop. Computed with the same pure
  // gap engine the planner uses (minSpare=0 so a walk card can always show its
  // true slack, not just gaps over the planner's 15-min threshold). Keyed by the
  // destination anchor (beforeStopId) for the WalkCard's "{N} min spare" pill.
  const spareByAnchorId = useMemo(() => {
    const stops: GapStop[] = anchors.map((a) => ({
      id: a.id,
      startMs: a.arriveByIso ? Date.parse(a.arriveByIso) : null,
      endMs: a.endIso ? Date.parse(a.endIso) : a.arriveByIso ? Date.parse(a.arriveByIso) : null,
    }));
    const legMinutes = anchors.slice(1).map((a) => a.plannedTravelMinutes);
    const gaps = computeGaps(stops, legMinutes, 0);
    const m = new Map<string, number>();
    for (const g of gaps) m.set(g.beforeStopId, g.spareMinutes);
    return m;
  }, [anchors]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    const nextIdx = anchors.findIndex((a) => a.id === activeNextId);
    let nowPlaced = false;
    for (let i = 0; i < anchors.length; i++) {
      const a = anchors[i];
      const startMs = a.arriveByIso ? new Date(a.arriveByIso).getTime() : null;
      const endMs = a.endIso ? new Date(a.endIso).getTime() : startMs;
      // NOW drops in right before the active obligation — so an obligation you're
      // late to (its clock time already passed) sits in FRONT of now, where
      // you're still headed, not reeled behind it.
      if (!nowPlaced && nextIdx >= 0 && i === nextIdx) {
        out.push({ kind: "now" });
        nowPlaced = true;
      }
      const state: "past" | "next" | "future" =
        a.id === activeNextId ? "next" : nextIdx < 0 ? "past" : i < nextIdx ? "past" : "future";
      const late = a.id === activeNextId && endMs != null && endMs < now;
      out.push({ kind: "anchor", anchor: a, state, late });
    }
    if (!nowPlaced) out.push({ kind: "now" }); // whole day is behind us
    return out;
  }, [anchors, now, activeNextId]);

  if (anchors.length === 0) return null;

  // Done anchors reel off the top: collapse them behind one "Earlier" line so
  // NOW and what's ahead lead the spine. They're the oldest, so lifting them to
  // a top cluster keeps the day in order; tap to bring them back.
  const pastRows = rows.filter((r): r is AnchorRow => r.kind === "anchor" && r.state === "past");
  const liveRows = rows.filter((r) => !(r.kind === "anchor" && r.state === "past"));

  return (
    <section>
      <div className="cc-eyebrow" style={{ marginBottom: "var(--space-3)" }}>
        Today · {liveRows.filter((r) => r.kind === "anchor").length || anchors.length}
        {pastRows.length > 0 ? ` · ${pastRows.length} done` : ""}
      </div>
      <div className="cc-spine cc-spine-v7">
        <div className="cc-spine-rail" />
        {pastRows.length > 0 ? (
          <PastToggle count={pastRows.length} open={showPast} onToggle={() => setShowPast((v) => !v)} />
        ) : null}
        {showPast ? pastRows.map((row) => <SpineEntry key={row.anchor.id} anchor={row.anchor} state="past" spare={spareByAnchorId.get(row.anchor.id) ?? null} onShow={openScan} />) : null}
        {liveRows.map((row, i) =>
          row.kind === "now" ? (
            <div className="cc-node" key={`now-${i}`}>
              <div className="cc-node-dot">
                <span className="cc-dot-now" />
              </div>
              <div style={{ alignSelf: "center" }}>
                <span className="cc-eyebrow" style={{ color: "var(--gold-2)" }}>
                  Now · {londonClock(new Date(now).toISOString())}
                </span>
              </div>
            </div>
          ) : (
            <SpineEntry key={row.anchor.id} anchor={row.anchor} state={row.state} late={row.late} spare={spareByAnchorId.get(row.anchor.id) ?? null} onShow={openScan} />
          ),
        )}
      </div>
      {scan ? <ScanView summary={scan.summary} barcodes={scan.barcodes} onClose={() => setScan(null)} /> : null}
    </section>
  );
}

// An anchor occupies one or two spine rows: the travel leg INTO it (a walk card,
// when the plan carries a leg + a destination to navigate to) renders first on
// its own transit node, then the anchor — or, for a station changeover, the
// changeover card — renders below.
function SpineEntry({ anchor, state, late, spare, onShow }: { anchor: SpineAnchor; state: "past" | "next" | "future"; late?: boolean; spare?: number | null; onShow?: (ticket: TicketVM) => void }) {
  const showWalk = !!anchor.plannedTravelMinutes && !!navigateHref(anchor) && state !== "past";
  const isAppointment = anchor.type === "appointment" || anchor.type === "reservation";
  return (
    <>
      {showWalk ? <WalkLeg anchor={anchor} spare={spare} /> : null}
      {anchor.role === "changeover" ? (
        <ChangeoverNode anchor={anchor} state={state} />
      ) : isAppointment ? (
        <AppointmentCard anchor={anchor} state={state} late={late} />
      ) : (
        <AnchorNode anchor={anchor} state={state} late={late} />
      )}
      {/* The booked ticket boards HERE — drop its pass inline, right after the
         departure / changeover node, so the journey carries its own credential
         on the spine rather than in a block above. Dimmed once it's behind us. */}
      {anchor.pass ? <PassNode pass={anchor.pass} state={state} onShow={onShow} /> : null}
    </>
  );
}

// ─── Inline rail/air pass node — a diamond medallion (a credential, distinct
// from the round place/leg medallions) seated on the rail, carrying the live
// Pass (charcoal band · big station codes · DEPART/ARRIVE/PLATFORM/SEAT stub ·
// "Show ticket · ref"). The pass IS the boarding-pass card; live Darwin status
// folds onto it via LivePass. Recedes with the rest of the day once past. ─────
function PassNode({ pass, state, onShow }: { pass: NonNullable<SpineAnchor["pass"]>; state: "past" | "next" | "future"; onShow?: (ticket: TicketVM) => void }) {
  return (
    <div className="cc-node" data-state={state} style={state === "past" ? { opacity: 0.6 } : undefined}>
      <div className="cc-node-dot">
        <span className="cc-med-pass">
          <span className="engr-ico" style={{ ...ICO_FLEX, color: "var(--ink-dim)" }}><Glyph name="ticket" size={13} /></span>
        </span>
      </div>
      <div className="cc-pass-inline">
        <LivePass ticket={pass.ticket} crs={pass.crs} time={pass.time} dest={pass.dest} onShow={onShow} />
      </div>
    </div>
  );
}

// The collapsed "earlier today" line — a quiet spine node that folds the day's
// done anchors away by default and reveals them on tap.
function PastToggle({ count, open, onToggle }: { count: number; open: boolean; onToggle: () => void }) {
  return (
    <div className="cc-node">
      <div className="cc-node-dot">
        <span className="cc-med-leg" style={{ width: 26, height: 26 }}>
          <span className="engr-ico" style={ICO_FLEX}><Glyph name="clock" size={13} /></span>
        </span>
      </div>
      <button
        type="button"
        onClick={onToggle}
        style={{
          alignSelf: "center",
          display: "inline-flex",
          alignItems: "center",
          gap: "var(--space-2)",
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          fontSize: "var(--fs-micro)",
          textTransform: "uppercase",
          letterSpacing: "var(--ls-uc)",
          color: "var(--ink-dim)",
        }}
        aria-expanded={open}
      >
        {open ? "Hide" : "Earlier"} · {count} done
        <Glyph name="chevron" size={11} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 120ms" }} />
      </button>
    </div>
  );
}

// ─── Walk / movement leg — the planner's richer WalkCard on raised cotton: a
// mode chip, the {mins} headline + a charcoal Navigate pill, a dashed-rule time
// WINDOW (depart → arrive, derived from the anchor's arrive time minus the leg)
// with a "Direct" tag (a walk is one hop, no changeover), the sage "{N} min
// spare" pill (from the gap engine), and a footer status strip with an inert
// "Compare ways →" affordance. Only rendered when the plan carries a leg into
// this anchor and a coordinate to route to. Where a bit's data is absent it is
// omitted, never fabricated. ─────────────────────────────────────────────────
function WalkLeg({ anchor, spare }: { anchor: SpineAnchor; spare?: number | null }) {
  const href = navigateHref(anchor)!;
  const mins = anchor.plannedTravelMinutes!;
  const word = anchor.navMode === "drive" ? "Drive" : anchor.navMode === "cycle" ? "Cycle" : "Walk";
  const icon = anchor.navMode === "drive" ? "car" : anchor.navMode === "cycle" ? "bike" : "walk";
  const dest = anchor.station ? anchor.title : anchor.place ?? anchor.title;

  // The walk-in window: you ARRIVE at the anchor's arrive-by time; you DEPART
  // `mins` earlier. Both ends come from real plan data — omit the strip if the
  // arrive time is absent rather than inventing one.
  const arriveAt = londonClock(anchor.arriveByIso);
  const departAt = anchor.arriveByIso
    ? londonClock(new Date(Date.parse(anchor.arriveByIso) - mins * 60_000).toISOString())
    : null;
  const showWindow = !!departAt && !!arriveAt;

  return (
    <div className="cc-node">
      <div className="cc-node-dot">
        <span className="cc-med-leg">
          <span className="engr-ico" style={ICO_FLEX}><Glyph name={icon} size={15} /></span>
        </span>
      </div>
      <div className="pg cc-walk">
        <div className="cc-walk-head">
          <span className="cc-walk-mode">
            <span className="engr-ico" style={ICO_FLEX}><Glyph name={icon} size={12} /></span>
            {word}
          </span>
          <span className="cc-walk-mins mono engr">{mins} min</span>
          <Link href={href} className="cc-btn cc-btn-gold cc-walk-nav" style={NAV_BTN}>
            <span className="engr-ico-d" style={ICO_FLEX}><Glyph name="navigation" size={12} /></span>
            Navigate
          </Link>
        </div>

        {showWindow ? (
          <div className="cc-walk-window">
            <span className="mono cc-walk-time">{departAt}</span>
            <span className="cc-walk-rule" aria-hidden />
            <span className="mono cc-walk-time">{arriveAt}</span>
            <span className="cc-walk-direct">Direct</span>
          </div>
        ) : null}

        <div className="cc-walk-dest">
          <span style={{ color: "var(--ink-faint)", flex: "none", display: "inline-flex" }}><Glyph name="arrowRight" size={11} /></span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dest}</span>
          {spare != null && spare > 0 ? <span className="cc-walk-spare">{spare} min spare</span> : null}
        </div>

        <div className="cc-walk-foot">
          <span className="sb cc-walk-proposed">Proposed</span>
          {/* No per-leg compare route on Today yet — present-but-inert affordance. */}
          <span className="cc-walk-compare" aria-disabled>
            Compare ways
            <Glyph name="arrowRight" size={11} />
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── AppointmentCard — an appointment/reservation given the planner treatment:
// a gold LEFT EDGE (gold is punctuation), the per-item WORK/Personal ModeTag,
// the name + sub-place, an "Arrive by ~{t}" / "Leave by {t} · derived" pair (the
// leave-by back-calculated from arrive-by minus the leg + a readiness buffer —
// the same maths the live engine uses), and a "Notes / Add" footer. The derived
// flag wears the gold accent; leave-by is omitted (not faked) when its inputs
// aren't on the plan. ────────────────────────────────────────────────────────
function AppointmentCard({ anchor, state, late }: { anchor: SpineAnchor; state: "past" | "next" | "future"; late?: boolean }) {
  const past = state === "past";
  const next = state === "next";
  const arrive = londonClock(anchor.arriveByIso);

  // Leave-by = arrive-by − (travel + a readiness buffer). Station boarding gets
  // the bigger buffer; a plain appointment the light get-ready one. Derived only
  // when both the arrive time and the planned leg exist.
  const buffer = anchor.station ? STATION_BUFFER_MIN : READINESS_BUFFER_MIN;
  const leaveBy =
    anchor.arriveByIso && anchor.plannedTravelMinutes != null
      ? londonClock(new Date(Date.parse(anchor.arriveByIso) - (anchor.plannedTravelMinutes + buffer) * 60_000).toISOString())
      : null;

  return (
    <div className="cc-node" data-state={state}>
      <div className="cc-node-dot">
        <span className="cc-med-anchor">
          <span className="engr-ico-d" style={ICO_FLEX}><Glyph name="calendar" size={19} /></span>
        </span>
      </div>
      <div className="pg cc-appt" data-past={past || undefined}>
        <div className="cc-appt-head">
          <span style={{ ...EYB, color: next ? "var(--gold-2)" : "var(--ink-dim)" }}>
            {past ? "Done · " : ""}
            {TYPE_LABEL[anchor.type]}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
            <ModeTag mode={anchor.mode} />
            {late ? (
              <span style={{ ...EYB, color: "var(--amber)", border: "1px solid var(--amber)", borderRadius: "var(--radius-xs)", padding: "1px 5px" }}>
                Running late
              </span>
            ) : null}
          </span>
        </div>

        <h3 className="cc-appt-title">{anchor.title}</h3>
        {anchor.place && anchor.place !== anchor.title ? <p className="cc-appt-sub">{anchor.place}</p> : null}

        <div className="cc-appt-times">
          {arrive ? (
            <span className="cc-appt-time">
              <span style={{ ...EYB, color: "var(--ink-faint)" }}>Arrive by</span>
              <span className="mono engr cc-appt-clock">~{arrive}</span>
            </span>
          ) : null}
          {leaveBy ? (
            <span className="cc-appt-time">
              <span style={{ ...EYB, color: "var(--ink-faint)" }}>Leave by</span>
              <span className="mono engr cc-appt-clock">
                {leaveBy}
                <span className="cc-appt-derived"> · derived</span>
              </span>
            </span>
          ) : null}
        </div>

        <div className="cc-appt-foot">
          <span className="cc-appt-notes">Notes</span>
          <span className="cc-appt-add" aria-disabled>Add</span>
        </div>
      </div>
    </div>
  );
}

// ─── Changeover card — "Change at {station}", the available-time figure coloured
// by verdict, and a verdict ring on the node. Available time is derived from the
// stop's own arrive (start) → depart (end) window; platforms are not carried in
// the spine model, so they are omitted truthfully (see report). ──────────────
type Verdict = "comfortable" | "tight" | "risky";
function changeVerdict(mins: number | null): { verdict: Verdict; color: string; label: string } {
  // Comfortable ≥ 10m, tight 5–9m, risky < 5m (a conventional UK interchange band).
  if (mins == null || mins >= 10) return { verdict: "comfortable", color: "var(--sage)", label: "Comfortable" };
  if (mins >= 5) return { verdict: "tight", color: "var(--amber)", label: "Tight" };
  return { verdict: "risky", color: "var(--rust)", label: "Risky" };
}

function ChangeoverNode({ anchor, state }: { anchor: SpineAnchor; state: "past" | "next" | "future" }) {
  const past = state === "past";
  const arriveMs = anchor.arriveByIso ? Date.parse(anchor.arriveByIso) : null;
  const departMs = anchor.endIso ? Date.parse(anchor.endIso) : null;
  const mins = arriveMs != null && departMs != null ? Math.max(0, Math.round((departMs - arriveMs) / 60000)) : null;
  const v = changeVerdict(mins);
  const at = anchor.station?.name ?? anchor.title;
  return (
    <div className="cc-node" data-state={state} style={past ? { opacity: 0.6 } : undefined}>
      <div className="cc-node-dot">
        <span className="cc-med-change" data-verdict={v.verdict}>
          <span className="engr-ico" style={{ ...ICO_FLEX, color: "var(--ink-dim)" }}><Glyph name="swap" size={14} /></span>
        </span>
      </div>
      <div className="pg" style={{ ...CARD_TILE, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 15px" }}>
          <span style={CHANGE_CHIP}>
            <span className="engr-ico" style={ICO_FLEX}><Glyph name="swap" size={16} /></span>
          </span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: "block", fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--ink)" }}>Change at {at}</span>
            <span style={{ ...EYB, color: v.color, marginTop: 3, display: "block" }}>{v.label}</span>
          </span>
          {mins != null ? (
            <span style={{ textAlign: "right", flex: "none" }}>
              <span className="mono engr" style={{ display: "block", fontSize: 19, fontWeight: 600, color: v.color, lineHeight: 1 }}>{mins}m</span>
              <span style={{ ...EYB, color: "var(--ink-faint)", marginTop: 3, display: "block" }}>TO CHANGE</span>
            </span>
          ) : null}
        </div>
        <div style={{ borderTop: "1px solid var(--line)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, padding: "12px 15px 13px" }}>
          <span>
            <span style={{ ...EYB, color: "var(--ink-faint)", marginBottom: 5, display: "block" }}>ARRIVE INTO</span>
            <span className="mono" style={{ fontSize: 13, color: "var(--ink)" }}>{londonClock(anchor.arriveByIso) ?? "—"}</span>
          </span>
          <span>
            <span style={{ ...EYB, color: "var(--ink-faint)", marginBottom: 5, display: "block" }}>DEPART FROM</span>
            <span className="mono" style={{ fontSize: 13, color: "var(--ink)" }}>{londonClock(anchor.endIso) ?? "—"}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Anchor card — a real stop as a material cotton sheet with a filled charcoal
// medallion node. Debossed title + mono time; the "next" anchor keeps a quiet
// gold eyebrow + left edge (gold is punctuation, never a fill). ──────────────
function AnchorNode({ anchor, state, late }: { anchor: SpineAnchor; state: "past" | "next" | "future"; late?: boolean }) {
  const href = navigateHref(anchor);
  const arrive = londonClock(anchor.arriveByIso);
  const next = state === "next";
  const past = state === "past";
  const station = anchor.station;
  const icon = anchorIcon(anchor);

  // Eyebrow: a station reads as its role (Departure / Change / Arrival); a plain
  // anchor keeps its type label.
  const eyebrow = station ? roleLabel(anchor.role, station) : TYPE_LABEL[anchor.type];

  return (
    <div className="cc-node" data-state={state}>
      <div className="cc-node-dot">
        <span className="cc-med-anchor">
          <span className="engr-ico-d" style={ICO_FLEX}><Glyph name={icon} size={19} /></span>
        </span>
      </div>
      <div
        className="pg"
        style={{
          ...CARD_TILE,
          borderLeft: next ? "2px solid var(--gold)" : CARD_TILE.border,
          opacity: past ? 0.6 : 1,
          padding: "var(--space-3) var(--space-4)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "var(--space-3)" }}>
          <span style={{ ...EYB, color: next ? "var(--gold-2)" : "var(--ink-dim)" }}>
            {past ? "Done · " : ""}
            {eyebrow}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
            {late ? (
              <span style={{ ...EYB, color: "var(--amber)", border: "1px solid var(--amber)", borderRadius: "var(--radius-xs)", padding: "1px 5px" }}>
                Running late
              </span>
            ) : null}
            {arrive ? <span className="mono engr" style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{arrive}</span> : null}
          </span>
        </div>

        <h3 style={{ margin: "4px 0 0", fontSize: "var(--fs-h3)", lineHeight: "var(--lh-h3)", fontWeight: 600, letterSpacing: "-0.02em", color: "var(--ink)", display: "flex", alignItems: "baseline", gap: "var(--space-2)" }}>
          <span>{anchor.title}</span>
          {station?.code ? (
            <span className="mono" style={STATION_CODE}>{station.code}</span>
          ) : null}
        </h3>
        {anchor.place && anchor.place !== anchor.title ? (
          <p style={{ margin: "2px 0 0", fontSize: "var(--fs-label)", color: "var(--ink-dim)" }}>{anchor.place}</p>
        ) : null}

        {href && !past ? (
          <div style={{ marginTop: "var(--space-2)" }}>
            <Link href={href} className={next ? "cc-btn cc-btn-gold" : "cc-btn"} style={{ fontSize: "var(--fs-label)" }}>
              Navigate
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// Which medallion glyph a real stop wears: home/base → house, rail → train,
// airport → plane, appointment → calendar, default → pin.
function anchorIcon(a: SpineAnchor): GlyphName {
  if (a.station) return a.station.kind === "airport" ? "plane" : "train";
  if (a.type === "flight") return "plane";
  if (a.type === "appointment" || a.type === "reservation") return "calendar";
  if (a.type === "accommodation_check_in" || a.type === "accommodation_check_out") return "bed";
  if (/\b(home|house|base)\b/i.test(a.title)) return "home";
  return "pin";
}

// ─── Lucide-style stroke glyphs — one stroke idiom, debossed via .engr-ico. No
// emojis. Paths kept simple; sized by the medallion. ─────────────────────────
type GlyphName =
  | "home" | "train" | "plane" | "calendar" | "bed" | "pin"
  | "walk" | "car" | "bike" | "swap" | "navigation" | "arrowRight" | "chevron" | "clock" | "ticket";

const GLYPH_PATHS: Record<GlyphName, string> = {
  home: "M3 10.5 12 3l9 7.5 M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5 M9.5 21v-6h5v6",
  train: "M8 4h8a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z M5 11h14 M9 20l-2 2 M15 20l2 2 M9.5 14h.01 M14.5 14h.01",
  plane: "M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z",
  calendar: "M7 3v3 M17 3v3 M4 8h16 M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z",
  bed: "M3 18V8 M3 14h15a3 3 0 0 1 3 3v1 M21 18v-2 M7 11h4a2 2 0 0 1 2 2",
  pin: "M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z M12 10.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z",
  walk: "M13 4.5a1.3 1.3 0 1 0 0-.01 M11 9l-2 4 3 2v5 M9 13l-2 1 M13 11l3 1 1 4 M11 9l1-2 3 1",
  car: "M5 13l1.5-4.5A2 2 0 0 1 8.4 7h7.2a2 2 0 0 1 1.9 1.5L19 13 M5 13h14v4a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H8v1a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z M7.5 16h.01 M16.5 16h.01",
  bike: "M6 18a3 3 0 1 0 0-.01 M18 18a3 3 0 1 0 0-.01 M9 18l3-7 4 7 M11 7h2l1.5 4 M9 18h0",
  swap: "M16 3l4 4-4 4 M20 7H7 M8 21l-4-4 4-4 M4 17h13",
  navigation: "M3 11l18-8-8 18-2-7-8-3z",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  chevron: "M6 9l6 6 6-6",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 2",
  ticket: "M4 7a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v3a2 2 0 0 0 0 4v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3a2 2 0 0 0 0-4z M14 6v12",
};

function Glyph({ name, size = 16, style }: { name: GlyphName; size?: number; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={style}>
      <path d={GLYPH_PATHS[name]} />
    </svg>
  );
}

// ─── Shared inline style atoms (colour tokens; one-off px per the incremental
// migration policy). Centralised so the JSX reads cleanly. ───────────────────
const ICO_FLEX: CSSProperties = { display: "inline-flex" };
const EYB: CSSProperties = { fontSize: "var(--fs-micro)", textTransform: "uppercase", letterSpacing: "var(--ls-uc)" };
const CARD_TILE: CSSProperties = {
  background: "var(--widget)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--lift)",
};
const CHANGE_CHIP: CSSProperties = {
  display: "inline-grid",
  placeItems: "center",
  width: 32,
  height: 32,
  borderRadius: 10,
  background: "var(--widget-2)",
  color: "var(--ink-2)",
  flex: "none",
  boxShadow: "var(--lift-sm)",
};
const NAV_BTN: CSSProperties = { flex: "none", fontSize: "var(--fs-label)", display: "inline-flex", alignItems: "center", gap: 5 };
const STATION_CODE: CSSProperties = {
  fontSize: "var(--fs-micro)",
  letterSpacing: "0.08em",
  color: "var(--ink-dim)",
  border: "1px solid var(--rule-2)",
  borderRadius: "var(--radius-xs)",
  padding: "1px 4px",
};
