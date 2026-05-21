"use client";

import { useEffect, useRef, useState } from "react";
import { TransportIcon } from "@/components/icons";
import { LOCAL_MODES, TRANSITION_OPTIONS, fmtDur } from "./helpers";
import type {
  Anchor,
  BriefBooking,
  BriefTransition,
  LocalMode,
  TransitionMode,
} from "./types";
import type {
  ModeCandidate,
  Resolution,
  ScoredCandidate,
} from "@/lib/scoring/types";

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
  // Optional label for the from-anchor when it isn't a real anchor —
  // e.g. the implicit "home" leg before the first anchor.
  fromVirtualLabel,
  // Per-mode duration hints. When provided, each mode pill in the
  // popover renders a tiny "12m" / "—" tail. Callers (the editor)
  // wire this via the useRoutePreviews hook; the brief leaves it
  // undefined so no hints appear.
  modePreviews,
  // Fires when the popover opens, so the consumer can prefetch
  // previews for any modes it hasn't seen yet. Optional — without
  // it the popover stays silent (which is fine for the brief).
  onOpenChange,
  // Scoring engine output. When provided, the chip face shows the
  // resolved mode + duration + distance + alternative pills; the
  // popover shows scored candidates with explanations. When absent,
  // we fall back to the original 'Khonsera picks the mode' chip and
  // the simple mode-pill picker — that's what the brief still uses.
  resolution,
  // Override callbacks for the picker. onSetOverride fires when the
  // user picks a non-recommended mode; onClearOverride fires when
  // they tap 'Reset to recommended'. Editor wires these to
  // setTransitionOverride; brief leaves them undefined.
  onSetOverride,
  onClearOverride,
}: {
  from: Anchor | null;
  to: Anchor;
  transition: BriefTransition;
  onChange: (patch: Partial<BriefTransition>) => void;
  fromVirtualLabel?: string;
  modePreviews?: ModePreviewMap;
  onOpenChange?: (open: boolean) => void;
  resolution?: Resolution;
  onSetOverride?: (mode: ModeCandidate) => void;
  onClearOverride?: () => void;
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

  // Chip-face rendering pulls from `resolution` when the caller
  // provides it (the editor); otherwise falls back to the legacy
  // 'Khonsera picks the mode' / 'via X' rendering (the brief).
  const useResolved = resolution != null && !transition.booked;
  const winner = useResolved ? resolution!.winner : null;
  const resolvedMode = winner?.input.mode ?? null;
  const isOverride = useResolved && resolution!.state === "resolved_override";

  // Effective chip mode: the resolved winner if we have one,
  // otherwise the transition's stored mode (legacy behaviour).
  const effectiveModeForChip: TransitionMode | null = resolvedMode
    ?? (transition.mode === "auto" ? null : transition.mode);
  const opt = TRANSITION_OPTIONS.find(
    (o) => o.value === (effectiveModeForChip ?? transition.mode),
  );
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
          isAuto && !useResolved
            ? "transition-chip transition-chip-auto"
            : "transition-chip"
        }
        onClick={() => setOpenWithSignal(!open)}
        data-active={open}
        title={
          fromVirtualLabel
            ? `Travel from ${fromVirtualLabel}`
            : "Set the travel mode or add a booked ticket"
        }
      >
        {useResolved ? (
          <ResolvedChipFace resolution={resolution!} isOverride={isOverride} />
        ) : (
          <>
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
          </>
        )}
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

      {/* Alternative-mode pills below the chip — only when resolved
          and we actually have alternatives (not for single_candidate
          or override states). */}
      {useResolved &&
      (resolution!.state === "resolved" ||
        resolution!.state === "resolved_override") &&
      resolution!.ranked.length > 1 ? (
        <div className="transition-alts" role="list">
          {resolution!.ranked.slice(1).map((alt) => (
            <button
              key={alt.mode}
              type="button"
              role="listitem"
              className="transition-alt"
              onClick={() => onSetOverride?.(alt.mode)}
              title={alt.explanation}
            >
              {alt.input.mode === "walk"
                ? "Walk"
                : alt.input.mode === "drive"
                  ? "Drive"
                  : "Taxi"}{" "}
              {altDeltaLabel(alt, winner!)}
            </button>
          ))}
        </div>
      ) : null}

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

          {useResolved ? (
            <ScoredPicker
              resolution={resolution!}
              isOverride={isOverride}
              onSetOverride={onSetOverride}
              onClearOverride={onClearOverride}
            />
          ) : (
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
                    o.value === "auto" || preview == null
                      ? null
                      : preview === "pending"
                        ? "…"
                        : preview.durationMinutes != null
                          ? `${preview.durationMinutes}m`
                          : null;
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
                      {hint ? (
                        <span
                          className="mode-pill-hint"
                          aria-label={`${hint} estimated`}
                        >
                          {hint}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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

// ─────────────────────────────────────────────────────────────────────
// Resolved chip face — the redesign per the scoring spec. Replaces
// the legacy 'Khonsera picks the mode' text with the actual picked
// mode + duration + distance, plus a small 'user-set' dot when an
// override is active. Other states (resolving, no_data,
// single_candidate) fall back to softer copy.
// ─────────────────────────────────────────────────────────────────────
function ResolvedChipFace({
  resolution,
  isOverride,
}: {
  resolution: Resolution;
  isOverride: boolean;
}) {
  if (resolution.state === "resolving") {
    return (
      <>
        <span className="transition-chip-spinner" aria-hidden />
        <span>Choosing best mode…</span>
      </>
    );
  }
  if (
    resolution.state === "no_data" ||
    resolution.state === "no_survivors"
  ) {
    return (
      <>
        <TransportIcon.auto size={14} />
        <span>Mode · — · —</span>
      </>
    );
  }
  const w = resolution.winner;
  if (!w) {
    return (
      <>
        <TransportIcon.auto size={14} />
        <span>Mode · — · —</span>
      </>
    );
  }
  const opt = TRANSITION_OPTIONS.find((o) => o.value === w.input.mode);
  const ChipIcon = opt ? TransportIcon[opt.icon] : TransportIcon.auto;
  const mins = w.input.durationSeconds
    ? Math.round(w.input.durationSeconds / 60)
    : null;
  const miles = w.input.distanceMeters
    ? w.input.distanceMeters / 1609.344
    : null;
  const meta = [
    mins != null ? `${mins} min` : null,
    miles != null ? `${miles.toFixed(1)} mi` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <>
      <ChipIcon size={14} />
      <span className={isOverride ? "transition-chip-override" : undefined}>
        {opt?.label ?? "Mode"}
        {meta ? ` · ${meta}` : ""}
        {isOverride ? <span className="transition-chip-userdot" aria-hidden /> : null}
      </span>
    </>
  );
}

// "+2 min" / "+17 min" delta against the winner. Used on the
// alternative pills under the chip.
function altDeltaLabel(alt: ScoredCandidate, winner: ScoredCandidate): string {
  const altMins = alt.input.durationSeconds
    ? Math.round(alt.input.durationSeconds / 60)
    : null;
  const winMins = winner.input.durationSeconds
    ? Math.round(winner.input.durationSeconds / 60)
    : null;
  if (altMins == null || winMins == null) return "";
  const delta = altMins - winMins;
  if (delta === 0) return "(same time)";
  if (delta > 0) return `+${delta} min`;
  return `${delta} min`;
}

// ─────────────────────────────────────────────────────────────────────
// ScoredPicker — the popover's mode-picker section when the editor
// has run scoring on the leg. Each ranked candidate gets a row:
// icon · label · duration · distance (· cost for taxi only) ·
// one-line explanation. The top row has a "Recommended" badge.
// Selecting non-recommended sets user_mode_override; selecting the
// current winner clears it (or no-ops if no override is active).
// Filtered candidates collapse into a 'Why isn't X here?' disclosure.
// ─────────────────────────────────────────────────────────────────────
function ScoredPicker({
  resolution,
  isOverride,
  onSetOverride,
  onClearOverride,
}: {
  resolution: Resolution;
  isOverride: boolean;
  onSetOverride?: (mode: ModeCandidate) => void;
  onClearOverride?: () => void;
}) {
  // Resolving / no_data: nothing to choose between yet.
  if (
    resolution.state === "resolving" ||
    resolution.state === "no_data" ||
    resolution.state === "no_survivors"
  ) {
    return (
      <div className="transition-pop-section">
        <span className="uc">Mode</span>
        <p className="brief-helper" style={{ margin: "6px 0 0" }}>
          {resolution.state === "resolving"
            ? "Working out travel times…"
            : resolution.state === "no_data"
              ? "Couldn't fetch travel data for this leg. Try again later or set a mode manually."
              : "No mode arrives on time given the surrounding times."}
        </p>
      </div>
    );
  }

  const recommended = resolution.ranked[0];

  return (
    <div className="transition-pop-section">
      <span className="uc">Mode</span>
      <div className="scored-picker">
        {resolution.ranked.map((c, i) => (
          <ScoredPickerRow
            key={c.mode}
            candidate={c}
            isRecommended={i === 0}
            isSelected={
              isOverride
                ? c === resolution.winner
                : i === 0
            }
            onClick={() => {
              if (c === recommended) {
                onClearOverride?.();
              } else {
                onSetOverride?.(c.mode);
              }
            }}
          />
        ))}
      </div>
      {isOverride ? (
        <button
          type="button"
          className="scored-picker-reset"
          onClick={() => onClearOverride?.()}
        >
          Reset to recommended
        </button>
      ) : null}
      {resolution.filtered.length > 0 ? (
        <details className="scored-picker-filtered">
          <summary>
            Why isn't {resolution.filtered.length === 1 ? "it" : "X"} here?
          </summary>
          <ul>
            {resolution.filtered.map((f) => (
              <li key={f.input.mode}>
                <span className="scored-picker-filtered-mode">
                  {f.input.mode === "walk"
                    ? "Walk"
                    : f.input.mode === "drive"
                      ? "Drive"
                      : "Taxi"}
                </span>{" "}
                — {filterReasonCopy(f.filterReason)}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function ScoredPickerRow({
  candidate,
  isRecommended,
  isSelected,
  onClick,
}: {
  candidate: ScoredCandidate;
  isRecommended: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  const opt = TRANSITION_OPTIONS.find((o) => o.value === candidate.input.mode);
  const RowIcon = opt ? TransportIcon[opt.icon] : TransportIcon.auto;
  const mins = candidate.input.durationSeconds
    ? Math.round(candidate.input.durationSeconds / 60)
    : null;
  const miles = candidate.input.distanceMeters
    ? candidate.input.distanceMeters / 1609.344
    : null;
  const cost =
    candidate.input.mode === "taxi" && candidate.input.costEstimatePence != null
      ? `£${(candidate.input.costEstimatePence / 100).toFixed(2)}`
      : null;
  return (
    <button
      type="button"
      className="scored-picker-row"
      data-selected={isSelected}
      onClick={onClick}
    >
      <span className="scored-picker-row-head">
        <RowIcon size={13} />
        <span className="scored-picker-row-mode">{opt?.label}</span>
        {isRecommended ? (
          <span className="scored-picker-row-rec">Recommended</span>
        ) : null}
      </span>
      <span className="scored-picker-row-meta">
        {mins != null ? `${mins} min` : "—"}
        {miles != null ? ` · ${miles.toFixed(1)} mi` : ""}
        {cost ? ` · ${cost}` : ""}
      </span>
      <span className="scored-picker-row-why">{candidate.explanation}</span>
    </button>
  );
}

function filterReasonCopy(reason: string): string {
  switch (reason) {
    case "walk_exceeds_threshold":
      return "Walk exceeds your usual length.";
    case "would_be_late":
      return "Would arrive after your next anchor.";
    case "no_data":
      return "No travel-time data available.";
    default:
      return "Unavailable.";
  }
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
