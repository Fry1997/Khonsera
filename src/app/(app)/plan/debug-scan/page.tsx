import { scanGmailForBookings, debugTrainlinePdfs } from "@/lib/actions/gmail";

// TEMPORARY diagnostic surface. Shows (1) the bookings import would receive after
// enrichment + merge, and (2) per-PDF detail for Trainline etickets — did the
// text parse give from/to, and did the Aztec decode? Read-only.
export default async function DebugScanPage() {
  const [res, pdfRes] = await Promise.all([scanGmailForBookings(), debugTrainlinePdfs()]);

  const scanView = res.ok
    ? res.value.bookings.map((b) =>
        b.type === "transport"
          ? {
              kind: "transport",
              subject: b.raw_subject,
              ref: b.booking_reference,
              price: b.price,
              segments: b.segments.map((s) => ({
                from: s.from_station,
                to: s.to_station,
                dep: s.departure_time,
                arr: s.arrival_time,
                barcode: s.barcode_data ? "yes" : s.barcode_ref ? "ref-only" : "no",
              })),
            }
          : { kind: b.type, subject: b.raw_subject },
      )
    : { error: res.error.kind === "integration" ? res.error.reason : "scan failed" };

  const pdfView = pdfRes.ok
    ? pdfRes.value.rows
    : { error: pdfRes.error.kind === "integration" ? pdfRes.error.reason : "pdf debug failed" };

  const dump = JSON.stringify({ bookings: scanView, pdfDetail: pdfView }, null, 2);

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontFamily: "var(--display)" }}>Scan debug</h1>
      <p className="small">
        “bookings” is what Import receives; “pdfDetail” shows whether each eticket PDF parsed + its
        Aztec decoded. Copy the box and paste it back to Khonsera. Temporary page.
      </p>
      <textarea
        readOnly
        value={dump}
        style={{
          width: "100%",
          height: "72vh",
          fontFamily: "var(--mono)",
          fontSize: 11,
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
