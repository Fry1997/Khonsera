"use client";

import { Fragment, type ReactNode } from "react";
import { TransportIcon } from "@/components/icons";
import {
  TRANSITION_OPTIONS,
  effectiveKind,
  effectiveRole,
  effectiveTimingMode,
  fmtDur,
  fmtShortDate,
  labelForKind,
  labelForRole,
  stopoverUid,
  transitionKey,
} from "./helpers";
import type { Anchor, BriefTransition, Stopover } from "./types";
import type { BriefTransportBooking } from "./transport-booking-card";
import type { BriefAccommodationBooking } from "./accommodation-booking-card";

// JourneySpine — the live read-only "what we'll build" timeline on
// the right side of the brief. Reused on the editor in summary mode
// later, but for now it's a brief-only surface.
export function JourneySpine({
  anchors,
  transitions,
  stopovers,
  titleOverride,
  timezone,
  railHubLabel,
  flightHubLabel,
  baseName,
  baseAddress,
  baseType,
  beHomeBy,
  transportBookings,
  accommodationBookings,
}: {
  anchors: Anchor[];
  transitions: Map<string, BriefTransition>;
  stopovers: Map<string, Stopover>;
  titleOverride: string;
  timezone: string;
  railHubLabel?: string | null;
  flightHubLabel?: string | null;
  baseName?: string;
  baseAddress?: string | null;
  baseType?: "home" | "office" | null;
  beHomeBy?: { date: string; time: string } | null;
  transportBookings?: BriefTransportBooking[];
  accommodationBookings?: BriefAccommodationBooking[];
}) {
  const haveAny =
    anchors.some((a) => a.place != null) ||
    (transportBookings ?? []).some((tb) => tb.mode != null) ||
    (accommodationBookings ?? []).some((ab) => ab.hotel != null);
  if (!haveAny) {
    return (
      <div className="brief-preview-empty">
        <p
          className="serif-i"
          style={{ color: "var(--ink-dim)", margin: 0, lineHeight: 1.5 }}
        >
          Pick at least one place and Khonsera will sketch the spine of the
          day here — home first, then each anchor in date order.
        </p>
      </div>
    );
  }

  const sorted = [...anchors]
    .filter((a) => a.place != null)
    .sort((a, b) =>
      `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`),
    );

  const titleSource =
    sorted.find((a) => effectiveKind(a) !== "stay") ?? sorted[0];
  const workingTitle =
    titleOverride || titleSource?.place?.label || "Untitled trip";

  return (
    <div
      className="card brief-preview-card"
      style={{ padding: 18, marginTop: 10 }}
    >
      <div
        style={{
          marginBottom: 12,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <span className="uc">Working title</span>
        <span
          className="display-i"
          style={{
            fontSize: 22,
            fontWeight: 500,
            color: "var(--ink)",
            lineHeight: 1.15,
          }}
        >
          {workingTitle}
        </span>
      </div>

      <div className="tl">
        <SpineStop
          time="—"
          eyebrow={baseType === "office" ? "Office" : baseType === "home" ? "Home" : "Start"}
          title={baseName || "Home"}
          sub={baseAddress || "Where your day begins"}
          dotKind="default"
        />
        {/* Build a unified timeline: anchors + transport bookings sorted by time */}
        {(() => {
          type TimelineEntry =
            | { kind: "anchor"; anchor: (typeof sorted)[0]; index: number }
            | { kind: "transport"; booking: BriefTransportBooking };
          const entries: TimelineEntry[] = sorted.map((a, i) => ({
            kind: "anchor" as const,
            anchor: a,
            index: i,
          }));
          for (const tb of transportBookings ?? []) {
            if (tb.mode) entries.push({ kind: "transport", booking: tb });
          }
          entries.sort((a, b) => {
            const aTime =
              a.kind === "anchor"
                ? `${a.anchor.date}T${a.anchor.time}`
                : a.kind === "transport" && a.booking.date && a.booking.departTime
                  ? `${a.booking.date}T${a.booking.departTime}`
                  : "z";
            const bTime =
              b.kind === "anchor"
                ? `${b.anchor.date}T${b.anchor.time}`
                : b.kind === "transport" && b.booking.date && b.booking.departTime
                  ? `${b.booking.date}T${b.booking.departTime}`
                  : "z";
            return aTime.localeCompare(bTime);
          });
          return entries.map((entry) => {
            if (entry.kind === "transport") {
              const tb = entry.booking;
              const MIcon = TransportIcon[tb.mode!];
              return (
                <Fragment key={`tb-${tb.uid}`}>
                  <div className="tl-time" />
                  <div className="tl-rail">
                    <div className="bones-via-tick" aria-hidden>
                      <MIcon size={11} />
                    </div>
                  </div>
                  <div className="tl-content" style={{ padding: "2px 0 8px" }}>
                    <p className="tl-eyebrow" style={{ marginBottom: 2 }}>
                      Booked {tb.mode}
                    </p>
                    <p className="tl-sub" style={{ marginTop: 0 }}>
                      {tb.departureHub?.label && tb.destinationHub?.label
                        ? `${tb.departureHub.label} → ${tb.destinationHub.label}`
                        : tb.destinationHub?.label ?? tb.departureHub?.label ?? "TBC"}
                      {tb.date ? ` · ${fmtShortDate(tb.date, timezone)}` : ""}
                      {tb.serviceNumber ? ` · ${tb.serviceNumber}` : ""}
                      {tb.departTime ? ` · ${tb.departTime}` : ""}
                      {tb.arriveTime ? ` → ${tb.arriveTime}` : ""}
                    </p>
                  </div>
                </Fragment>
              );
            }
            const a = entry.anchor;
            const i = entry.index;
            const earlier = sorted.slice(0, i);
          const prev = sorted[i - 1];
          // The prev→this leg either:
          //   * has a stopover sitting between them → render the
          //     in-leg via, the stopover stop, and the out-leg via
          //   * has no stopover → render the single parent via row
          // A via row is suppressed when the mode is still "auto" and
          // no booking exists — nothing meaningful to show yet.
          const sv = prev ? stopovers.get(transitionKey(prev.uid, a.uid)) : undefined;
          const showVia = (t?: BriefTransition) =>
            !!t && (t.mode !== "auto" || t.booked);
          let viaRow: ReactNode = null;
          if (prev && sv) {
            const svUid = stopoverUid(prev.uid, a.uid);
            const legIn = transitions.get(transitionKey(prev.uid, svUid));
            const legOut = transitions.get(transitionKey(svUid, a.uid));
            viaRow = (
              <Fragment key={`sv-spine-${prev.uid}-${a.uid}`}>
                {showVia(legIn) ? (
                  <SpineVia
                    transition={legIn!}
                    railHubLabel={railHubLabel}
                    flightHubLabel={flightHubLabel}
                  />
                ) : null}
                <SpineStop
                  time="—"
                  eyebrow="Stopover"
                  title={sv.place?.label ?? "Pick a place"}
                  sub={`drop-in · ${fmtDur(sv.durationMins)}`}
                  dotKind="default"
                />
                {showVia(legOut) ? (
                  <SpineVia
                    transition={legOut!}
                    railHubLabel={railHubLabel}
                    flightHubLabel={flightHubLabel}
                  />
                ) : null}
              </Fragment>
            );
          } else if (prev) {
            const via = transitions.get(transitionKey(prev.uid, a.uid));
            viaRow = showVia(via) ? (
              <SpineVia
                key={`via-${prev.uid}-${a.uid}`}
                transition={via!}
                railHubLabel={railHubLabel}
                flightHubLabel={flightHubLabel}
              />
            ) : null;
          }

          const kind = effectiveKind(a);
          const role = effectiveRole(a, earlier);
          const labelForBadge = role
            ? labelForRole(kind, role)
            : labelForKind(kind);
          const isCheckIn = kind === "stay" && role !== "return_to_room";
          if (isCheckIn) {
            return (
              <Fragment key={a.uid}>
                {viaRow}
                <SpineStop
                  time={fmtShortDate(a.date, timezone)}
                  eyebrow={labelForBadge}
                  title={a.place?.label ?? ""}
                  sub={`${a.time}${
                    a.checkOutDate
                      ? ` → ${fmtShortDate(a.checkOutDate, timezone)} ${
                          a.checkOutTime || "11:00"
                        }`
                      : ""
                  }${
                    a.accommodation?.reference
                      ? ` · ref ${a.accommodation.reference}`
                      : ""
                  }`}
                  dotKind="default"
                />
              </Fragment>
            );
          }
          const mode = effectiveTimingMode(a);
          // Time slot in the preview reflects the timing mode: arrive_by
          // shows the time, leave_by shows "by HH:MM" so the reader sees
          // the ceiling, around_then shows an em-dash (unknown — the
          // editor solver will fill it in from adjacent anchors).
          const timeSlot =
            mode === "around_then"
              ? "—"
              : mode === "leave_by"
                ? `by ${a.time}`
                : a.time;
          const subBit = a.durationMins
            ? `${fmtShortDate(a.date, timezone)} · ${
                mode === "around_then" ? "~" : ""
              }${fmtDur(a.durationMins)}`
            : fmtShortDate(a.date, timezone);
          return (
            <Fragment key={a.uid}>
              {viaRow}
              <SpineStop
                time={timeSlot}
                eyebrow={labelForBadge}
                title={
                  kind === "stay"
                    ? `Back at ${a.place?.label ?? "the hotel"}`
                    : a.place?.label ?? ""
                }
                sub={subBit}
                dotKind={kind === "stay" ? "default" : "gold"}
              />
            </Fragment>
          );
          });
        })()}
        {accommodationBookings?.map((ab) => {
          if (!ab.hotel) return null;
          return (
            <Fragment key={ab.uid}>
              <div className="tl-time" style={{ fontSize: 11, color: "var(--ink-faint)" }}>
                {ab.checkInTime || "—"}
              </div>
              <div className="tl-rail">
                <div
                  className="tl-dot"
                  style={{
                    width: 6,
                    height: 6,
                    border: "1.5px dashed var(--ink-faint)",
                    background: "transparent",
                  }}
                />
              </div>
              <div className="tl-content" style={{ padding: "4px 0 10px" }}>
                <p
                  className="tl-eyebrow"
                  style={{ marginBottom: 1, color: "var(--ink-faint)", fontSize: 10.5 }}
                >
                  Check-in from
                </p>
                <p className="tl-sub" style={{ marginTop: 0, fontSize: 12 }}>
                  {ab.hotel.label}
                  {ab.checkInDate ? ` · ${fmtShortDate(ab.checkInDate, timezone)}` : ""}
                </p>
              </div>
            </Fragment>
          );
        })}
        {beHomeBy ? (
          <SpineStop
            time={beHomeBy.time}
            eyebrow="Be home by"
            title={baseName || "Home"}
            sub={baseAddress || fmtShortDate(beHomeBy.date, timezone)}
            dotKind="default"
          />
        ) : null}
      </div>
    </div>
  );
}

function SpineVia({
  transition,
  railHubLabel,
  flightHubLabel,
}: {
  transition: BriefTransition;
  railHubLabel?: string | null;
  flightHubLabel?: string | null;
}) {
  const opt = TRANSITION_OPTIONS.find((o) => o.value === transition.mode);
  const Icon = opt ? TransportIcon[opt.icon] : TransportIcon.auto;
  const label = opt?.label ?? "via";
  // Hub hint — rail-stationy modes use the rail hub, flight uses the
  // flight hub. Tube intentionally falls through to the rail hint
  // (default station is usually the user's local rail/tube hub).
  const hubLabel =
    transition.mode === "flight"
      ? flightHubLabel
      : transition.mode === "train" ||
          transition.mode === "tube" ||
          transition.mode === "bus"
        ? railHubLabel
        : null;
  const sub = transition.booked
    ? `${transition.booking.serviceNumber || "ticket"}${
        transition.booking.departTime && transition.booking.arriveTime
          ? ` · ${transition.booking.departTime} → ${transition.booking.arriveTime}`
          : ""
      }${
        transition.booking.destinationHub?.label
          ? ` · ${transition.booking.destinationHub.label}`
          : ""
      }`
    : hubLabel
      ? `from ${hubLabel}`
      : "intent — Khonsera fills in distance + time";
  return (
    <>
      <div className="tl-time" />
      <div className="tl-rail">
        <div className="bones-via-tick" aria-hidden>
          <Icon size={11} />
        </div>
      </div>
      <div className="tl-content" style={{ padding: "2px 0 8px" }}>
        <p className="tl-eyebrow" style={{ marginBottom: 2 }}>
          via {label}
          {transition.booked ? " · booked" : ""}
        </p>
        <p className="tl-sub" style={{ marginTop: 0 }}>
          {sub}
        </p>
      </div>
    </>
  );
}

function SpineStop({
  time,
  eyebrow,
  title,
  sub,
  dotKind = "default",
}: {
  time: string;
  eyebrow: string;
  title: string;
  sub: string;
  dotKind?: "default" | "gold";
}) {
  return (
    <>
      <div className="tl-time">{time}</div>
      <div className="tl-rail">
        <div className={dotKind === "gold" ? "tl-dot gold" : "tl-dot"} />
      </div>
      <div className="tl-content" style={{ padding: "6px 0 14px" }}>
        <p className="tl-eyebrow" style={{ marginBottom: 2 }}>
          {eyebrow}
        </p>
        <h3 className="tl-title">
          {dotKind === "gold" ? <em>{title}</em> : title}
        </h3>
        <p className="tl-sub">{sub}</p>
      </div>
    </>
  );
}
