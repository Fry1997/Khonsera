"use client";

import { useEffect, useRef, useState } from "react";
import { TransportIcon } from "@/components/icons";
import {
  LOCAL_MODES,
  TRANSITION_OPTIONS,
  anchorEndDate,
  anchorStartDate,
  fmtDur,
} from "./helpers";
import type {
  Anchor,
  BriefTransition,
  LocalMode,
  TransitionMode,
} from "./types";
import { checkLegFeasibility, type Feasibility } from "@/lib/feasibility/check";

// Per-mode duration hints — populated by the editor via the
// useRoutePreviews hook. Each entry is either a resolved preview
// (minutes + miles) or "pending" while a call is in flight.
export type ModePreview = {
  durationMinutes: number | null;
  distanceMiles: number | null;
};
export type ModePreviewMap = Partial<
  Record<TransitionMode, ModePreview | "pending">
>;

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
  fromVirtualLabel,
  modePreviews,
  onOpenChange,
}: {
  from: Anchor | null;
  to: Anchor;
  transition: BriefTransition;
  onChange: (patch: Partial<BriefTransition>) => void;
  fromVirtualLabel?: string;
  modePreviews?: ModePreviewMap;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Surface popover open-state to the consumer so it can prefetch
  // route previews on first open. Wrapped here so the caller doesn't
  // have to hand-roll the click-outside handler.
  const setOpenWithSignal = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpenWithSignal(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
    // setOpenWithSignal is stable enough — the consumer's
    // onOpenChange identity isn't worth a dependency array dance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const opt = TRANSITION_OPTIONS.find((o) => o.value === transition.mode)
    ?? TRANSITION_OPTIONS[0];
  const Icon = TransportIcon[opt.icon];
  const isUnset = false;
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
    !isUnset &&
    (transition.localBefore !== "auto" || transition.localAfter !== "auto");

  return (
    <div ref={ref} className="transition-row">
      <div className="transition-line" aria-hidden />
      <button
        type="button"
        className={
          isUnset ? "transition-chip transition-chip-auto" : "transition-chip"
        }
        onClick={() => setOpenWithSignal(!open)}
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
            : isUnset
              ? "Set a travel mode"
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
                const preview = modePreviews?.[o.value];
                const hint =
                  preview == null
                    ? null
                    : preview === "pending"
                      ? "…"
                      : preview.durationMinutes != null
                        ? `${preview.durationMinutes}m`
                        : null;
                const feas = feasibilityForMode(from, to, preview);
                const feasState =
                  feas.state === "tight" || feas.state === "late"
                    ? feas.state
                    : null;
                return (
                  <button
                    key={o.value}
                    type="button"
                    className="pill brief-pill"
                    data-active={o.value === transition.mode}
                    data-feasibility={feasState ?? undefined}
                    onClick={() => onChange({ mode: o.value })}
                    title={
                      feas.state === "late" || feas.state === "tight"
                        ? `${o.label} — ${feas.message}`
                        : `Travel by ${o.label.toLowerCase()}`
                    }
                  >
                    <OIcon size={13} />
                    {o.label}
                    {hint ? (
                      <span
                        className="mode-pill-hint"
                        aria-label={`${hint} estimated`}
                      >
                        {hint}
                      </span>
                    ) : null}
                    {feasState ? (
                      <span
                        className="brief-pill-feas"
                        data-state={feasState}
                        aria-hidden
                      />
                    ) : null}
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

          <div className="transition-pop-foot">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setOpenWithSignal(false)}
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

// Per-mode feasibility for a leg's mode picker. Resolves the
// preview's duration (when not pending / null), the anchor times on
// each end, and asks the shared feasibility helper whether arrival
// is on time. Unknown is the quiet default — pending previews and
// missing anchor times both fall here so the picker doesn't flash
// flags it can't justify.
function feasibilityForMode(
  from: Anchor | null,
  to: Anchor,
  preview:
    | { durationMinutes: number | null; distanceMiles: number | null }
    | "pending"
    | null
    | undefined,
): Feasibility {
  if (!from || !preview || preview === "pending") {
    return { state: "unknown" };
  }
  return checkLegFeasibility({
    fromEnd: anchorEndDate(from),
    toStart: anchorStartDate(to),
    travelMinutes: preview.durationMinutes,
  });
}

