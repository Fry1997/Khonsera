"use client";

import type { EntityStatus, RankedCandidate } from "./draft-model";

// An inline entity chip. Gold = bound to a real entity; grey = ambiguous or an
// unknown verbatim label. No emojis — a small leading dot carries the state.
export function EntityBadge({
  label,
  status,
  hint,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: {
  label: string;
  status: EntityStatus;
  hint?: string | null;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const bound = status === "bound";
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="entity-badge"
      data-status={status}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "2px 9px",
        borderRadius: 999,
        border: `1px solid ${bound ? "var(--gold)" : "var(--rule-2)"}`,
        background: bound ? "var(--gold-tint)" : "transparent",
        color: bound ? "var(--gold-2)" : "var(--ink-dim)",
        fontFamily: "var(--sans)",
        fontSize: 13.5,
        fontWeight: 500,
        cursor: onClick ? "pointer" : "default",
        lineHeight: 1.4,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: bound ? "var(--gold)" : "var(--rule-2)",
          flex: "0 0 auto",
        }}
      />
      {label}
      {hint ? <span style={{ color: "var(--ink-faint)", fontWeight: 400 }}>· {hint}</span> : null}
    </button>
  );
}

// The chooser shown when a place/station resolved to more than one candidate.
// Each row offers a concrete entity; the last row keeps the typed text as-is.
export function CandidateDropdown({
  candidates,
  rawText,
  onPick,
  onKeepAsTyped,
}: {
  candidates: RankedCandidate[];
  rawText: string;
  onPick: (candidate: RankedCandidate) => void;
  onKeepAsTyped: () => void;
}) {
  return (
    <div className="hub-picker-list" role="listbox" style={{ marginTop: 6 }}>
      {candidates.map((c) => (
        <button
          key={c.id}
          type="button"
          role="option"
          className="hub-picker-item"
          onClick={() => onPick(c)}
        >
          <span className="hub-picker-name">
            {c.name}
            {c.code ? <span style={{ color: "var(--ink-faint)" }}> · {c.code}</span> : null}
          </span>
          {c.distanceLabel ? <span className="hub-picker-meta">{c.distanceLabel}</span> : null}
        </button>
      ))}
      <button type="button" role="option" className="hub-picker-item" onClick={onKeepAsTyped}>
        <span className="hub-picker-name">Leave as “{rawText}”</span>
        <span className="hub-picker-meta">sort it later</span>
      </button>
    </div>
  );
}
