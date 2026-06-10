"use client";

import type { TicketVM } from "./types";
import { formatClock } from "./types";
import { StatusStrip, BarcodePresenter, KIND_LABEL } from "./document-cards";

// The Pass (Round 5b, Design) — the first-class Wallet rendering: a booked
// document as a materially-real issued ticket (operator band + kind seam, the
// big time-pair, a drawn connector, perforation + barcode stub). Within a day
// it stacks: the next-needed pass full, the rest peeking (`.cc-pass--peek`).
// Maps a TicketVM → the `.cc-pass-*` DOM Design styles; the look is the CSS's.
//
// A pass shows ONE journey — the next-needed leg (a return's inbound is its own
// pass downstream, per the brief). Reuses StatusStrip + BarcodePresenter.

function durationLabel(t: TicketVM): string {
  if (t.kind === "stay") return t.nights ? `${t.nights} night${t.nights > 1 ? "s" : ""}` : "";
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

function metaFor(stop: { code?: string; platform?: string }, kind: TicketVM["kind"]): string {
  const lab = kind === "air" ? "Gate" : "Plat";
  return [stop.code, stop.platform ? `${lab} ${stop.platform}` : null].filter(Boolean).join(" · ");
}

function seatLine(t: TicketVM): string {
  const leg = t.legs[0];
  if (!leg) return "";
  if (t.kind === "air") return [leg.seat, leg.boardingZone].filter(Boolean).join(" · ");
  return [leg.travelClass, leg.ticketType].filter(Boolean).join(" · ");
}

function stubMeta(t: TicketVM): { label: string; value: string } | null {
  const leg = t.legs[0];
  if (!leg?.barcodes?.length) return null;
  if (t.kind === "air") {
    return { label: "Boarding", value: [formatClock(leg.boardingTime), leg.boardingZone].filter(Boolean).join(" · ") };
  }
  return { label: "Coach · Seat", value: [leg.coach, leg.seat].filter(Boolean).join(" · ") };
}

export function Pass({
  ticket,
  onShow,
}: {
  ticket: TicketVM;
  onShow?: (ticket: TicketVM) => void;
}) {
  const leg = ticket.legs[0];
  const isStay = ticket.kind === "stay";

  const from = isStay
    ? { time: ticket.checkIn, place: "Check in", meta: "" }
    : { time: leg?.origin.time, place: leg?.origin.place ?? "", meta: leg ? metaFor(leg.origin, ticket.kind) : "" };
  const to = isStay
    ? { time: ticket.checkOut, place: "Check out", meta: ticket.roomType ?? "" }
    : { time: leg?.destination.time, place: leg?.destination.place ?? "", meta: leg ? metaFor(leg.destination, ticket.kind) : "" };

  const stub = stubMeta(ticket);

  return (
    <div className="cc-pass" data-kind={ticket.kind}>
      <div className="cc-pass-band">
        <div className="cc-pass-operator">
          <span className="cc-pass-kind">{KIND_LABEL[ticket.kind]}</span>
          <span className="cc-pass-name">{ticket.operator}</span>
        </div>
        {ticket.reference ? <span className="cc-pass-ref">{ticket.reference}</span> : null}
      </div>

      <div className="cc-pass-body">
        <div className="cc-pass-route">
          <span className="cc-pass-end" data-role="from">
            <span className="cc-pass-time">{formatClock(from.time)}</span>
            <span className="cc-pass-place">{from.place}</span>
            {from.meta ? <span className="cc-pass-meta">{from.meta}</span> : null}
          </span>
          <span className="cc-pass-link">
            <span className="ico"><PassIco kind={ticket.kind} /></span>
            <span className="ln" />
            <span className="dur">{durationLabel(ticket)}</span>
          </span>
          <span className="cc-pass-end" data-role="to">
            <span className="cc-pass-time">{formatClock(to.time)}</span>
            <span className="cc-pass-place">{to.place}</span>
            {to.meta ? <span className="cc-pass-meta">{to.meta}</span> : null}
          </span>
        </div>

        <div className="cc-pass-sub">
          {leg?.status ? <StatusStrip status={leg.status} /> : <span />}
          {isStay ? (
            ticket.address ? <span className="cc-pass-seat">{ticket.address}</span> : null
          ) : (
            <span className="cc-pass-seat">{seatLine(ticket)}</span>
          )}
        </div>
      </div>

      {ticket.consequence ? <p className="cc-pass-consequence">{ticket.consequence}</p> : null}

      {stub ? (
        <>
          <div className="cc-pass-perf" />
          <div className="cc-pass-stub">
            {leg?.barcodes?.[0] ? <BarcodePresenter barcode={leg.barcodes[0]} size="inline" /> : null}
            <div className="cc-pass-stub-meta">
              <span className="cc-pass-stub-label">{stub.label}</span>
              <span className="cc-pass-stub-val">{stub.value}</span>
              <button className="cc-pass-show" onClick={() => onShow?.(ticket)}>
                {ticket.kind === "air" ? "Show pass" : "Show ticket"} ›
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

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
