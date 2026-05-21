"use client";

import { useEffect, useRef, useState } from "react";
import { TransportIcon } from "@/components/icons";
import { LOCAL_MODES, TRANSITION_OPTIONS } from "./helpers";
import type {
  Anchor,
  BriefBooking,
  BriefTransition,
  LocalMode,
  TransitionMode,
} from "./types";

// ─────────────────────────────────────────────────────────────────────
// TransitionRow — the slim "via X" element between two anchors. Click
// the mode chip to switch mode; "Pre-booked" toggle expands a small
// one-segment ticket form.
// ─────────────────────────────────────────────────────────────────────
export function TransitionRow({
  from,
  to,
  transition,
  onChange,
  // Optional label for the from-anchor when it isn't a real anchor —
  // e.g. the implicit "home" leg before the first anchor.
  fromVirtualLabel,
}: {
  from: Anchor | null;
  to: Anchor;
  transition: BriefTransition;
  onChange: (patch: Partial<BriefTransition>) => void;
  fromVirtualLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const opt = TRANSITION_OPTIONS.find((o) => o.value === transition.mode);
  const Icon = opt ? TransportIcon[opt.icon] : TransportIcon.auto;
  const isAuto = transition.mode === "auto" && !transition.booked;
  const stationBased = opt?.stationBased ?? false;
  const beforeOpt = LOCAL_MODES.find(
    (m) => m.value === transition.localBefore,
  );
  const afterOpt = LOCAL_MODES.find(
    (m) => m.value === transition.localAfter,
  );
  const BeforeIcon = beforeOpt
    ? TransportIcon[beforeOpt.icon]
    : TransportIcon.auto;
  const AfterIcon = afterOpt
    ? TransportIcon[afterOpt.icon]
    : TransportIcon.auto;
  const symmetric = transition.localBefore === transition.localAfter;
  const showLocalHint =
    stationBased &&
    !isAuto &&
    (transition.localBefore !== "auto" || transition.localAfter !== "auto");

  return (
    <div ref={ref} className="transition-row">
      <div className="transition-line" aria-hidden />
      <button
        type="button"
        className={
          isAuto ? "transition-chip transition-chip-auto" : "transition-chip"
        }
        onClick={() => setOpen((v) => !v)}
        data-active={open}
        title={
          fromVirtualLabel
            ? `Travel from ${fromVirtualLabel}`
            : "Set the travel mode or add a booked ticket"
        }
      >
        <Icon size={14} />
        <span>
          {transition.booked
            ? `${opt?.label ?? "Booked"} · ${
                transition.booking.serviceNumber || "ticket"
              }`
            : isAuto
              ? "Khonsera picks the mode"
              : `via ${opt?.label}`}
        </span>
        {showLocalHint ? (
          <span className="transition-local-hint">
            <BeforeIcon size={11} />
            {symmetric ? (
              <span>{beforeOpt?.label.toLowerCase()}</span>
            ) : (
              <>
                <span aria-hidden style={{ opacity: 0.55 }}>›</span>
                <AfterIcon size={11} />
              </>
            )}
          </span>
        ) : null}
        {transition.booked ? (
          <span className="pill pill-gold transition-booked-badge">
            <span className="dot" />
            booked
          </span>
        ) : null}
      </button>
      <div className="transition-line" aria-hidden />

      {open ? (
        <div className="transition-pop">
          {fromVirtualLabel ? (
            <p
              className="serif-i"
              style={{
                margin: 0,
                fontSize: 13.5,
                color: "var(--ink-dim)",
                lineHeight: 1.4,
              }}
            >
              From <em style={{ color: "var(--gold-2)" }}>{fromVirtualLabel}</em>{" "}
              to the first anchor.
            </p>
          ) : null}

          <div className="transition-pop-section">
            <span className="uc">Mode</span>
            <div
              className="brief-pill-row"
              style={{ marginTop: 6, marginBottom: 4 }}
            >
              {TRANSITION_OPTIONS.map((o) => {
                const OIcon = TransportIcon[o.icon];
                return (
                  <button
                    key={o.value}
                    type="button"
                    className="pill brief-pill"
                    data-active={o.value === transition.mode}
                    onClick={() => onChange({ mode: o.value })}
                    title={
                      o.value === "auto"
                        ? "Let Khonsera pick once it knows distance"
                        : `Travel by ${o.label.toLowerCase()}`
                    }
                  >
                    <OIcon size={13} />
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>

          {stationBased ? (
            <div className="transition-pop-section">
              <span className="uc">Local connections</span>
              <p
                className="brief-helper"
                style={{ margin: "4px 0 8px", fontSize: 12 }}
              >
                Two legs — to the {opt?.label.toLowerCase()} and from it.
                Pick them separately if you'll drive to your local station
                but walk from the other end.
              </p>

              <div className="local-leg-grid">
                <LocalLegPicker
                  label={`To the ${opt?.label.toLowerCase() ?? "station"}`}
                  helper={
                    fromVirtualLabel
                      ? `From ${fromVirtualLabel}`
                      : from?.place?.label
                        ? `From ${from.place.label}`
                        : "From the previous stop"
                  }
                  value={transition.localBefore}
                  onPick={(v) => onChange({ localBefore: v })}
                />
                <LocalLegPicker
                  label={`From the ${opt?.label.toLowerCase() ?? "station"}`}
                  helper={
                    to.place?.label
                      ? `To ${to.place.label}`
                      : "To the next stop"
                  }
                  value={transition.localAfter}
                  onPick={(v) => onChange({ localAfter: v })}
                />
              </div>

              {transition.localBefore !== transition.localAfter &&
              (transition.localBefore !== "auto" ||
                transition.localAfter !== "auto") ? (
                <p
                  className="brief-helper"
                  style={{
                    margin: "8px 0 0",
                    fontSize: 11.5,
                    color: "var(--gold-2)",
                  }}
                >
                  Asymmetric — Khonsera will plan each leg independently.
                </p>
              ) : null}
            </div>
          ) : null}

          <label className="transition-booked-toggle">
            <input
              type="checkbox"
              checked={transition.booked}
              onChange={(e) =>
                onChange({
                  booked: e.target.checked,
                  // Default ticket mode to non-auto when toggling on.
                  ...(e.target.checked && transition.mode === "auto"
                    ? { mode: "train" as TransitionMode }
                    : {}),
                })
              }
            />
            <span>This is already booked</span>
            <span className="brief-helper" style={{ margin: 0, fontSize: 12 }}>
              Adds the ticket to Bookings and locks the editor onto these times.
            </span>
          </label>

          {transition.booked ? (
            <BookedFields
              fromAnchor={from}
              toAnchor={to}
              booking={transition.booking}
              onChange={(patch) =>
                onChange({
                  booking: { ...transition.booking, ...patch },
                })
              }
            />
          ) : null}

          <div className="transition-pop-foot">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setOpen(false)}
            >
              Done
            </button>
            {transition.mode !== "auto" || transition.booked ? (
              <button
                type="button"
                className="transition-pop-clear"
                onClick={() => {
                  onChange({
                    mode: "auto",
                    localBefore: "auto",
                    localAfter: "auto",
                    booked: false,
                  });
                }}
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LocalLegPicker({
  label,
  helper,
  value,
  onPick,
}: {
  label: string;
  helper: string;
  value: LocalMode;
  onPick: (v: LocalMode) => void;
}) {
  return (
    <div className="local-leg">
      <div className="local-leg-head">
        <span className="uc">{label}</span>
        <span className="local-leg-helper">{helper}</span>
      </div>
      <div className="brief-pill-row">
        {LOCAL_MODES.map((m) => {
          const MIcon = TransportIcon[m.icon];
          return (
            <button
              key={m.value}
              type="button"
              className="pill brief-pill"
              data-active={m.value === value}
              onClick={() => onPick(m.value)}
            >
              <MIcon size={12} />
              {m.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BookedFields({
  fromAnchor,
  toAnchor,
  booking,
  onChange,
}: {
  fromAnchor: Anchor | null;
  toAnchor: Anchor;
  booking: BriefBooking;
  onChange: (patch: Partial<BriefBooking>) => void;
}) {
  // Sensible defaults so the user only types what they actually know.
  const departDefault =
    fromAnchor && fromAnchor.timingMode === "leave_by"
      ? fromAnchor.time
      : "";
  const arriveDefault =
    toAnchor.timingMode === "arrive_by" ? toAnchor.time : "";

  return (
    <div className="transition-booked-fields">
      <div className="brief-when-row">
        <label className="brief-field">
          <span className="uc">Depart</span>
          <input
            type="time"
            className="field"
            value={booking.departTime || departDefault}
            onChange={(e) => onChange({ departTime: e.target.value })}
          />
        </label>
        <label className="brief-field">
          <span className="uc">Arrive</span>
          <input
            type="time"
            className="field"
            value={booking.arriveTime || arriveDefault}
            onChange={(e) => onChange({ arriveTime: e.target.value })}
          />
        </label>
      </div>
      <div className="brief-when-row">
        <label className="brief-field">
          <span className="uc">Service no.</span>
          <input
            type="text"
            className="field"
            placeholder="9M14 / BA245 / Bus 24"
            value={booking.serviceNumber}
            onChange={(e) => onChange({ serviceNumber: e.target.value })}
          />
        </label>
        <label className="brief-field">
          <span className="uc">Booking ref.</span>
          <input
            type="text"
            className="field"
            placeholder="ABC123"
            value={booking.reference}
            onChange={(e) => onChange({ reference: e.target.value })}
          />
        </label>
      </div>
      <div className="brief-when-row">
        <label className="brief-field">
          <span className="uc">Seat / row</span>
          <input
            type="text"
            className="field"
            placeholder="Coach E, Seat 32"
            value={booking.seat}
            onChange={(e) => onChange({ seat: e.target.value })}
          />
        </label>
        <label className="brief-field">
          <span className="uc">Price (£)</span>
          <input
            type="number"
            min={0}
            step="0.01"
            className="field"
            placeholder="148.50"
            value={booking.price}
            onChange={(e) => onChange({ price: e.target.value })}
          />
        </label>
      </div>
    </div>
  );
}
