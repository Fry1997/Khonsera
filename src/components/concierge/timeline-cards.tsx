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

// Minimal stroke glyphs for the LegCard (mode chip · Navigate · Compare ways),
// in the same one-stroke idiom as the rest of the spine. No emojis.
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

// The four spine primitives, rebuilt to Design's Edition II screen contract
// (`khonsera-edition-ii-screens.css` · `.cc-*` + data-* states). Code keeps the
// names + data; the CSS owns the look. (Round 2 / Design for-code.zip.)

const ANCHOR_LABEL: Record<AnchorVM["type"], string> = {
  appointment: "Appointment",
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

function VarView({
  slot,
  v,
  onEdit,
}: {
  slot: AnchorVariableSlot;
  v: AnchorVariable;
  onEdit?: (slot: AnchorVariableSlot) => void;
}) {
  const editable = onEdit && v.kind !== "derived";
  const body = (
    <>
      <span className="cc-var-label">{VAR_LABEL[slot]}</span>
      <span className="cc-var-value">{v.display}</span>
      {v.kind === "maximise" && v.bound ? (
        <span className="cc-var-bound">{v.bound}</span>
      ) : null}
    </>
  );
  return editable ? (
    <button
      type="button"
      className="cc-var"
      data-state={v.kind}
      onClick={(e) => {
        e.stopPropagation();
        onEdit!(slot);
      }}
    >
      {body}
    </button>
  ) : (
    <div className="cc-var" data-state={v.kind}>
      {body}
    </div>
  );
}

export function AnchorCard({
  anchor,
  onSelect,
  onEditVariable,
  onRename,
  onFlipMode,
}: {
  anchor: AnchorVM;
  onSelect?: (id: string) => void;
  onEditVariable?: (id: string, slot: AnchorVariableSlot) => void;
  onRename?: (id: string) => void; // deep review 2026-06-15 — tap the title to rename
  onFlipMode?: (id: string, next: "work" | "personal") => void; // per-event work/personal tag
}) {
  // Three-variable model when `vars` is present; else the legacy time fallback.
  const vars = anchor.vars;
  const fallbackArrive = anchor.time ? formatClock(anchor.time.from) : null;
  const fallbackLeave = anchor.time?.to ? formatClock(anchor.time.to) : null;
  const editHandler = onEditVariable
    ? (slot: AnchorVariableSlot) => onEditVariable(anchor.id, slot)
    : undefined;

  return (
    <article
      className="cc-anchor-card"
      data-type={anchor.type}
      onClick={onSelect ? () => onSelect(anchor.id) : undefined}
      style={onSelect ? { cursor: "pointer" } : undefined}
    >
      <div className="cc-anchor-head">
        <span className="cc-anchor-type">{ANCHOR_LABEL[anchor.type]}</span>
        {onFlipMode && anchor.mode ? (
          <button
            type="button"
            className="cc-mode-tag cc-mode-tag-btn"
            data-mode={anchor.mode}
            onClick={(e) => { e.stopPropagation(); onFlipMode(anchor.id, anchor.mode === "work" ? "personal" : "work"); }}
            title={`This event is ${anchor.mode} — tap to make it ${anchor.mode === "work" ? "personal" : "work"}`}
          >
            {anchor.mode === "work" ? "Work" : "Personal"}
          </button>
        ) : null}
      </div>
      {onRename ? (
        <button
          type="button"
          className="cc-anchor-title cc-anchor-title-edit"
          data-untitled={anchor.title && anchor.title !== "Stop" ? undefined : ""}
          onClick={(e) => { e.stopPropagation(); onRename(anchor.id); }}
          title="Rename"
        >
          <span>{anchor.title && anchor.title !== "Stop" ? anchor.title : "Name this stop"}</span>
          <span className="cc-anchor-title-edit-pen" aria-hidden>Rename</span>
        </button>
      ) : (
        <h3 className="cc-anchor-title">{anchor.title}</h3>
      )}
      {anchor.place ? <p className="cc-anchor-place">{anchor.place}</p> : null}

      {vars ? (
        <div className="cc-vars">
          {vars.arriveBy ? <VarView slot="arriveBy" v={vars.arriveBy} onEdit={editHandler} /> : null}
          {vars.duration ? <VarView slot="duration" v={vars.duration} onEdit={editHandler} /> : null}
          {vars.leaveBy ? <VarView slot="leaveBy" v={vars.leaveBy} onEdit={editHandler} /> : null}
        </div>
      ) : fallbackArrive || fallbackLeave ? (
        <div className="cc-vars">
          {fallbackArrive ? (
            <div className="cc-var" data-state="precise">
              <span className="cc-var-label">Arrive by</span>
              <span className="cc-var-value">{fallbackArrive}</span>
            </div>
          ) : null}
          {fallbackLeave ? (
            <div className="cc-var" data-state="derived">
              <span className="cc-var-label">Leave by</span>
              <span className="cc-var-value">{fallbackLeave}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function IntentionCard({
  intention,
  onToggle,
  onPromote,
}: {
  intention: IntentionVM;
  onToggle?: (id: string) => void;
  onPromote?: (id: string) => void;
}) {
  const active = intention.state !== "toggled_off";
  return (
    <article className="cc-intention-card" data-active={active ? "true" : "false"}>
      <div className="cc-intention-label">
        <span>Intention</span>
        <span>{intention.flexibility === "promoted_to_hard" ? "promoted" : "soft"}</span>
      </div>
      <p className="cc-intention-desc">{intention.description}</p>
      {intention.target || intention.leaveBy ? (
        <p className="cc-intention-meta">
          {intention.target ?? ""}
          {intention.leaveBy ? `  ·  leave by ${formatClock(intention.leaveBy)}` : ""}
        </p>
      ) : null}
      <div className="cc-intention-actions">
        {intention.flexibility === "soft" ? (
          <button type="button" className="cc-btn cc-btn-ghost" onClick={() => onPromote?.(intention.id)}>
            Make it fixed
          </button>
        ) : null}
        <button type="button" className="cc-btn cc-btn-quiet" onClick={() => onToggle?.(intention.id)}>
          {active ? "Dismiss" : "Restore"}
        </button>
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

export function GapCard({
  gap,
  onResolve,
}: {
  gap: GapVM;
  onResolve?: (id: string) => void;
}) {
  return (
    <article className="cc-gap-card" data-state={gap.state}>
      {gap.fromLabel && gap.toLabel ? (
        <p className="cc-gap-ends">
          {gap.fromLabel} &rarr; {gap.toLabel}
        </p>
      ) : null}
      <p className="cc-gap-prompt">{gap.prompt ?? GAP_PROMPT[gap.type]}</p>
      <div className="cc-gap-actions">
        <button type="button" className="cc-btn cc-btn-gold" onClick={() => onResolve?.(gap.id)}>
          Resolve
        </button>
        <button type="button" className="cc-btn cc-btn-ghost">Later</button>
      </div>
    </article>
  );
}

const LEG_LABEL: Record<LegVM["mode"], string> = {
  walk: "Walk",
  drive: "Drive",
  taxi: "Taxi",
  bus: "Bus",
  tube: "Tube",
  train: "Train",
  flight: "Flight",
  mixed: "Mixed",
};

// booking status → the design's leg states
const LEG_STATE: Record<LegVM["bookingStatus"], "chosen" | "proposed" | "unresolved"> = {
  synced: "chosen",
  booked_in_app: "chosen",
  manual: "proposed",
  unbooked_stub: "unresolved",
};

// Which glyph the mode chip wears.
const LEG_MODE_GLYPH: Record<LegVM["mode"], keyof typeof LEG_GLYPH> = {
  walk: "walk",
  drive: "car",
  taxi: "car",
  bus: "train",
  tube: "train",
  train: "train",
  flight: "plane",
  mixed: "walk",
};

// LegCard — the door-to-door travel between two anchors, restyled to the design's
// WalkCard (the same `.cc-walk` paper as Today): a mode chip · a DOOR-TO-DOOR
// eyebrow over the `{mins} min` headline · a charcoal Navigate pill (deep-links
// into the router when the destination carries a coordinate) · a divider · a
// `{depart} → {arrive}` row with a DIRECT tag + the sage `● {N} MIN SPARE` pill ·
// the "Arrive {t} — {N} min before {dest}" sub-line · a footer with a PROPOSED
// lifecycle pill and the COMPARE WAYS → affordance (still opens the compare
// sheet via onCompare). Tokens only; gold stays punctuation.
export function LegCard({ leg, onCompare }: { leg: LegVM; onCompare?: (id: string) => void }) {
  const state = leg.atRisk ? "at-risk" : LEG_STATE[leg.bookingStatus];
  const word = LEG_LABEL[leg.mode];
  const glyph = LEG_MODE_GLYPH[leg.mode];
  // The headline is the duration. Prefer the explicit "N min" note the plan
  // carries; fall back to a depart–arrive window, then to a calm prompt.
  const headline = leg.notes ?? (leg.departure && leg.arrival
    ? `${formatClock(leg.departure)}–${formatClock(leg.arrival)}`
    : "Travel needed");
  // The buffer made legible: how many minutes you LAND EARLY before the next fixed
  // thing. Shown as a real number on every leg, not a vague "Comfortable".
  const spare = leg.buffer?.slackMinutes;
  const showWindow = !!leg.departure && !!leg.arrival;
  const lifecycle = state === "chosen" ? "Booked" : "Proposed";

  return (
    <div className="cc-walk cc-leg-card" data-state={state}>
      <div className="cc-walk-head">
        <span className="cc-walk-mode">
          <span style={LEG_ICO_FLEX}><LegGlyph name={glyph} size={12} /></span>
          {word}
        </span>
        <span className="cc-leg-doortodoor">
          <span className="cc-leg-doortodoor-eyb">Door-to-door</span>
          <span className="cc-walk-mins mono engr">{headline}</span>
        </span>
        {leg.navHref ? (
          <Link href={leg.navHref as Route} className="cc-btn cc-btn-gold cc-walk-nav" style={LEG_NAV_BTN}>
            <span style={LEG_ICO_FLEX}><LegGlyph name="navigation" size={12} /></span>
            Navigate
          </Link>
        ) : null}
      </div>

      {showWindow ? (
        <div className="cc-walk-window">
          <span className="mono cc-walk-time">{formatClock(leg.departure)}</span>
          <span className="cc-walk-rule" aria-hidden />
          <span className="mono cc-walk-time">{formatClock(leg.arrival)}</span>
          <span className="cc-walk-direct">Direct</span>
          {spare != null && spare > 0 ? (
            <span className="cc-walk-spare">
              <span className="cc-walk-spare-dot" aria-hidden />
              {spare} min spare
            </span>
          ) : null}
        </div>
      ) : null}

      {spare != null && spare > 0 && leg.arriveBeforeLabel ? (
        <p className="cc-leg-spare">
          Arrive {formatClock(leg.arrival)} — {spare} min before {leg.arriveBeforeLabel}
        </p>
      ) : null}

      {leg.atRisk && leg.riskNote ? (
        <p className="cc-leg-risk">
          <span aria-hidden>!</span> {leg.riskNote}
        </p>
      ) : null}

      <div className="cc-walk-foot">
        <span className="cc-walk-proposed-strip">
          <span style={LEG_ICO_FLEX}><LegGlyph name="route" size={13} /></span>
          <span className="sb cc-walk-proposed">{lifecycle}</span>
        </span>
        {onCompare ? (
          <button type="button" className="cc-walk-compare cc-leg-compare-btn" onClick={() => onCompare(leg.id)}>
            Compare ways
            <LegGlyph name="arrowRight" size={11} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

const LEG_NAV_BTN: CSSProperties = { flex: "none", display: "inline-flex", alignItems: "center", gap: 5 };
