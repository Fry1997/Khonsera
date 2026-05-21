"use client";

import { useEffect, useRef, useState } from "react";
import {
  PlacePicker,
  type PlacePickerCustomer,
  type PlacePickerCustomerSite,
  type PlacePickerLocation,
} from "@/components/place-picker";
import { TransportIcon } from "@/components/icons";
import type { LocationType } from "@/lib/types/domain";
import { updateLocationType } from "@/lib/actions/locations";
import { DurationRow } from "./duration-row";
import { TimingModeRow } from "./timing-mode-row";
import {
  APPT_DURATIONS,
  KIND_OPTIONS,
  ROLES,
  TIME_PRESETS,
  effectiveKind,
  effectiveRole,
  effectiveTimingMode,
  fmtDur,
  fmtShortDate,
  labelForKind,
  labelForRole,
  nextDay,
  samePlace,
} from "./helpers";
import type {
  Anchor,
  AnchorKind,
  AnchorRole,
  TimingMode,
} from "./types";

// Local re-implementation of `inferredKind` / `inferredRoleFor` for the
// KindBadge — these aren't exported from helpers because they're only
// useful in the context of comparing override vs suggestion. Keeping
// them next to KindBadge avoids polluting the public helpers API.
function inferredKind(a: Anchor): AnchorKind {
  if (!a.place) return "appointment";
  if (a.place.kind !== "location") return "appointment";
  switch (a.place.location_type) {
    case "hotel":
      return "stay";
    case "station":
      return "station";
    default:
      return "appointment";
  }
}

function inferredRoleFor(a: Anchor, earlier: Anchor[]): AnchorRole {
  const k = effectiveKind(a);
  if (k === "appointment") return null;
  if (k === "stay") {
    const priorStay = earlier.find(
      (other) =>
        other.place &&
        a.place &&
        samePlace(other.place, a.place) &&
        effectiveKind(other) === "stay" &&
        (other.roleOverride ?? "check_in") === "check_in",
    );
    return priorStay ? "return_to_room" : "check_in";
  }
  if (k === "meal") {
    const hour = parseInt(a.time.split(":")[0] ?? "12", 10);
    if (hour < 11) return "breakfast";
    if (hour < 16) return "lunch";
    if (hour < 21) return "dinner";
    return "drinks";
  }
  if (k === "event") return "session";
  if (k === "station") return "train";
  return null;
}

export function AnchorCard({
  anchor,
  earlier,
  first,
  canRemove,
  customers,
  customerSites,
  locations,
  datePresets,
  timezone,
  onChange,
  onRemove,
  // Editor surfaces render anchors collapsed by default and expand
  // them inline when the user clicks Edit. The brief always passes
  // "expanded" and omits onModeChange — that hides the Edit/Done
  // buttons and locks the card open.
  mode = "expanded",
  onModeChange,
}: {
  anchor: Anchor;
  earlier: Anchor[];
  first: boolean;
  canRemove: boolean;
  customers: PlacePickerCustomer[];
  customerSites: PlacePickerCustomerSite[];
  locations: PlacePickerLocation[];
  datePresets: Array<{ label: string; value: string }>;
  // Used by the summary view to render the date/time tidy. Optional
  // because the brief doesn't need it for the expanded form fields.
  timezone?: string;
  onChange: (patch: Partial<Anchor>) => void;
  onRemove: () => void;
  mode?: "expanded" | "summary";
  onModeChange?: (next: "expanded" | "summary") => void;
}) {
  const kind = effectiveKind(anchor);
  const role = effectiveRole(anchor, earlier);
  const isStayCheckIn = kind === "stay" && role !== "return_to_room";
  const isStayReturn = kind === "stay" && role === "return_to_room";

  if (mode === "summary") {
    return (
      <SummaryAnchorCard
        anchor={anchor}
        kind={kind}
        role={role}
        first={first}
        canRemove={canRemove}
        timezone={timezone ?? "UTC"}
        onEdit={onModeChange ? () => onModeChange("expanded") : undefined}
        onRemove={onRemove}
      />
    );
  }

  return (
    <section className={first ? "brief-card brief-card-hero" : "brief-card"}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          <KindBadge
            kind={kind}
            role={role}
            anchor={anchor}
            earlier={earlier}
            onChange={onChange}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {onModeChange ? (
            <button
              type="button"
              onClick={() => onModeChange("summary")}
              className="anchor-card-toggle"
            >
              Done
            </button>
          ) : null}
          {canRemove ? (
            <button
              type="button"
              onClick={onRemove}
              style={{ fontSize: 11.5, color: "var(--rust)" }}
            >
              Remove
            </button>
          ) : null}
        </div>
      </header>

      <PlacePicker
        customers={customers}
        customerSites={customerSites}
        locations={locations}
        value={anchor.place}
        onChange={(place) => {
          onChange({
            place,
            // Clear both overrides so inference can re-run from the new
            // place's type.
            kindOverride: null,
            roleOverride: null,
          });
        }}
        defaultNewType={
          kind === "stay" ? "hotel" : kind === "station" ? "station" : "other"
        }
        placeholder="Search anywhere — your places pin to the top"
      />

      {/* Time fields — adapt to the effective kind + role */}
      {isStayCheckIn ? (
        <HotelTimes
          anchor={anchor}
          datePresets={datePresets}
          onChange={onChange}
        />
      ) : isStayReturn ? (
        <ReturnToRoom anchor={anchor} onChange={onChange} earlier={earlier} />
      ) : (
        <AppointmentTimes
          anchor={anchor}
          datePresets={datePresets}
          onChange={onChange}
          kind={kind}
        />
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// KindBadge — the primary "Stay / Appointment / Meal …" badge plus its
// sub-role badge. Both pop a small picker on click. The "overridden"
// flag appears when the user has manually re-classified.
// ─────────────────────────────────────────────────────────────────────

function KindBadge({
  kind,
  role,
  anchor,
  earlier,
  onChange,
}: {
  kind: AnchorKind;
  role: AnchorRole;
  anchor: Anchor;
  earlier: Anchor[];
  onChange: (patch: Partial<Anchor>) => void;
}) {
  const [openKind, setOpenKind] = useState(false);
  const [openRole, setOpenRole] = useState(false);
  const kindRef = useRef<HTMLDivElement>(null);
  const roleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (openKind && !kindRef.current?.contains(e.target as Node))
        setOpenKind(false);
      if (openRole && !roleRef.current?.contains(e.target as Node))
        setOpenRole(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [openKind, openRole]);

  const inferredK = inferredKind(anchor);
  const inferredR = inferredRoleFor(anchor, earlier);
  const kindLabel = labelForKind(kind);
  const roleLabel = role ? labelForRole(kind, role) : null;

  const persistKindOverride = async (k: AnchorKind | null) => {
    onChange({
      kindOverride: k === inferredK ? null : k,
      // Reset role + timing-mode overrides when kind changes — both
      // re-infer from the new kind.
      roleOverride: null,
      timingModeOverride: false,
    });
    setOpenKind(false);
    // Persist type back to the saved location when applicable.
    if (anchor.place?.kind === "location" && k != null) {
      const targetType: LocationType =
        k === "stay"
          ? "hotel"
          : k === "station"
            ? "station"
            : k === "meal"
              ? "other"
              : k === "event"
                ? "other"
                : "other";
      if (anchor.place.location_type !== targetType) {
        await updateLocationType({
          id: anchor.place.location_id,
          type: targetType,
        });
      }
    }
  };

  const persistRoleOverride = (r: string | null) => {
    onChange({
      roleOverride: r === inferredR ? null : r,
      // Role swap (e.g. check_in → return_to_room) wants a fresh timing
      // inference too, unless the user has explicitly set one already.
      timingModeOverride: false,
    });
    setOpenRole(false);
  };

  const kindOverridden =
    anchor.kindOverride != null && anchor.kindOverride !== inferredK;
  const roleOverridden =
    anchor.roleOverride != null && anchor.roleOverride !== inferredR;

  return (
    <>
      <div ref={kindRef} style={{ position: "relative" }}>
        <button
          type="button"
          className={`kind-badge kind-badge-${kind}`}
          onClick={() => setOpenKind((v) => !v)}
        >
          <KindDot kind={kind} />
          <span>{kindLabel}</span>
          {kindOverridden ? (
            <span className="kind-badge-flag">overridden</span>
          ) : null}
          <ChevDown />
        </button>
        {openKind ? (
          <div className="kind-pop">
            {KIND_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className="kind-pop-item"
                data-active={opt.value === kind}
                onClick={() => void persistKindOverride(opt.value)}
              >
                <KindDot kind={opt.value} />
                <span>{opt.label}</span>
                {opt.value === inferredK ? (
                  <span className="kind-pop-hint">suggested</span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {ROLES[kind].length > 0 && roleLabel ? (
        <div ref={roleRef} style={{ position: "relative" }}>
          <button
            type="button"
            className="kind-subbadge"
            onClick={() => setOpenRole((v) => !v)}
          >
            <span>{roleLabel}</span>
            {roleOverridden ? (
              <span className="kind-badge-flag">overridden</span>
            ) : null}
            <ChevDown />
          </button>
          {openRole ? (
            <div className="kind-pop">
              {ROLES[kind].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className="kind-pop-item"
                  data-active={opt.value === role}
                  onClick={() => persistRoleOverride(opt.value)}
                >
                  <span>{opt.label}</span>
                  {opt.value === inferredR ? (
                    <span className="kind-pop-hint">suggested</span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function KindDot({ kind }: { kind: AnchorKind }) {
  // Each kind gets its own tint so the badge reads in a glance.
  const tint =
    kind === "stay"
      ? "var(--gold)"
      : kind === "meal"
        ? "var(--terra)"
        : kind === "event"
          ? "var(--plum)"
          : kind === "station"
            ? "var(--slate)"
            : "var(--ink-2)";
  return (
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: 999,
        background: tint,
        flexShrink: 0,
      }}
    />
  );
}

function ChevDown() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ opacity: 0.5, marginLeft: 2 }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function HotelTimes({
  anchor,
  datePresets,
  onChange,
}: {
  anchor: Anchor;
  datePresets: Array<{ label: string; value: string }>;
  onChange: (patch: Partial<Anchor>) => void;
}) {
  const effectiveCheckOut = anchor.checkOutDate || nextDay(anchor.date);
  return (
    <div
      style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}
    >
      <div className="brief-when-row">
        <label className="brief-field">
          <span className="uc">Check-in</span>
          <input
            type="date"
            className="field"
            value={anchor.date}
            onChange={(e) => onChange({ date: e.target.value })}
          />
        </label>
        <label className="brief-field">
          <span className="uc">From</span>
          <input
            type="time"
            className="field"
            value={anchor.time}
            onChange={(e) => onChange({ time: e.target.value })}
          />
        </label>
      </div>
      <div className="brief-pill-row">
        {datePresets.map((p) => (
          <button
            key={`in-${p.value}`}
            type="button"
            className="pill brief-pill"
            data-active={p.value === anchor.date}
            onClick={() => {
              // Picking a new check-in shifts the check-out only if the
              // existing one no longer makes sense (empty, or now before
              // the new check-in). Otherwise we preserve the user's
              // explicit check-out choice.
              const currentOut = anchor.checkOutDate;
              const needsBump = !currentOut || currentOut <= p.value;
              onChange({
                date: p.value,
                ...(needsBump ? { checkOutDate: nextDay(p.value) } : {}),
              });
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="brief-when-row">
        <label className="brief-field">
          <span className="uc">Check-out</span>
          <input
            type="date"
            className="field"
            value={effectiveCheckOut}
            onChange={(e) => onChange({ checkOutDate: e.target.value })}
          />
        </label>
        <label className="brief-field">
          <span className="uc">By</span>
          <input
            type="time"
            className="field"
            value={anchor.checkOutTime || "11:00"}
            onChange={(e) => onChange({ checkOutTime: e.target.value })}
          />
        </label>
      </div>
      <div className="brief-pill-row">
        {datePresets.map((p) => (
          <button
            key={`out-${p.value}`}
            type="button"
            className="pill brief-pill"
            data-active={p.value === effectiveCheckOut}
            // A check-out before (or on) check-in is nonsense — disable.
            disabled={!!anchor.date && p.value <= anchor.date}
            onClick={() => onChange({ checkOutDate: p.value })}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ReturnToRoom({
  anchor,
  earlier,
  onChange,
}: {
  anchor: Anchor;
  earlier: Anchor[];
  onChange: (patch: Partial<Anchor>) => void;
}) {
  const stay = earlier.find(
    (a) =>
      a.place &&
      anchor.place &&
      samePlace(a.place, anchor.place) &&
      effectiveKind(a) === "stay" &&
      (a.roleOverride ?? "check_in") === "check_in",
  );
  const mode = effectiveTimingMode(anchor);
  const setMode = (next: TimingMode) =>
    onChange({ timingMode: next, timingModeOverride: true });

  const timeLabel = mode === "leave_by" ? "Leave by" : "Arrive by";

  return (
    <div
      style={{
        marginTop: 12,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        className="brief-subcard"
        style={{
          background: "var(--gold-tint)",
          borderColor: "var(--gold)",
          color: "var(--ink-2)",
        }}
      >
        <p
          className="serif-i"
          style={{
            margin: 0,
            fontSize: 14,
            color: "var(--ink-2)",
            lineHeight: 1.5,
          }}
        >
          {mode === "around_then" ? (
            <>
              Back at your hotel for a short while — Khonsera will fit it
              between the stops on either side
              {stay?.checkOutDate
                ? `, before check-out by ${stay.checkOutTime || "11:00"} on ${fmtShortDate(stay.checkOutDate, "UTC")}`
                : ""}
              .
            </>
          ) : (
            <>Using your existing stay — no new check-in needed.</>
          )}
        </p>
      </div>

      <TimingModeRow mode={mode} onChange={setMode} />

      <div className="brief-when-row">
        <label className="brief-field">
          <span className="uc">Date</span>
          <input
            type="date"
            className="field"
            value={anchor.date}
            onChange={(e) => onChange({ date: e.target.value })}
          />
        </label>
        {mode !== "around_then" ? (
          <label className="brief-field">
            <span className="uc">{timeLabel}</span>
            <input
              type="time"
              className="field"
              value={anchor.time}
              onChange={(e) => onChange({ time: e.target.value })}
            />
          </label>
        ) : (
          <div className="brief-field">
            <span className="uc">When</span>
            <div className="around-then-blurb">
              <span
                aria-hidden
                style={{ display: "inline-flex", color: "var(--gold-2)" }}
              >
                <TransportIcon.auto size={16} />
              </span>
              <span>Khonsera fits between adjacent anchors</span>
            </div>
          </div>
        )}
      </div>

      <DurationRow
        label={mode === "around_then" ? "About" : "Duration"}
        presets={[
          { label: "15m", mins: 15 },
          { label: "30m", mins: 30 },
          { label: "1h", mins: 60 },
          { label: "2h", mins: 120 },
        ]}
        value={anchor.durationMins}
        onChange={(m) => onChange({ durationMins: m })}
      />
    </div>
  );
}

function AppointmentTimes({
  anchor,
  datePresets,
  onChange,
  kind,
}: {
  anchor: Anchor;
  datePresets: Array<{ label: string; value: string }>;
  onChange: (patch: Partial<Anchor>) => void;
  kind: AnchorKind;
}) {
  const mode = effectiveTimingMode(anchor);
  const isStation = kind === "station";

  const timeLabel =
    mode === "leave_by"
      ? isStation
        ? "Catch by"
        : "Leave by"
      : "Arrive by";

  const setMode = (next: TimingMode) =>
    onChange({ timingMode: next, timingModeOverride: true });

  return (
    <div
      style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}
    >
      {/* Timing mode picker — three pinning options. */}
      <TimingModeRow mode={mode} onChange={setMode} />

      <div className="brief-when-row">
        <label className="brief-field">
          <span className="uc">Date</span>
          <input
            type="date"
            className="field"
            value={anchor.date}
            onChange={(e) => onChange({ date: e.target.value })}
          />
        </label>
        {mode !== "around_then" ? (
          <label className="brief-field">
            <span className="uc">{timeLabel}</span>
            <input
              type="time"
              className="field"
              value={anchor.time}
              onChange={(e) => onChange({ time: e.target.value })}
            />
          </label>
        ) : (
          <div className="brief-field">
            <span className="uc">When</span>
            <div className="around-then-blurb">
              <span
                aria-hidden
                style={{ display: "inline-flex", color: "var(--gold-2)" }}
              >
                <TransportIcon.auto size={16} />
              </span>
              <span>Khonsera fits between adjacent anchors</span>
            </div>
          </div>
        )}
      </div>

      <div className="brief-pill-row">
        {datePresets.map((p) => (
          <button
            key={p.value}
            type="button"
            className="pill brief-pill"
            data-active={p.value === anchor.date}
            onClick={() => onChange({ date: p.value })}
          >
            {p.label}
          </button>
        ))}
      </div>

      {mode !== "around_then" ? (
        <div className="brief-pill-row" style={{ marginTop: 4 }}>
          {TIME_PRESETS.map((t) => (
            <button
              key={t}
              type="button"
              className="pill brief-pill"
              data-active={t === anchor.time}
              onClick={() => onChange({ time: t })}
            >
              {t}
            </button>
          ))}
        </div>
      ) : null}

      {!isStation ? (
        <div style={{ marginTop: 4 }}>
          <DurationRow
            label={mode === "around_then" ? "About" : "Duration"}
            presets={APPT_DURATIONS}
            value={anchor.durationMins}
            onChange={(m) => onChange({ durationMins: m })}
          />
        </div>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// SummaryAnchorCard — the elegant collapsed-view that the editor uses.
// Shows place, kind/role badge, date+time, duration. Click Edit to
// flip back to the expanded form. The vision is to grow this into a
// reference card carrying restaurant phone numbers, hotel reception,
// booking contacts — anything you'd want to hand on the live day —
// but for now it sticks to the essentials.
// ─────────────────────────────────────────────────────────────────────

function SummaryAnchorCard({
  anchor,
  kind,
  role,
  first,
  canRemove,
  timezone,
  onEdit,
  onRemove,
}: {
  anchor: Anchor;
  kind: AnchorKind;
  role: AnchorRole;
  first: boolean;
  canRemove: boolean;
  timezone: string;
  onEdit?: () => void;
  onRemove: () => void;
}) {
  const isCheckIn = kind === "stay" && role !== "return_to_room";
  const isReturn = kind === "stay" && role === "return_to_room";
  const mode = anchor.timingMode;

  const date = fmtShortDate(anchor.date, timezone);
  const timeBit = (() => {
    if (isCheckIn) {
      const co =
        anchor.checkOutDate && anchor.checkOutTime
          ? `${fmtShortDate(anchor.checkOutDate, timezone)} ${
              anchor.checkOutTime || "11:00"
            }`
          : "";
      return `${anchor.time}${co ? ` → ${co}` : ""}`;
    }
    if (mode === "around_then") return `~${fmtDur(anchor.durationMins)}`;
    const prefix = mode === "leave_by" ? "by " : "";
    return `${prefix}${anchor.time} · ${fmtDur(anchor.durationMins)}`;
  })();

  const placeLabel = anchor.place?.label ?? "(no place yet)";
  const title = isReturn
    ? `Back at ${placeLabel}`
    : placeLabel;
  const kindLabel = labelForKind(kind);
  const roleLabel = role ? labelForRole(kind, role) : null;

  return (
    <section
      className={
        first
          ? "anchor-summary anchor-summary-hero"
          : "anchor-summary"
      }
    >
      <header className="anchor-summary-head">
        <div className="anchor-summary-badge">
          <KindDot kind={kind} />
          <span className="anchor-summary-kind">{kindLabel}</span>
          {roleLabel ? (
            <>
              <span aria-hidden className="anchor-summary-sep">·</span>
              <span className="anchor-summary-role">{roleLabel}</span>
            </>
          ) : null}
        </div>
        <div className="anchor-summary-actions">
          {onEdit ? (
            <button
              type="button"
              onClick={onEdit}
              className="anchor-card-toggle"
            >
              Edit
            </button>
          ) : null}
          {canRemove ? (
            <button
              type="button"
              onClick={onRemove}
              className="anchor-summary-remove"
              aria-label="Remove anchor"
            >
              Remove
            </button>
          ) : null}
        </div>
      </header>
      <h3 className="anchor-summary-title">{title}</h3>
      <p className="anchor-summary-meta">
        {date} · {timeBit}
      </p>
    </section>
  );
}

