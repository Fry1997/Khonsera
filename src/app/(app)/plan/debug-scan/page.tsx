import { scanGmailForBookings } from "@/lib/actions/gmail";

// TEMPORARY diagnostic surface. Runs the REAL scan (PDF enrichment + merge) and
// dumps the bookings the import would receive — so we can see whether a booking's
// times survived the confirmation/eticket reconciliation. Read-only.
export default async function DebugScanPage() {
  const res = await scanGmailForBookings();

  if (!res.ok) {
    return (
      <div style={{ padding: 24, fontFamily: "var(--mono)" }}>
        <h1>Scan debug</h1>
        <p style={{ color: "var(--rust)" }}>
          {res.error.kind === "integration" ? res.error.reason : "Failed to scan."}
        </p>
      </div>
    );
  }

  // Compact, readable view of exactly what import would get.
  const view = res.value.bookings.map((b) =>
    b.type === "transport"
      ? {
          kind: "transport",
          subject: b.raw_subject,
          ref: b.booking_reference,
          price: b.price,
          segments: b.segments.map((s) => ({
            from: s.from_station,
            to: s.to_station,
            date: s.departure_date,
            dep: s.departure_time,
            arr: s.arrival_time,
            barcode: s.barcode_data ? "yes" : s.barcode_ref ? "ref-only" : "no",
          })),
        }
      : { kind: b.type, subject: b.raw_subject },
  );
  const dump = JSON.stringify(view, null, 2);

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontFamily: "var(--display)" }}>
        Scan debug — {res.value.bookings.length} bookings (scanned {res.value.scanned_count})
      </h1>
      <p className="small">
        This is exactly what “Import” receives. Copy the box and paste it back to Khonsera. Temporary page.
      </p>
      <textarea
        readOnly
        value={dump}
        style={{
          width: "100%",
          height: "70vh",
          fontFamily: "var(--mono)",
          fontSize: 12,
          whiteSpace: "pre",
          padding: 12,
          marginTop: 12,
          border: "1px solid var(--rule)",
          borderRadius: 8,
        }}
      />
    </div>
  );
}
