"use client";

import type { AnchorVM, GapVM, IntentionVM, LegVM } from "./types";
import { formatClock, formatMoney } from "./types";

// The four timeline primitives (handover §5). Anchors render SOLID; gaps render
// GHOSTED ("needs input"); intentions are soft/toggleable; legs are resolved
// movements. Placeholder visuals — Design restyles via tokens, not restructure.

const ANCHOR_LABEL: Record<AnchorVM["type"], string> = {
  appointment: "Appointment",
  reservation: "Reservation",
  accommodation_check_in: "Check-in",
  accommodation_check_out: "Check-out",
  transport_arrival: "Arrival",
  flight: "Flight",
  custom: "Anchor",
};

export function AnchorCard({
  anchor,
  onSelect,
}: {
  anchor: AnchorVM;
  onSelect?: (id: string) => void;
}) {
  const window = anchor.time
    ? anchor.time.to
      ? `${formatClock(anchor.time.from)}–${formatClock(anchor.time.to)}`
      : formatClock(anchor.time.from)
    : "Time t.b.c.";
  return (
    <article
      className="j-card p-4"
      onClick={onSelect ? () => onSelect(anchor.id) : undefined}
      style={onSelect ? { cursor: "pointer" } : undefined}
    >
      <header className="mb-1 flex items-baseline justify-between gap-3">
        <span className="uc">{ANCHOR_LABEL[anchor.type]}</span>
        <span className="mono small">{window}</span>
      </header>
      <h3 className="h3">{anchor.title}</h3>
      {anchor.place ? <p className="small">{anchor.place}</p> : null}
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
  const off = intention.state === "toggled_off";
  return (
    <article
      className="j-card-soft p-4"
      style={off ? { opacity: 0.55 } : undefined}
    >
      <header className="mb-1 flex items-baseline justify-between gap-3">
        <span className="uc">Intention</span>
        {intention.flexibility === "promoted_to_hard" ? (
          <span className="tag-ok">promoted</span>
        ) : (
          <span className="tag-tight">soft</span>
        )}
      </header>
      <p className="text-ink">{intention.description}</p>
      {intention.target ? (
        <p className="small mt-0.5">{intention.target}</p>
      ) : null}
      {intention.leaveBy ? (
        <p className="small mt-2">
          Leave by <span className="mono">{formatClock(intention.leaveBy)}</span>
        </p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => onToggle?.(intention.id)}
        >
          {off ? "Turn on" : "Turn off"}
        </button>
        {intention.flexibility === "soft" ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => onPromote?.(intention.id)}
          >
            Make it fixed
          </button>
        ) : null}
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
    <article
      className="rounded-card p-4"
      style={{
        border: "1px dashed var(--rule)",
        background: "transparent",
      }}
    >
      <header className="mb-1 flex items-baseline justify-between gap-3">
        <span className="uc" style={{ color: "var(--ink-soft)" }}>
          {gap.fromLabel && gap.toLabel
            ? `${gap.fromLabel} → ${gap.toLabel}`
            : "Gap"}
        </span>
        <span className="tag-tight">needs input</span>
      </header>
      <p className="small">{gap.prompt ?? GAP_PROMPT[gap.type]}</p>
      <button
        type="button"
        className="btn btn-gold btn-sm mt-3"
        onClick={() => onResolve?.(gap.id)}
      >
        Resolve
      </button>
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

const BOOKING_TAG: Record<LegVM["bookingStatus"], { cls: string; label: string }> = {
  synced: { cls: "tag-ok", label: "synced" },
  booked_in_app: { cls: "tag-ok", label: "booked" },
  manual: { cls: "tag-tight", label: "manual" },
  unbooked_stub: { cls: "tag-no", label: "not booked" },
};

export function LegCard({ leg }: { leg: LegVM }) {
  const tag = BOOKING_TAG[leg.bookingStatus];
  return (
    <article className="j-card p-4">
      <header className="mb-1 flex items-baseline justify-between gap-3">
        <span className="uc">{LEG_LABEL[leg.mode]}</span>
        <span className={tag.cls}>{tag.label}</span>
      </header>
      <p className="text-ink">
        {leg.fromLabel} → {leg.toLabel}
      </p>
      <div className="mt-2 flex flex-wrap items-baseline gap-3">
        <span className="mono small">
          {formatClock(leg.departure)} → {formatClock(leg.arrival)}
        </span>
        {leg.cost != null ? (
          <span className="mono small">
            {formatMoney(leg.cost, leg.currency)}
          </span>
        ) : null}
      </div>
      {leg.notes ? <p className="small mt-2">{leg.notes}</p> : null}
    </article>
  );
}
