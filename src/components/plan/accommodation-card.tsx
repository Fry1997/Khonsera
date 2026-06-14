import {
  type AccommodationDetails,
  BOARD_LABELS,
  CHANNEL_LABELS,
} from "@/lib/accommodation/types";

// ED1 hero — the stay's ARRIVAL PAYLOAD as an issued stay-document, so the
// Hilton/Booking app is redundant. Markup carries Design's Edition III contract
// (gold seam via .cc-acc-head, name/board, Call channel button, label/value rows
// with data-kind); the skin lives in khonsera-edition-iii.css.

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" }).format(new Date(iso));
}

function Row({ label, kind, mono, children }: { label: string; kind?: "cancellation" | "price"; mono?: boolean; children: React.ReactNode }) {
  return (
    <div className="cc-acc-row" data-kind={kind}>
      <span className="cc-acc-label">{label}</span>
      <span className={mono ? "cc-acc-value cc-acc-mono" : "cc-acc-value"}>{children}</span>
    </div>
  );
}

export function AccommodationCard({ a }: { a: AccommodationDetails }) {
  const board = [a.room_type, a.board_basis ? BOARD_LABELS[a.board_basis] : null].filter(Boolean).join(" · ");
  return (
    <div className="cc-acc-card">
      <div className="cc-acc-head">
        <div>
          <div className="cc-acc-eyebrow">Your stay</div>
          <div className="cc-acc-name">{a.property_name ?? "Hotel"}</div>
          {board ? <div className="cc-acc-board">{board}</div> : null}
        </div>
        {a.phone ? (
          <a className="cc-acc-channel" href={`tel:${a.phone}`}>Call</a>
        ) : null}
      </div>

      <div className="cc-acc-body">
        {a.channel ? <Row label="Booked via">{CHANNEL_LABELS[a.channel]}</Row> : null}
        {a.confirmation_ref ? <Row label="Confirmation" mono>{a.confirmation_ref}</Row> : null}
        {a.access_instructions ? <Row label="Check-in">{a.access_instructions}</Row> : null}
        {a.wifi_ssid ? (
          <Row label="Wi-Fi">
            {a.wifi_ssid}
            {a.wifi_password ? <span className="cc-acc-mono"> · {a.wifi_password}</span> : null}
          </Row>
        ) : null}
        {a.parking_info ? <Row label="Parking">{a.parking_info}</Row> : null}
        {a.breakfast_window ? <Row label="Breakfast">{a.breakfast_window}</Row> : null}
        {a.cancellation_policy || a.free_cancel_until ? (
          <Row label="Cancellation" kind="cancellation">
            {a.cancellation_policy ?? "Free cancellation"}
            {a.free_cancel_until ? ` · until ${fmtDate(a.free_cancel_until)}` : ""}
          </Row>
        ) : null}
        {a.price ? <Row label="Price" kind="price">{a.price}</Row> : null}
      </div>
    </div>
  );
}
