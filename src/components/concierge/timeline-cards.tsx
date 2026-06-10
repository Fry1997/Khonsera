"use client";

import type {
  AnchorVM,
  AnchorVariable,
  AnchorVariableSlot,
  GapVM,
  IntentionVM,
  LegVM,
} from "./types";
import { formatClock, formatMoney } from "./types";

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
}: {
  anchor: AnchorVM;
  onSelect?: (id: string) => void;
  onEditVariable?: (id: string, slot: AnchorVariableSlot) => void;
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
      </div>
      <h3 className="cc-anchor-title">{anchor.title}</h3>
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

export function LegCard({ leg }: { leg: LegVM }) {
  const total = leg.notes ?? (leg.departure && leg.arrival
    ? `${formatClock(leg.departure)}–${formatClock(leg.arrival)}`
    : "Travel needed");
  return (
    <div className="cc-leg-card" data-state={LEG_STATE[leg.bookingStatus]}>
      <div className="cc-leg-head">
        <span className="cc-leg-total">{total} door-to-door</span>
        <span className="cc-leg-pattern">Direct</span>
      </div>
      <div className="cc-subseq">
        <span className="cc-subleg">{LEG_LABEL[leg.mode]}</span>
      </div>
      <div className="cc-leg-meta">
        <span className="cc-mono">
          {formatClock(leg.departure)} &rarr; {formatClock(leg.arrival)}
        </span>
        {leg.cost != null ? (
          <span className="cc-mono">{formatMoney(leg.cost, leg.currency)}</span>
        ) : null}
      </div>
      <p className="cc-leg-tap">Tap to compare &rarr;</p>
    </div>
  );
}
