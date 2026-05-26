"use client";

import { useState } from "react";

export type TicketCallingPoint = {
  station: string;
  station_code: string | null;
  time: string;
};

export type TicketSegment = {
  from_station: string;
  to_station: string;
  from_station_code: string | null;
  to_station_code: string | null;
  departure_date: string;
  departure_time: string;
  arrival_time: string;
  operator: string | null;
  route_restriction: string | null;
  ticket_type: string | null;
  coach: string | null;
  seat: string | null;
  barcode_ref: string | null;
  barcode_data: string | null;
  price?: number | null;
  calling_points?: TicketCallingPoint[] | null;
};

function formatDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function AztecBarcode({ data, size = 140 }: { data: string; size?: number }) {
  return (
    <img
      src={`/api/barcode?data=${encodeURIComponent(data)}&scale=4`}
      alt="Train ticket barcode"
      width={size}
      height={size}
      style={{ imageRendering: "pixelated" }}
    />
  );
}

export function TrainTicketCard({
  segment,
  direction,
  compact = false,
}: {
  segment: TicketSegment;
  direction?: "outbound" | "return";
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(!compact);

  const fromCode = segment.from_station_code ?? "";
  const toCode = segment.to_station_code ?? "";

  return (
    <div
      className="card"
      style={{
        borderRadius: 14,
        border: "1px solid var(--rule)",
        background: "var(--card)",
        overflow: "hidden",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 14px 0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: "var(--gold-2)" }}>
            <path d="M4 15.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h12v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V5c0-3.5-3.58-4-8-4s-8 .5-8 4v10.5zm4 1a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm8 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm2-6H6V5h12v5.5z" fill="currentColor"/>
          </svg>
          <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-dim)", letterSpacing: "0.08em" }}>
            {formatDate(segment.departure_date)}
          </span>
        </div>
        <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-dim)" }}>
          {fromCode} - {toCode}
        </span>
      </div>

      {/* Station names + arrow */}
      <div style={{ padding: "8px 14px 0", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-faint)" }}>
            {fromCode}
          </div>
          <div style={{ fontFamily: "var(--display)", fontWeight: 500, fontSize: 15, color: "var(--ink)", marginTop: 1 }}>
            {segment.from_station}
          </div>
        </div>
        <svg width="20" height="16" viewBox="0 0 20 16" fill="none" style={{ color: "var(--ink-faint)", flexShrink: 0 }}>
          <path d="M12 0l8 8-8 8-1.4-1.4L16.2 9H0V7h16.2L10.6 1.4z" fill="currentColor"/>
        </svg>
        <div style={{ flex: 1, textAlign: "right" }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-faint)" }}>
            {toCode}
          </div>
          <div style={{ fontFamily: "var(--display)", fontWeight: 500, fontSize: 15, color: "var(--ink)", marginTop: 1 }}>
            {segment.to_station}
          </div>
        </div>
      </div>

      {/* Calling points */}
      {segment.calling_points && segment.calling_points.length > 0 && (
        <CallingPointsStrip points={segment.calling_points} />
      )}

      {/* Ticket details row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "10px 14px",
          gap: 8,
        }}
      >
        <Detail label="Depart" value={segment.departure_time || "--:--"} mono />
        {segment.arrival_time && (
          <Detail label="Arrive" value={segment.arrival_time} mono />
        )}
        {segment.ticket_type && (
          <Detail label="Ticket" value={segment.ticket_type} />
        )}
        {segment.route_restriction && (
          <Detail label="Route" value={segment.route_restriction} />
        )}
      </div>

      {/* Expandable section: barcode + extras */}
      {segment.barcode_data && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          style={{
            width: "100%",
            padding: "6px 14px",
            border: "none",
            borderTop: "1px solid var(--rule)",
            background: "transparent",
            cursor: "pointer",
            fontSize: 10.5,
            fontFamily: "var(--mono)",
            color: "var(--gold-2)",
            fontWeight: 500,
            letterSpacing: "0.06em",
            textAlign: "center",
          }}
        >
          {expanded ? "Hide ticket" : "Show ticket"}
        </button>
      )}

      {expanded && segment.barcode_data && (
        <div
          style={{
            borderTop: "1px solid var(--rule)",
            background: "var(--paper)",
            padding: "16px 14px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
          }}
        >
          <AztecBarcode data={segment.barcode_data} size={160} />
          <span
            className="mono"
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.1em",
              color: "var(--ink)",
            }}
          >
            {segment.barcode_ref}
          </span>

          <div
            style={{
              display: "flex",
              gap: 16,
              justifyContent: "center",
              width: "100%",
              marginTop: 4,
            }}
          >
            {segment.operator && (
              <Detail label="Operator" value={segment.operator} center />
            )}
            {segment.coach && (
              <Detail label="Coach" value={segment.coach} center mono />
            )}
            {segment.seat && (
              <Detail label="Seat" value={segment.seat} center mono />
            )}
            {segment.price != null && segment.price > 0 && (
              <Detail label="Price" value={`£${segment.price.toFixed(2)}`} center mono />
            )}
          </div>
        </div>
      )}

      {/* Non-barcode fallback: show ref inline */}
      {!segment.barcode_data && segment.barcode_ref && (
        <div style={{ padding: "0 14px 10px" }}>
          <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-dim)" }}>
            Ticket: {segment.barcode_ref}
          </span>
        </div>
      )}
    </div>
  );
}

function CallingPointsStrip({ points }: { points: TicketCallingPoint[] }) {
  return (
    <div
      style={{
        padding: "6px 14px 2px",
        display: "flex",
        alignItems: "center",
        gap: 0,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 0,
          flex: 1,
          position: "relative",
        }}
      >
        {/* Connecting line */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: 0,
            right: 0,
            height: 1,
            background: "var(--rule)",
            transform: "translateY(-50%)",
          }}
        />
        {points.map((pt, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              position: "relative",
              zIndex: 1,
            }}
          >
            <span
              style={{
                fontSize: 8.5,
                fontFamily: "var(--mono)",
                color: "var(--ink-faint)",
                letterSpacing: "0.04em",
                marginBottom: 3,
                whiteSpace: "nowrap",
              }}
            >
              {pt.time}
            </span>
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                border: "1px solid var(--ink-faint)",
                background: "var(--card)",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 8,
                fontFamily: "var(--mono)",
                color: "var(--ink-faint)",
                letterSpacing: "0.04em",
                marginTop: 3,
                whiteSpace: "nowrap",
                textTransform: "uppercase",
              }}
            >
              {pt.station_code ?? pt.station}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
  mono,
  center,
}: {
  label: string;
  value: string;
  mono?: boolean;
  center?: boolean;
}) {
  return (
    <div style={{ textAlign: center ? "center" : undefined }}>
      <div
        style={{
          fontSize: 9,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "var(--ink-faint)",
          fontFamily: "var(--mono)",
          fontWeight: 500,
        }}
      >
        {label}
      </div>
      <div
        className={mono ? "mono" : undefined}
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "var(--ink)",
          marginTop: 1,
        }}
      >
        {value}
      </div>
    </div>
  );
}

export function TrainTicketGroup({
  segments,
  bookingRef,
  totalPrice,
  direction,
}: {
  segments: TicketSegment[];
  bookingRef?: string | null;
  totalPrice?: number | null;
  direction?: "outbound" | "return";
}) {
  if (segments.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {bookingRef && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "0 2px" }}>
          <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-dim)", fontWeight: 500 }}>
            Ref: {bookingRef}
          </span>
          {totalPrice != null && totalPrice > 0 && (
            <span style={{ fontFamily: "var(--display)", fontSize: 16, fontWeight: 500, color: "var(--gold-2)" }}>
              {"£"}{totalPrice.toFixed(2)}
            </span>
          )}
        </div>
      )}
      {segments.map((seg, i) => (
        <TrainTicketCard
          key={seg.barcode_ref ?? i}
          segment={seg}
          direction={direction}
          compact={segments.length > 1}
        />
      ))}
    </div>
  );
}
