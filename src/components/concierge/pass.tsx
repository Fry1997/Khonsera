"use client";

import type { CSSProperties } from "react";
import type { TicketVM } from "./types";
import { formatClock } from "./types";
import { StatusStrip, KIND_LABEL } from "./document-cards";

// The Pass (Round 5b, Design) — the first-class Wallet rendering: a booked
// document as a materially-real issued ticket (operator band + kind seam, the
// big time-pair, a drawn connector, perforation + barcode stub). Within a day
// it stacks: the next-needed pass full, the rest peeking (`.cc-pass--peek`).
// Maps a TicketVM → the `.cc-pass-*` DOM Design styles; the look is the CSS's.
//
// A pass shows ONE journey — the next-needed leg (a return's inbound is its own
// pass downstream, per the brief). Reuses StatusStrip + BarcodePresenter.

function durationLabel(t: TicketVM): string {
  if (t.kind === "stay")
    return t.nights ? `${t.nights} night${t.nights > 1 ? "s" : ""}` : "";
  const m = t.legs[0]?.durationMinutes;
  if (!m) return "";
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h ? `${h}h ${min}m` : `${min}m`;
}

function PassIco({ kind }: { kind: TicketVM["kind"] }) {
  const d =
    kind === "air"
      ? "M2 14 L22 7 L15 22 L12 15 z"
      : kind === "stay"
        ? "M3 18 v-6 h13 a3 3 0 0 1 3 3 v3 M3 12 V7 M19 18 v-3 M3 15 h16"
        : "M6 4 h12 v10 a2 2 0 0 1-2 2 H8 a2 2 0 0 1-2-2 z M6 16 l-2 4 M18 16 l2 4 M9 8 h6"; // train / coach
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function ScanIco() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10" />
    </svg>
  );
}

// The loud day-of boarding callout: which platform, which train (by its final
// destination, to match the station board), and a guard against an earlier
// service on the same platform. Fed by LivePass; absent in static contexts.
export type BoardingVM = {
  platform?: string; // "2" — undefined means not announced yet
  toward?: string; // the train's final destination — "Corby"
  earlier?: string; // "Platform 2 also has the 17:25 to Bedford before yours"
};

// A short station/airport CODE for the big code-pair (WEL → LUT). Falls back to
// the first letters of the place name when a real CRS/IATA code isn't carried.
function codeFor(stop: { code?: string; place?: string }): string {
  if (stop.code) return stop.code.toUpperCase();
  return (stop.place ?? "")
    .replace(/[^A-Za-z]/g, "")
    .slice(0, 3)
    .toUpperCase();
}

// One cell of the boarding-pass stub grid (DEPART · ARRIVE · PLATFORM · SEAT).
function StubCell({
  label,
  value,
  badge,
}: {
  label: string;
  value: string;
  badge?: boolean;
}) {
  return (
    <span
      className="cc-pass-stub-cell"
      data-label={label}
      style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}
    >
      <span
        className="eyb"
        style={{
          fontSize: 8.5,
          letterSpacing: "0.18em",
          color: "var(--ink-faint)",
        }}
      >
        {label}
      </span>
      {badge && value ? (
        <span
          className="mono engr-d"
          style={{
            alignSelf: "flex-start",
            display: "inline-flex",
            alignItems: "center",
            height: 24,
            padding: "0 9px",
            borderRadius: "var(--radius-xs)",
            background: "var(--char)",
            color: "var(--cream)",
            fontWeight: 600,
            fontSize: 13,
            lineHeight: 1,
          }}
        >
          {value}
        </span>
      ) : (
        <span
          className="mono"
          style={{
            fontSize: 15,
            color: value ? "var(--ink)" : "var(--ink-faint)",
          }}
        >
          {value || "—"}
        </span>
      )}
    </span>
  );
}

export function Pass({
  ticket,
  onShow,
  docked = false,
  today = false,
  boarding,
}: {
  ticket: TicketVM;
  onShow?: (ticket: TicketVM) => void;
  docked?: boolean; // on the Planner spine: barcode collapses to "Ticket ready"
  today?: boolean; // Today uses the compact operational face from the approved screen.
  boarding?: BoardingVM; // day-of: loud platform + train identity + wrong-train guard
}) {
  const leg = ticket.legs[0];
  const isStay = ticket.kind === "stay";
  const showBoarding =
    !!boarding &&
    !isStay &&
    (!!boarding.platform || !!boarding.toward || !!boarding.earlier);
  const passClassName = [
    "cc-pass",
    docked ? "cc-pass--docked" : null,
    today ? "cc-pass--today" : null,
  ]
    .filter(Boolean)
    .join(" ");

  // Stay keeps a simple check-in/out face (no station codes / platforms).
  if (isStay) {
    return (
      <div className={passClassName} data-kind="stay" style={PASS_SHELL}>
        <div className="cc-pass-band" style={BAND}>
          <span style={BAND_ICO}>
            <span className="engr-ico-d" style={ICO_FLEX}>
              <PassIco kind="stay" />
            </span>
          </span>
          <span className="eyb engr-d" style={BAND_KIND}>
            {KIND_LABEL.stay}
          </span>
          <span style={BAND_OP}>{ticket.operator}</span>
        </div>
        <div
          className="cc-pass-stub"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            padding: "16px 18px",
          }}
        >
          <StubCell label="CHECK IN" value={formatClock(ticket.checkIn)} />
          <StubCell label="CHECK OUT" value={formatClock(ticket.checkOut)} />
          {ticket.roomType ? (
            <StubCell label="ROOM" value={ticket.roomType} />
          ) : null}
          {ticket.address ? (
            <span
              className="mono"
              style={{
                gridColumn: "1 / -1",
                fontSize: 11,
                color: "var(--ink-dim)",
              }}
            >
              {ticket.address}
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  const fromCode = codeFor(leg?.origin ?? {});
  const toCode = codeFor(leg?.destination ?? {});
  const platLabel = ticket.kind === "air" ? "GATE" : "PLATFORM";
  const platVal = leg?.origin.platform ?? leg?.destination.platform ?? "";
  const seatVal =
    ticket.kind === "air"
      ? (leg?.seat ?? "")
      : [leg?.coach, leg?.seat].filter(Boolean).join("·");

  return (
    <div className={passClassName} data-kind={ticket.kind} style={PASS_SHELL}>
      {today ? (
        <div className="cc-pass-today-head">
          <span className="mono cc-pass-today-time">
            {formatClock(leg?.origin.time)}
          </span>
          <span className="cc-pass-today-status">
            {leg?.status ? (
              <StatusStrip status={leg.status} />
            ) : (
              <span>On time</span>
            )}
            {platVal ? <span aria-hidden>·</span> : null}
            {platVal ? (
              <span>
                {ticket.kind === "air" ? "Gate" : "Platform"} {platVal}
              </span>
            ) : null}
          </span>
        </div>
      ) : (
        <div className="cc-pass-band" style={BAND}>
          <span style={BAND_ICO}>
            <span className="engr-ico-d" style={ICO_FLEX}>
              <PassIco kind={ticket.kind} />
            </span>
          </span>
          <span className="eyb engr-d" style={BAND_KIND}>
            {KIND_LABEL[ticket.kind]}
          </span>
          <span style={BAND_OP}>{ticket.operator}</span>
        </div>
      )}

      {/* big station-code pair */}
      <div
        className="cc-pass-route"
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          padding: "18px 18px 14px",
        }}
      >
        <span style={{ minWidth: 0 }}>
          <span className="engr cc-pass-code" style={CODE}>
            {fromCode}
          </span>
          <span className="cc-pass-place" style={CODE_NAME}>
            {leg?.origin.place ?? ""}
          </span>
        </span>
        <span
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 5,
            paddingTop: 12,
          }}
        >
          <span
            className="engr-ico"
            style={{ color: "var(--ink-faint)", ...ICO_FLEX }}
          >
            <ArrowRight />
          </span>
          <span
            className="mono"
            style={{
              fontSize: 9.5,
              color: "var(--ink-faint)",
              letterSpacing: "0.06em",
            }}
          >
            {durationLabel(ticket)}
          </span>
        </span>
        <span style={{ minWidth: 0, textAlign: "right" }}>
          <span className="engr cc-pass-code" style={CODE}>
            {toCode}
          </span>
          <span className="cc-pass-place" style={CODE_NAME}>
            {leg?.destination.place ?? ""}
          </span>
        </span>
      </div>

      {/* day-of loud boarding callout (live only) */}
      {showBoarding ? (
        <div
          className="cc-pass-boarding"
          data-awaiting={boarding!.platform ? undefined : "true"}
          style={{ margin: "0 18px 4px" }}
        >
          <span className="cc-pass-boarding-plat">
            <span className="cc-pass-boarding-label">
              {ticket.kind === "air" ? "Gate" : "Platform"}
            </span>
            <span className="cc-pass-boarding-num">
              {boarding!.platform ?? "—"}
            </span>
          </span>
          {boarding!.toward ? (
            <span className="cc-pass-boarding-toward">
              <span className="cc-pass-boarding-label">Your train</span>
              <span className="cc-pass-boarding-dest">
                towards {boarding!.toward}
              </span>
            </span>
          ) : null}
          {boarding!.earlier ? (
            <p className="cc-pass-boarding-warn">{boarding!.earlier}</p>
          ) : !boarding!.platform ? (
            <p className="cc-pass-boarding-note">
              Platform not shown yet — watch the boards.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="cc-pass-perf perf" style={{ margin: "2px 0" }} />

      {/* boarding-pass stub grid */}
      <div
        className="cc-pass-stub"
        style={{
          display: "grid",
          gridTemplateColumns: today ? "repeat(3, 1fr)" : "repeat(4, 1fr)",
          gap: 10,
          padding: "13px 18px 6px",
        }}
      >
        <StubCell label="DEPARTS" value={formatClock(leg?.origin.time)} />
        {today ? <StubCell label={platLabel} value={platVal} /> : null}
        <StubCell label="ARRIVES" value={formatClock(leg?.destination.time)} />
        {!today ? <StubCell label={platLabel} value={platVal} badge /> : null}
        {!today ? <StubCell label="SEAT" value={seatVal} badge /> : null}
      </div>

      {!today && leg?.status ? (
        <div className="cc-pass-status" style={{ padding: "4px 18px 0" }}>
          <StatusStrip status={leg.status} />
        </div>
      ) : null}
      {ticket.consequence ? (
        <p className="cc-pass-consequence" style={{ padding: "6px 18px 0" }}>
          {ticket.consequence}
        </p>
      ) : null}

      {/* show ticket — the code lives behind it / in ScanView (brief §6.3) */}
      {leg?.barcodes?.length ? (
        <div className="cc-pass-ready" style={{ padding: "12px 16px 16px" }}>
          <button
            onClick={() => onShow?.(ticket)}
            className="engr-d"
            style={SHOW_BTN}
          >
            <span className="engr-ico-d" style={ICO_FLEX}>
              <ScanIco />
            </span>
            <span>
              Show {ticket.kind === "air" ? "pass" : "ticket"}
              {ticket.reference ? ` · ${ticket.reference}` : ""}
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

// Shared inline style atoms for the v7 ticket (colour tokens; one-off px per the
// incremental-migration policy). Centralised here so the JSX reads cleanly.
const PASS_SHELL: CSSProperties = {
  display: "block",
  gap: 0,
  overflow: "hidden",
  padding: 0,
  borderRadius: "var(--radius-lg)",
  background: "var(--card)",
  border: "1px solid var(--line)",
};
const BAND: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "11px 16px",
  background: "var(--char)",
  color: "var(--cream)",
};
const BAND_ICO: CSSProperties = {
  display: "inline-grid",
  placeItems: "center",
  width: 24,
  height: 24,
  borderRadius: "var(--radius-sm)",
  background: "rgba(243,239,230,0.10)",
  color: "var(--cream)",
};
const BAND_KIND: CSSProperties = {
  fontSize: 9,
  letterSpacing: "0.22em",
  color: "var(--cream)",
};
const BAND_OP: CSSProperties = {
  flex: 1,
  textAlign: "right",
  fontSize: 10.5,
  color: "var(--cream-dim)",
};
const ICO_FLEX: CSSProperties = { display: "inline-flex" };
const CODE: CSSProperties = {
  display: "block",
  fontSize: 36,
  fontWeight: 300,
  lineHeight: 0.9,
  letterSpacing: "0.01em",
  color: "var(--ink)",
};
const CODE_NAME: CSSProperties = {
  display: "block",
  fontSize: 11,
  color: "var(--ink-dim)",
  marginTop: 6,
};
const SHOW_BTN: CSSProperties = {
  width: "100%",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  height: 46,
  padding: "0 14px",
  border: "none",
  borderRadius: "var(--radius-md)",
  background: "var(--char)",
  color: "var(--cream)",
  fontFamily: "var(--sans)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "var(--lift-char)",
};

export function PassPeek({
  ticket,
  onSelect,
}: {
  ticket: TicketVM;
  onSelect?: (ticket: TicketVM) => void;
}) {
  const leg = ticket.legs[0];
  const time = ticket.kind === "stay" ? ticket.checkIn : leg?.origin.time;
  return (
    <div
      className="cc-pass cc-pass--peek"
      data-kind={ticket.kind}
      onClick={onSelect ? () => onSelect(ticket) : undefined}
      style={onSelect ? { cursor: "pointer" } : undefined}
    >
      <div className="cc-pass-band">
        <div className="cc-pass-operator">
          <span className="cc-pass-kind">{KIND_LABEL[ticket.kind]}</span>
          <span className="cc-pass-name">{ticket.operator}</span>
        </div>
        <span className="cc-pass-peekline">
          <span className="cc-pass-peektime">{formatClock(time)}</span>
          {leg?.status ? <StatusStrip status={leg.status} /> : null}
        </span>
      </div>
    </div>
  );
}
