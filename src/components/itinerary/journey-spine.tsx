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
  beHomeBy,
}: {
  anchors: Anchor[];
  transitions: Map<string, BriefTransition>;
  stopovers: Map<string, Stopover>;
  titleOverride: string;
  timezone: string;
  railHubLabel?: string | null;
  flightHubLabel?: string | null;
  baseName?: string;
  beHomeBy?: { date: string; time: string } | null;
}) {
  const haveAny = anchors.some((a) => a.place != null);
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
          eyebrow="Start"
          title={baseName || "Home"}
          sub="Where your day begins"
          dotKind="default"
        />
        {sorted.map((a, i) => {
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
            !!t && (t.mode !== "auto" || t.booked || t.transportBooking != null);
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
        })}
        {beHomeBy ? (
          <SpineStop
            time={beHomeBy.time}
            eyebrow="Be home by"
            title={baseName || "Home"}
            sub={fmtShortDate(beHomeBy.date, timezone)}
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
  const tb = transition.transportBooking;
  const sub = tb
    ? `${tb.segments[0]?.service_number || "ticket"}${
        tb.segments[0]?.departure_at
          ? ` · ${new Date(tb.segments[0].departure_at).toTimeString().slice(0, 5)}`
          : ""
      }${
        tb.segments[tb.segments.length - 1]?.arrival_at
          ? ` → ${new Date(tb.segments[tb.segments.length - 1].arrival_at).toTimeString().slice(0, 5)}`
          : ""
      }`
    : transition.booked
      ? `${transition.booking.serviceNumber || "ticket"}${
          transition.booking.departTime && transition.booking.arriveTime
            ? ` · ${transition.booking.departTime} → ${transition.booking.arriveTime}`
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
          {transition.booked || transition.transportBooking ? " · booked" : ""}
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
