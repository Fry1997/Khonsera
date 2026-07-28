"use client";

import Link from "next/link";
import type { Route } from "next";
import type { CSSProperties } from "react";
import type {
  AnchorVM,
  AnchorVariable,
  AnchorVariableSlot,
  GapVM,
  IntentionVM,
  LegVM,
} from "./types";
import { formatClock } from "./types";

const LEG_GLYPH: Record<string, string> = {
  walk: "M13 4.5a1.3 1.3 0 1 0 0-.01 M11 9l-2 4 3 2v5 M9 13l-2 1 M13 11l3 1 1 4 M11 9l1-2 3 1",
  car: "M5 13l1.5-4.5A2 2 0 0 1 8.4 7h7.2a2 2 0 0 1 1.9 1.5L19 13 M5 13h14v4a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H8v1a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z M7.5 16h.01 M16.5 16h.01",
  bike: "M6 18a3 3 0 1 0 0-.01 M18 18a3 3 0 1 0 0-.01 M9 18l3-7 4 7 M11 7h2l1.5 4 M9 18h0",
  train: "M8 4h8a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z M5 11h14 M9 20l-2 2 M15 20l2 2 M9.5 14h.01 M14.5 14h.01",
  plane: "M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z",
  navigation: "M3 11l18-8-8 18-2-7-8-3z",
  route: "M6 19a2 2 0 1 0 0-.01 M18 5a2 2 0 1 0 0-.01 M8 19h6a4 4 0 0 0 0-8H10a4 4 0 0 1 0-8h6",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
};
const LEG_ICO_FLEX: CSSProperties = { display: "inline-flex" };
function LegGlyph({ name, size = 13 }: { name: keyof typeof LEG_GLYPH; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={LEG_GLYPH[name]} />
    </svg>
  );
}

const ANCHOR_LABEL: Record<AnchorVM["type"], string> = {
  appointment: "Appointment",
  shift: "Shift",
  reservation: "Reservation",
  accommodation_check_in: "Check-in",
  accommodation_check_out: "Check-out",
  transport_arrival: "Arrival",
  flight: "Flight",
  custom: "Anchor",
};

const VAR_LABEL: Record<AnchorVariableSlot, string> = {
  arriveBy: "Arrive by",
  duration: "For",
  leaveBy: "Leave by",
};

function VarView({ slot, v, onEdit }: { slot: AnchorVariableSlot; v: AnchorVariable; onEdit?: (slot: AnchorVariableSlot) => void }) {
  const editable = onEdit && v.kind !== "derived";
  const body = (
    <>
      <span className="cc-var-label">{VAR_LABEL[slot]}</span>
      <span className="cc-var-value">{v.display}</span>
      {v.kind === "maximise" && v.bound ? <span className="cc-var-bound">{v.bound}</span> : null}
    </>
  );
  return editable ? (
    <button type="button" className="cc-var" data-state={v.kind} onClick={(e) => { e.stopPropagation(); onEdit!(slot); }}>{body}</button>
  ) : (
    <div className="cc-var" data-state={v.kind}>{body}</div>
  );
}

export function AnchorCard({ anchor, onSelect, onEditVariable, onRename, onFlipMode }: {
  anchor: AnchorVM;
  onSelect?: (id: string) => void;
  onEditVariable?: (id: string, slot: AnchorVariableSlot) => void;
  onRename?: (id: string) => void;
  onFlipMode?: (id: string, next: "work" | "personal") => void;
}) {
  const vars = anchor.vars;
  const fallbackArrive = anchor.time ? formatClock(anchor.time.from) : null;
  const fallbackLeave = anchor.time?.to ? formatClock(anchor.time.to) : null;
  const editHandler = onEditVariable ? (slot: AnchorVariableSlot) => onEditVariable(anchor.id, slot) : undefined;
  const shiftStart = anchor.type === "shift" ? vars?.arriveBy ?? (fallbackArrive ? { kind: "precise", display: fallbackArrive } as AnchorVariable : undefined) : undefined;
  const shiftEnd = anchor.type === "shift" ? vars?.leaveBy ?? (fallbackLeave ? { kind: "precise", display: fallbackLeave } as AnchorVariable : undefined) : undefined;

  return (
    <article className="cc-anchor-card" data-type={anchor.type} onClick={onSelect ? () => onSelect(anchor.id) : undefined} style={onSelect ? { cursor: "pointer" } : undefined}>
      <div className="cc-anchor-head">
        <span className="cc-anchor-type">{ANCHOR_LABEL[anchor.type]}</span>
        {onFlipMode && anchor.mode ? (
          <button type="button" className="cc-mode-tag cc-mode-tag-btn" data-mode={anchor.mode} onClick={(e) => { e.stopPropagation(); onFlipMode(anchor.id, anchor.mode === "work" ? "personal" : "work"); }} title={`This event is ${anchor.mode} — tap to make it ${anchor.mode === "work" ? "personal" : "work"}`}>
            {anchor.mode === "work" ? "Work" : "Personal"}
          </button>
        ) : null}
      </div>
      {onRename ? (
        <button type="button" className="cc-anchor-title cc-anchor-title-edit" data-untitled={anchor.title && anchor.title !== "Stop" ? undefined : ""} onClick={(e) => { e.stopPropagation(); onRename(anchor.id); }} title="Rename">
          <span>{anchor.title && anchor.title !== "Stop" ? anchor.title : "Name this stop"}</span>
          <span className="cc-anchor-title-edit-pen" aria-hidden>Rename</span>
        </button>
      ) : <h3 className="cc-anchor-title">{anchor.title}</h3>}
      {anchor.place ? <p className="cc-anchor-place">{anchor.place}</p> : null}

      {anchor.type === "shift" ? (
        <div className="cc-vars">
          {shiftStart ? <div className="cc-var" data-state="precise"><span className="cc-var-label">Starts</span><span className="cc-var-value">{shiftStart.display}</span></div> : null}
          {vars?.duration ? <div className="cc-var" data-state="precise"><span className="cc-var-label">For</span><span className="cc-var-value">{vars.duration.display}</span></div> : null}
          {shiftEnd ? <div className="cc-var" data-state="precise"><span className="cc-var-label">Ends</span><span className="cc-var-value">{shiftEnd.display}</span></div> : null}
        </div>
      ) : vars ? (
        <div className="cc-vars">
          {vars.arriveBy ? <VarView slot="arriveBy" v={vars.arriveBy} onEdit={editHandler} /> : null}
          {vars.duration ? <VarView slot="duration" v={vars.duration} onEdit={editHandler} /> : null}
          {vars.leaveBy ? <VarView slot="leaveBy" v={vars.leaveBy} onEdit={editHandler} /> : null}
        </div>
      ) : fallbackArrive || fallbackLeave ? (
        <div className="cc-vars">
          {fallbackArrive ? <div className="cc-var" data-state="precise"><span className="cc-var-label">Arrive by</span><span className="cc-var-value">{fallbackArrive}</span></div> : null}
          {fallbackLeave ? <div className="cc-var" data-state="derived"><span className="cc-var-label">Leave by</span><span className="cc-var-value">{fallbackLeave}</span></div> : null}
        </div>
      ) : null}
    </article>
  );
}

export function IntentionCard({ intention, onToggle, onPromote }: { intention: IntentionVM; onToggle?: (id: string) => void; onPromote?: (id: string) => void }) {
  const active = intention.state !== "toggled_off";
  return (
    <article className="cc-intention-card" data-active={active ? "true" : "false">
      <div className="cc-intention-label"><span>Intention</span><span>{intention.flexibility === "promoted_to_hard" ? "promoted" : "soft"}</span></div>
      <p className="cc-intention-desc">{intention.description}</p>
      {intention.target || intention.leaveBy ? <p className="cc-intention-meta">{intention.target ?? ""}{intention.leaveBy ? `  ·  leave by ${formatClock(intention.leaveBy)}` : ""}</p> : null}
      <div className="cc-intention-actions">
        {intention.flexibility === "soft" ? <button type="button" className="cc-btn cc-btn-ghost" onClick={() => onPromote?.(intention.id)}>Make it fixed</button> : null}
        <button type="button" className="cc-btn cc-btn-quiet" onClick={() => onToggle?.(intention.id)}>{active ? "Dismiss" : "Restore"}</button>
      </div>
    </article>
  );
}

const GAP_PROMPT: Record<GapVM["type"], string> = {
  transport_gap: "How are you getting between these?",
  accommodation_gap: "No lodging booked for these nights.",
  unplanned_time: "Free time here — shall I keep an eye on it?",
  care_gap: "A long stretch — fancy something nearby?",
};

export function GapCard({ gap, onResolve }: { gap: GapVM; onResolve?: () => void }) {
  return <article className="cc-gap-card"><p>{gap.prompt ?? GAP_PROMPT[gap.type]}</p>{onResolve ? <button type="button" className="cc-btn cc-btn-quiet" onClick={onResolve}>Resolve</button> : null}</article>;
}

export function LegCard({ leg, onCompare }: { leg: LegVM; onCompare?: () => void }) {
  const selfNavigated = ["walk", "drive"].includes(leg.mode);
  const glyph = leg.mode === "walk" ? "walk" : leg.mode === "drive" ? "car" : leg.mode === "train" ? "train" : leg.mode === "flight" ? "plane" : "route";
  return (
    <article className="cc-leg-card" data-mode={leg.mode} data-risk={leg.atRisk ? "true" : undefined}>
      <div className="cc-leg-head"><span className="cc-leg-mode" style={LEG_ICO_FLEX}><LegGlyph name={glyph as keyof typeof LEG_GLYPH} />{leg.mode}</span>{leg.notes ? <span>{leg.notes}</span> : null}</div>
      <div className="cc-leg-route"><strong>{leg.fromLabel}</strong><LegGlyph name="arrowRight" /><strong>{leg.toLabel}</strong></div>
      {leg.departure || leg.arrival ? <p className="cc-leg-time">{leg.departure ? formatClock(leg.departure) : "—"} → {leg.arrival ? formatClock(leg.arrival) : "—"}</p> : null}
      {leg.buffer?.slackMinutes != null && leg.buffer.slackMinutes > 0 ? <p className="cc-leg-buffer">{leg.buffer.slackMinutes} min spare{leg.arriveBeforeLabel ? ` before ${leg.arriveBeforeLabel}` : ""}</p> : null}
      {leg.riskNote ? <p className="cc-leg-risk">{leg.riskNote}</p> : null}
      <div className="cc-leg-actions">
        {!selfNavigated && leg.navHref ? <Link href={leg.navHref as Route} className="cc-btn cc-btn-gold"><LegGlyph name="navigation" />Navigate</Link> : null}
        {onCompare ? <button type="button" className="cc-btn cc-btn-quiet" onClick={onCompare}><LegGlyph name="route" />Compare ways</button> : null}
      </div>
    </article>
  );
}