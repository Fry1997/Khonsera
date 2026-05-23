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
  BriefBooking,
  BriefTransition,
  LocalMode,
  TransitionMode,
} from "./types";
import { checkLegFeasibility, type Feasibility } from "@/lib/feasibility/check";
import {
  TransportBookingFields,
  emptyTransportBooking,
  MODE_LABELS as TB_MODE_LABELS,
  ModeIcon as TBModeIcon,
  type TransportBookingValue,
} from "@/components/transport-booking-fields";
import type {
  PlacePickerCustomer,
  PlacePickerCustomerSite,
  PlacePickerLocation,
} from "@/components/place-picker";

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
  customers,
  customerSites,
  locations,
}: {
  from: Anchor | null;
  to: Anchor;
  transition: BriefTransition;
  onChange: (patch: Partial<BriefTransition>) => void;
  fromVirtualLabel?: string;
  modePreviews?: ModePreviewMap;
  onOpenChange?: (open: boolean) => void;
  customers?: PlacePickerCustomer[];
  customerSites?: PlacePickerCustomerSite[];
  locations?: PlacePickerLocation[];
}) {
  const [open, setOpen] = useState(false);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
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

  // Chip-face rendering — the executive picks the mode. When the
  // transition mode is still the "auto" sentinel (the empty default),
  // the chip invites them to set one rather than pretending Khonsera
  // will figure it out.
  const opt = TRANSITION_OPTIONS.find((o) => o.value === transition.mode);
  const Icon = opt ? TransportIcon[opt.icon] : TransportIcon.auto;
  const isUnset = transition.mode === "auto" && !transition.booked;
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
          {transition.transportBooking
            ? `${TB_MODE_LABELS[transition.transportBooking.mode]} · ${
                transition.transportBooking.segments[0]?.service_number || "booked"
              }`
            : transition.booked
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
        {transition.booked || transition.transportBooking ? (
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

          {customers && customerSites && locations ? (
            <>
              {transition.transportBooking ? (
                <div className="transition-pop-section">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span className="uc">
                      Booking · {TB_MODE_LABELS[transition.transportBooking.mode]}
                    </span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        className="text-xs hover:underline"
                        style={{ color: "var(--ink-dim)" }}
                        onClick={() => setBookingModalOpen(true)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-xs hover:underline"
                        style={{ color: "var(--rust)" }}
                        onClick={() =>
                          onChange({ transportBooking: null, booked: false })
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <p className="brief-helper" style={{ margin: "4px 0 0" }}>
                    {transition.transportBooking.segments[0]?.from_location_name
                      ? `${transition.transportBooking.segments[0].from_location_name} → ${transition.transportBooking.segments[0].to_location_name}`
                      : transition.transportBooking.arrival?.label ?? "Configured"}
                    {transition.transportBooking.segments[0]?.service_number
                      ? ` · ${transition.transportBooking.segments[0].service_number}`
                      : ""}
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setBookingModalOpen(true)}
                  style={{ alignSelf: "flex-start" }}
                >
                  + Add a booked ticket
                </button>
              )}
            </>
          ) : (
            <>
              <label className="transition-booked-toggle">
                <input
                  type="checkbox"
                  checked={transition.booked}
                  onChange={(e) =>
                    onChange({
                      booked: e.target.checked,
                      ...(e.target.checked && transition.mode === "auto"
                        ? { mode: "train" as TransitionMode }
                        : {}),
                    })
                  }
                />
                <span>This is already booked</span>
                <span className="brief-helper" style={{ margin: 0, fontSize: 12 }}>
                  Adds the ticket to Bookings and locks the editor onto these
                  times.
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
            </>
          )}

          <div className="transition-pop-foot">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setOpenWithSignal(false)}
            >
              Done
            </button>
            {transition.mode !== "auto" || transition.booked || transition.transportBooking ? (
              <button
                type="button"
                className="transition-pop-clear"
                onClick={() => {
                  onChange({
                    mode: "auto",
                    localBefore: "auto",
                    localAfter: "auto",
                    booked: false,
                    transportBooking: null,
                  });
                }}
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {bookingModalOpen && customers && customerSites && locations ? (
        <TransportBookingModal
          initial={transition.transportBooking}
          fromLabel={
            fromVirtualLabel ?? from?.place?.label ?? "Previous stop"
          }
          customers={customers}
          customerSites={customerSites}
          locations={locations}
          onConfirm={(tb) => {
            onChange({
              transportBooking: tb,
              booked: true,
              mode: tb.mode === "drive" ? "drive" : tb.mode as TransitionMode,
            });
            setBookingModalOpen(false);
          }}
          onCancel={() => setBookingModalOpen(false)}
        />
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

function TransportBookingModal({
  initial,
  fromLabel,
  customers,
  customerSites,
  locations,
  onConfirm,
  onCancel,
}: {
  initial: TransportBookingValue | null;
  fromLabel: string;
  customers: PlacePickerCustomer[];
  customerSites: PlacePickerCustomerSite[];
  locations: PlacePickerLocation[];
  onConfirm: (value: TransportBookingValue) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState<TransportBookingValue>(
    initial ?? emptyTransportBooking("train"),
  );

  return (
    <div
      className="booking-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="booking-modal" role="dialog">
        <header style={{ marginBottom: 12 }}>
          <p className="uc">Booked ticket · From {fromLabel}</p>
          <h3 className="h2" style={{ marginTop: 4 }}>
            {TB_MODE_LABELS[value.mode]} ticket
          </h3>
        </header>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <TransportBookingFields
            value={value}
            onChange={setValue}
            fromLabel={fromLabel}
            customers={customers}
            customerSites={customerSites}
            locations={locations}
            idPrefix="brief-tb"
          />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button
            type="button"
            className="btn btn-gold btn-sm"
            onClick={() => onConfirm(value)}
          >
            Confirm
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
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
