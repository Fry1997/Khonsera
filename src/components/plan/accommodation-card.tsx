import {
  type AccommodationDetails,
  BOARD_LABELS,
  CHANNEL_LABELS,
} from "@/lib/accommodation/types";

// ED1 — the stay's ARRIVAL PAYLOAD: everything you need on the day so the
// Hilton/Booking app is redundant. Rendered beneath the accommodation anchor on
// the plan spine. Read-only surface; capture/edit lives in PlanAdd.

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="cc-acc-row">
      <span className="cc-acc-label">{label}</span>
      <span className="cc-acc-value">{children}</span>
    </div>
  );
}

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" }).format(new Date(iso));
}

export function AccommodationCard({ a }: { a: AccommodationDetails }) {
  const room = [a.room_type, a.board_basis ? BOARD_LABELS[a.board_basis] : null].filter(Boolean).join(" · ");
  return (
    <div className="cc-acc-card">
      <div className="cc-acc-head">
        <span className="cc-acc-eyebrow">Your stay</span>
        {a.channel ? <span className="cc-acc-channel">{CHANNEL_LABELS[a.channel]}</span> : null}
      </div>
      {room ? <Row label="Room">{room}</Row> : null}
      {a.confirmation_ref ? <Row label="Confirmation">{a.confirmation_ref}</Row> : null}
      {a.phone ? (
        <Row label="Hotel">
          <a href={`tel:${a.phone}`} className="cc-acc-link">{a.phone}</a>
        </Row>
      ) : null}
      {a.access_instructions ? <Row label="Check-in">{a.access_instructions}</Row> : null}
      {a.wifi_ssid ? (
        <Row label="Wi-Fi">
          {a.wifi_ssid}{a.wifi_password ? <span className="cc-acc-mono"> · {a.wifi_password}</span> : null}
        </Row>
      ) : null}
      {a.parking_info ? <Row label="Parking">{a.parking_info}</Row> : null}
      {a.breakfast_window ? <Row label="Breakfast">{a.breakfast_window}</Row> : null}
      {a.cancellation_policy || a.free_cancel_until ? (
        <Row label="Cancellation">
          {a.cancellation_policy ?? "Free cancellation"}
          {a.free_cancel_until ? <span className="cc-acc-mono"> · until {fmtDate(a.free_cancel_until)}</span> : null}
        </Row>
      ) : null}
      {a.price ? <Row label="Price">{a.price}</Row> : null}
    </div>
  );
}
