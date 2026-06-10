"use client";

import { useState } from "react";
import type {
  BarcodeVM,
  StatusVM,
  TicketVM,
  TicketLegVM,
} from "./types";
import { STATUS_LABEL, formatClock, formatMoney } from "./types";

// Booked-document family (planner master brief §6). Placeholders now — Code owns
// the names, the DOM contract (`.cc-*` + data-* states) and the data; Design
// owns the look via an additive elevation layer. The single exception is
// ScanView: function over finish — it must actually scan, so Design must not
// "elevate" it into something unscannable (§6.3). These compose into the
// planner's booked legs, Today's promoted document, and the Wallet.

/* ===========================================================================
 * StatusStrip — live status line (on-time / delayed / platform / cancelled).
 * `stale` + offline = last-known, shown at the barrier without signal.
 * ========================================================================= */

export function StatusStrip({ status }: { status: StatusVM }) {
  const label = status.label ?? STATUS_LABEL[status.status];
  return (
    <div
      className="cc-status-strip"
      data-status={status.status}
      data-offline={status.offline ? "" : undefined}
      role="status"
    >
      <span className="cc-status-dot" aria-hidden />
      <span className="cc-status-label">{label}</span>
      {status.detail ? <span className="cc-status-detail">{status.detail}</span> : null}
      {status.offline ? <span className="cc-status-stale">offline</span> : null}
    </div>
  );
}

/* ===========================================================================
 * BarcodePresenter — renders the scannable code. The Aztec/PDF417/QR *is* the
 * ticket, so the frame matters: quiet zone, high contrast, nothing overlaid.
 * The actual symbology pixels are generated at wire-up (a pure-JS encoder);
 * this placeholder reserves the framed, correctly-proportioned surface and
 * carries `data-format` so Design styles per symbology.
 * ========================================================================= */

export function BarcodePresenter({
  barcode,
  size = "inline",
}: {
  barcode: BarcodeVM;
  size?: "inline" | "scan";
}) {
  return (
    <div className="cc-barcode" data-format={barcode.format} data-size={size}>
      {/* Quiet zone is part of the component, never encroached. */}
      <div className="cc-barcode-quiet">
        <div className="cc-barcode-code" aria-label={`${barcode.format} code`}>
          {/* Symbology pixels injected here at wire-up. */}
          <span className="cc-barcode-pending">{barcode.format.toUpperCase()}</span>
        </div>
      </div>
      {barcode.passengerLabel ? (
        <span className="cc-barcode-passenger">{barcode.passengerLabel}</span>
      ) : null}
    </div>
  );
}

/* ===========================================================================
 * ScanView — fullscreen presentation at the barrier. Code large + centred,
 * brightness maxed, minimal chrome, a one-line journey summary above for the
 * guard, swipeable stack for multiple passengers. THE function-over-finish
 * surface (§6.3).
 * ========================================================================= */

export function ScanView({
  summary,
  barcodes,
  onClose,
}: {
  summary: string;
  barcodes: BarcodeVM[];
  onClose?: () => void;
}) {
  const [i, setI] = useState(0);
  const many = barcodes.length > 1;
  const current = barcodes[Math.min(i, barcodes.length - 1)];

  return (
    <div className="cc-scanview" data-format={current?.format} role="dialog" aria-modal>
      <div className="cc-scanview-bar">
        <span className="cc-scanview-summary">{summary}</span>
        {onClose ? (
          <button className="cc-scanview-close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        ) : null}
      </div>

      {current ? <BarcodePresenter barcode={current} size="scan" /> : null}

      {many ? (
        <div className="cc-scanview-pager">
          <button
            className="cc-scanview-step"
            onClick={() => setI((n) => Math.max(0, n - 1))}
            disabled={i === 0}
            aria-label="Previous passenger"
          >
            ‹
          </button>
          <div className="cc-scanview-dots" role="tablist">
            {barcodes.map((b, n) => (
              <span key={b.passengerLabel ?? n} className="cc-scanview-dot" data-active={n === i ? "" : undefined} />
            ))}
          </div>
          <button
            className="cc-scanview-step"
            onClick={() => setI((n) => Math.min(barcodes.length - 1, n + 1))}
            disabled={i === barcodes.length - 1}
            aria-label="Next passenger"
          >
            ›
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* ===========================================================================
 * TicketCard — the booked-document card. `data-kind` = rail | air | stay |
 * ground; `data-variant` = compact (Wallet/Today list) | full (open). For a
 * return booking (legs.length === 2) the outbound + inbound are stepped by a
 * chevron with a live consequence band.
 * ========================================================================= */

export function TicketCard({
  ticket,
  variant = "full",
  onScan,
  onSelect,
}: {
  ticket: TicketVM;
  variant?: "compact" | "full";
  onScan?: (ticketId: string, legId: string) => void;
  onSelect?: (ticketId: string) => void;
}) {
  const [legIndex, setLegIndex] = useState(0);
  const pair = ticket.legs.length > 1;
  const leg = ticket.legs[Math.min(legIndex, ticket.legs.length - 1)];

  if (ticket.kind === "stay") {
    return <StayCard ticket={ticket} variant={variant} onSelect={onSelect} />;
  }

  return (
    <article
      className="cc-ticket"
      data-kind={ticket.kind}
      data-variant={variant}
      data-source={ticket.source}
      onClick={onSelect ? () => onSelect(ticket.id) : undefined}
      style={onSelect ? { cursor: "pointer" } : undefined}
    >
      <header className="cc-ticket-head">
        <span className="cc-ticket-operator">
          {ticket.operator}
          {ticket.operatorSecondary ? ` · ${ticket.operatorSecondary}` : ""}
        </span>
        {ticket.reference ? (
          <span className="cc-ticket-ref" title="Booking reference">
            {ticket.reference}
          </span>
        ) : null}
      </header>

      {/* Booking-pair stepper (outbound ↔ return) */}
      {pair ? (
        <div className="cc-ticket-pair">
          <button
            className="cc-ticket-chev"
            onClick={(e) => { e.stopPropagation(); setLegIndex((n) => Math.max(0, n - 1)); }}
            disabled={legIndex === 0}
            aria-label="Outbound"
          >
            ‹
          </button>
          <span className="cc-ticket-pair-label">
            {legIndex === 0 ? "Outbound" : "Return"}
          </span>
          <button
            className="cc-ticket-chev"
            onClick={(e) => { e.stopPropagation(); setLegIndex((n) => Math.min(ticket.legs.length - 1, n + 1)); }}
            disabled={legIndex === ticket.legs.length - 1}
            aria-label="Return"
          >
            ›
          </button>
        </div>
      ) : null}

      {leg ? <TicketJourney leg={leg} kind={ticket.kind} variant={variant} /> : null}

      {/* The live consequence band — why this booking matters to the rest of
          the plan ("this return → leave the museum by 16:10"). */}
      {ticket.consequence ? (
        <p className="cc-ticket-consequence">{ticket.consequence}</p>
      ) : null}

      {leg?.status ? <StatusStrip status={leg.status} /> : null}

      {variant === "full" ? (
        <footer className="cc-ticket-actions">
          {leg?.barcodes?.length && onScan ? (
            <button
              className="cc-btn cc-btn-gold cc-ticket-action"
              onClick={(e) => { e.stopPropagation(); onScan(ticket.id, leg.id); }}
            >
              Show ticket
            </button>
          ) : null}
          {ticket.price != null ? (
            <span className="cc-ticket-price">
              {formatMoney(ticket.price, ticket.currency)}
            </span>
          ) : null}
        </footer>
      ) : null}
    </article>
  );
}

function TicketJourney({
  leg,
  kind,
  variant,
}: {
  leg: TicketLegVM;
  kind: TicketVM["kind"];
  variant: "compact" | "full";
}) {
  return (
    <div className="cc-ticket-journey">
      <div className="cc-ticket-endpoints">
        <Endpoint stop={leg.origin} role="origin" kind={kind} />
        <span className="cc-ticket-arrow" aria-hidden>→</span>
        <Endpoint stop={leg.destination} role="destination" kind={kind} />
      </div>

      {/* Changes (rail) — each connection, transfer time, tight-connection flag */}
      {variant === "full" && leg.changes?.length ? (
        <ul className="cc-ticket-changes">
          {leg.changes.map((c, n) => (
            <li key={`${c.place}-${n}`} className="cc-ticket-change" data-tight={c.tight ? "" : undefined}>
              <span className="cc-ticket-change-place">{c.place}</span>
              {c.transferMinutes != null ? (
                <span className="cc-ticket-change-transfer">{c.transferMinutes}m to change</span>
              ) : null}
              {c.platform ? <span className="cc-ticket-change-platform">Plat {c.platform}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {/* Seat / coach / class / ticket-type / air detail */}
      {variant === "full" ? (
        <dl className="cc-ticket-detail">
          {leg.coach || leg.seat ? (
            <Detail label="Seat" value={[leg.coach && `Coach ${leg.coach}`, leg.seat].filter(Boolean).join(" · ")} />
          ) : null}
          {leg.travelClass ? <Detail label="Class" value={leg.travelClass} /> : null}
          {leg.ticketType ? <Detail label="Ticket" value={leg.ticketType} /> : null}
          {leg.boardingTime ? <Detail label="Boarding" value={formatClock(leg.boardingTime)} /> : null}
          {leg.boardingZone ? <Detail label="Zone" value={leg.boardingZone} /> : null}
          {leg.baggage ? <Detail label="Baggage" value={leg.baggage} /> : null}
          {leg.restrictions ? <Detail label="Restrictions" value={leg.restrictions} /> : null}
        </dl>
      ) : null}
    </div>
  );
}

function Endpoint({
  stop,
  role,
  kind,
}: {
  stop: { place: string; code?: string; time?: string; platform?: string };
  role: "origin" | "destination";
  kind: TicketVM["kind"];
}) {
  const platLabel = kind === "air" ? "Gate" : "Plat";
  return (
    <div className="cc-ticket-endpoint" data-role={role}>
      <span className="cc-ticket-time">{formatClock(stop.time)}</span>
      <span className="cc-ticket-place">
        {stop.place}
        {stop.code ? <span className="cc-ticket-code"> {stop.code}</span> : null}
      </span>
      {stop.platform ? (
        <span className="cc-ticket-platform">{platLabel} {stop.platform}</span>
      ) : null}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="cc-ticket-detail-row">
      <dt className="cc-ticket-detail-label">{label}</dt>
      <dd className="cc-ticket-detail-value">{value}</dd>
    </div>
  );
}

function StayCard({
  ticket,
  variant,
  onSelect,
}: {
  ticket: TicketVM;
  variant: "compact" | "full";
  onSelect?: (id: string) => void;
}) {
  return (
    <article
      className="cc-ticket"
      data-kind="stay"
      data-variant={variant}
      data-source={ticket.source}
      onClick={onSelect ? () => onSelect(ticket.id) : undefined}
      style={onSelect ? { cursor: "pointer" } : undefined}
    >
      <header className="cc-ticket-head">
        <span className="cc-ticket-operator">{ticket.operator}</span>
        {ticket.reference ? <span className="cc-ticket-ref">{ticket.reference}</span> : null}
      </header>
      {ticket.address ? <p className="cc-ticket-address">{ticket.address}</p> : null}
      <div className="cc-ticket-endpoints" data-stay>
        <div className="cc-ticket-endpoint" data-role="origin">
          <span className="cc-ticket-time">{formatClock(ticket.checkIn)}</span>
          <span className="cc-ticket-place">Check in</span>
        </div>
        <span className="cc-ticket-arrow" aria-hidden>→</span>
        <div className="cc-ticket-endpoint" data-role="destination">
          <span className="cc-ticket-time">{formatClock(ticket.checkOut)}</span>
          <span className="cc-ticket-place">Check out</span>
        </div>
      </div>
      {variant === "full" ? (
        <dl className="cc-ticket-detail">
          {ticket.roomType ? <Detail label="Room" value={ticket.roomType} /> : null}
          {ticket.nights != null ? <Detail label="Nights" value={String(ticket.nights)} /> : null}
          {ticket.contact ? <Detail label="Contact" value={ticket.contact} /> : null}
          {ticket.price != null ? <Detail label="Price" value={formatMoney(ticket.price, ticket.currency)} /> : null}
        </dl>
      ) : null}
    </article>
  );
}
