"use client";

import { Fragment, useState, type ReactNode } from "react";
import { TransportIcon } from "@/components/icons";
import { TrainTicketCard, type TicketSegment } from "@/components/train-ticket-card";
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
        {(() => {
          // Compute "leave by" from the first fixed departure time
          const firstDepartTime = (transportBookings ?? [])
            .filter((tb) => tb.mode && tb.departTime && tb.date)
            .sort((a, b) => `${a.date}T${a.departTime}`.localeCompare(`${b.date}T${b.departTime}`))
            [0]?.departTime;
          const homeTime = firstDepartTime ? `Leave by ${firstDepartTime}` : "—";
          return (
            <SpineStop
              time={homeTime}
              eyebrow={baseType === "office" ? "Office" : baseType === "home" ? "Home" : "Start"}
              title={baseName || "Home"}
              sub={baseAddress || "Where your day begins"}
              dotKind="default"
            />
          );
        })()}
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

          // Helper: get the anchor UID for an entry (transport bookings
          // don't have anchor UIDs, so transitions to/from them don't
          // exist in the brief transitions map — we show a prompt instead)
          const anchorUid = (e: TimelineEntry) =>
            e.kind === "anchor" ? e.anchor.uid : null;

          const showVia = (t?: BriefTransition) =>
            !!t && ((t.mode as string) !== "auto" || t.booked);

          return entries.map((entry, entryIdx) => {
            // Render transition from the previous entry → this entry
            const prevEntry = entryIdx > 0 ? entries[entryIdx - 1] : null;
            let viaRow: ReactNode = null;

            if (prevEntry) {
              const fromUid = anchorUid(prevEntry);
              const toUid = anchorUid(entry);

              if (fromUid && toUid) {
                // Both are anchors — use existing transition + stopover logic
                const sv = stopovers.get(transitionKey(fromUid, toUid));
                if (sv) {
                  const svUid = stopoverUid(fromUid, toUid);
                  const legIn = transitions.get(transitionKey(fromUid, svUid));
                  const legOut = transitions.get(transitionKey(svUid, toUid));
                  viaRow = (
                    <Fragment key={`sv-spine-${fromUid}-${toUid}`}>
                      {showVia(legIn) ? (
                        <SpineVia transition={legIn!} railHubLabel={railHubLabel} flightHubLabel={flightHubLabel} />
                      ) : null}
                      <SpineStop
                        time="—"
                        eyebrow="Stopover"
                        title={sv.place?.label ?? "Pick a place"}
                        sub={`drop-in · ${fmtDur(sv.durationMins)}`}
                        dotKind="default"
                      />
                      {showVia(legOut) ? (
                        <SpineVia transition={legOut!} railHubLabel={railHubLabel} flightHubLabel={flightHubLabel} />
                      ) : null}
                    </Fragment>
                  );
                } else {
                  const via = transitions.get(transitionKey(fromUid, toUid));
                  viaRow = showVia(via) ? (
                    <SpineVia key={`via-${fromUid}-${toUid}`} transition={via!} railHubLabel={railHubLabel} flightHubLabel={flightHubLabel} />
                  ) : null;
                }
              } else if (prevEntry.kind === "transport" || entry.kind === "transport") {
                // Transition involves a transport booking — show a
                // contextual connector prompt
                const label =
                  prevEntry.kind === "transport"
                    ? `From ${prevEntry.booking.destinationHub?.label ?? "station"}`
                    : `To ${entry.kind === "transport" ? (entry.booking.departureHub?.label ?? "station") : "next stop"}`;
                viaRow = (
                  <div key={`via-transport-${entryIdx}`} className="tl-time" />
                );
                // Show a slim "get there" hint between transport and anchor
                const adjacentAnchorUid = fromUid ?? toUid;
                if (adjacentAnchorUid) {
                  // Try to find a transition with the adjacent anchor
                  // (transport bookings don't have UIDs in the transition map)
                  viaRow = (
                    <SpineConnector
                      key={`conn-${entryIdx}`}
                      label={label}
                    />
                  );
                } else {
                  viaRow = null;
                }
              }
            }

            if (entry.kind === "transport") {
              return (
                <Fragment key={`tb-${entry.booking.uid}`}>
                  {viaRow}
                  <SpineTransportBooking
                    booking={entry.booking}
                    timezone={timezone}
                  />
                </Fragment>
              );
            }

            const a = entry.anchor;
            const earlier = sorted.slice(0, entry.index);
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

function SpineConnector({ label }: { label: string }) {
  return (
    <>
      <div className="tl-time" />
      <div className="tl-rail">
        <div className="bones-via-tick" aria-hidden>
          <TransportIcon.walk size={10} />
        </div>
      </div>
      <div className="tl-content" style={{ padding: "2px 0 4px" }}>
        <p className="tl-eyebrow" style={{ fontSize: 10, color: "var(--ink-faint)" }}>
          {label}
        </p>
      </div>
    </>
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

function SpineTransportBooking({
  booking: tb,
  timezone,
}: {
  booking: BriefTransportBooking;
  timezone: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const MIcon = TransportIcon[tb.mode!];
  const modeLabel = tb.mode === "train" ? "Train" : tb.mode === "flight" ? "Flight" : tb.mode ?? "";

  return (
    <>
      <div className="tl-time" style={{ fontSize: 11 }}>
        {tb.departTime || ""}
      </div>
      <div className="tl-rail">
        <div className="bones-via-tick" aria-hidden>
          <MIcon size={11} />
        </div>
      </div>
      <div className="tl-content" style={{ padding: "2px 0 8px" }}>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          style={{
            all: "unset",
            cursor: "pointer",
            display: "block",
            width: "100%",
          }}
        >
          <p className="tl-eyebrow" style={{ marginBottom: 2 }}>
            Booked {modeLabel}
            <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.6 }}>
              {expanded ? "collapse" : "details"}
            </span>
          </p>
          <p className="tl-sub" style={{ marginTop: 0 }}>
            {tb.departureHub?.label && tb.destinationHub?.label
              ? `${tb.departureHub.label} → ${tb.destinationHub.label}`
              : tb.destinationHub?.label ?? tb.departureHub?.label ?? "TBC"}
            {tb.date ? ` · ${fmtShortDate(tb.date, timezone)}` : ""}
            {tb.departTime ? ` · ${tb.departTime}` : ""}
            {tb.arriveTime ? ` → ${tb.arriveTime}` : ""}
          </p>
          {(() => {
            const allCps = (tb.segmentCallingPoints ?? []).flat();
            if (allCps.length === 0) return null;
            const names = allCps.map((cp) => cp.station_code ?? cp.station);
            const summary = names.length <= 3 ? names.join(", ") : `${names.slice(0, 2).join(", ")} +${names.length - 2} more`;
            return (
              <p className="tl-sub" style={{ marginTop: 2, fontSize: 10, color: "var(--ink-faint)" }}>
                calling at {summary}
              </p>
            );
          })()}
        </button>
        {expanded ? (
          <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
            {buildSpineTicketSegments(tb).map((seg, i) => (
              <TrainTicketCard key={i} segment={seg} compact />
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
}

function buildSpineTicketSegments(tb: BriefTransportBooking): TicketSegment[] {
  const date = tb.date || new Date().toISOString().slice(0, 10);
  const op = tb.operator ?? null;
  const tt = tb.ticketType ?? null;
  const rr = tb.routeRestriction ?? null;

  if (tb.changeovers.length === 0) {
    const bc = tb.barcodes[0];
    const cp = tb.segmentCallingPoints?.[0];
    return [{
      from_station: tb.departureHub?.label ?? "?",
      to_station: tb.destinationHub?.label ?? "?",
      from_station_code: null,
      to_station_code: null,
      departure_date: date,
      departure_time: tb.departTime || "",
      arrival_time: tb.arriveTime || "",
      operator: op,
      route_restriction: rr,
      ticket_type: tt,
      coach: null,
      seat: tb.seat || null,
      barcode_ref: bc?.ref ?? (tb.reference || null),
      barcode_data: bc?.data ?? null,
      price: tb.price ? Number(tb.price) : null,
      calling_points: cp && cp.length > 0 ? cp : null,
    }];
  }

  const segments: TicketSegment[] = [];
  const stops = [
    { label: tb.departureHub?.label ?? "?", time: tb.departTime || "" },
    ...tb.changeovers.map((co) => ({ label: co.hub?.label ?? "?", time: co.departTime || "" })),
    { label: tb.destinationHub?.label ?? "?", time: tb.arriveTime || "" },
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const bc = tb.barcodes[i];
    const cp = tb.segmentCallingPoints?.[i];
    segments.push({
      from_station: stops[i].label,
      to_station: stops[i + 1].label,
      from_station_code: null,
      to_station_code: null,
      departure_date: date,
      departure_time: stops[i].time,
      arrival_time: i < stops.length - 2 ? (tb.changeovers[i]?.arriveTime || "") : (tb.arriveTime || ""),
      operator: op,
      route_restriction: rr,
      ticket_type: tt,
      coach: null,
      seat: i === 0 ? (tb.seat || null) : null,
      barcode_ref: bc?.ref ?? null,
      barcode_data: bc?.data ?? null,
      price: i === 0 && tb.price ? Number(tb.price) : null,
      calling_points: cp && cp.length > 0 ? cp : null,
    });
  }
  return segments;
}
