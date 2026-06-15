import { listTrips, mileageReport } from "@/lib/actions/mileage";
import { MileageLedger } from "@/components/mileage/mileage-ledger";
import { DriveRecorder } from "@/components/mileage/drive-recorder";

// Mileage — the private claim-ready trip ledger (Phase 15). Record a drive (GPS
// route), classify business/personal, and export the HMRC report. Owner-only.
export default async function MileagePage() {
  const [trips, report] = await Promise.all([listTrips(), mileageReport()]);

  return (
    <div className="cc-screen" style={{ minHeight: "100%" }}>
      <header style={{ marginBottom: "var(--space-4)" }}>
        <span className="cc-eyebrow">Your private record</span>
        <h1 className="cc-screen-title" style={{ marginTop: 6 }}>Mileage</h1>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <DriveRecorder />
        <MileageLedger trips={trips} report={report} />
      </div>
    </div>
  );
}
