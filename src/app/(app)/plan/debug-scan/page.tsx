import { debugScanTrainline } from "@/lib/actions/gmail";

// TEMPORARY diagnostic surface. Dumps what the Gmail scanner sees + parses for
// every matching email, so we can see why a booking's times aren't extracted
// (especially the anytime-day-return confirmation vs eticket). Read-only.
export default async function DebugScanPage() {
  const res = await debugScanTrainline();

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

  const dump = JSON.stringify(res.value.rows, null, 2);

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontFamily: "var(--display)" }}>Scan debug — {res.value.rows.length} emails</h1>
      <p className="small">
        Copy everything in the box below and paste it back to Khonsera so the parser can be fixed.
        This page is temporary.
      </p>
      <textarea
        readOnly
        value={dump}
        style={{
          width: "100%",
          height: "70vh",
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
