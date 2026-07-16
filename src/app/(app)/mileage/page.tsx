import { listTrips, mileageReport } from "@/lib/actions/mileage";
import { AppScreen } from "@/components/ui/page-shell";
import { MileageLedger } from "@/components/mileage/mileage-ledger";
import { DriveRecorder } from "@/components/mileage/drive-recorder";

// Mileage — the private claim-ready trip ledger (Phase 15). Record a drive (GPS
// route), classify business/personal, and export the HMRC report. Owner-only.
export default async function MileagePage() {
  const [trips, report] = await Promise.all([listTrips(), mileageReport()]);

  return (
    <AppScreen
      eyebrow="Your private record"
      title="Mileage"
      style={{ minHeight: "100%" }}
      contentClassName="cc-mileage-content"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <DriveRecorder />
        <MileageLedger trips={trips} report={report} />
      </div>
    </AppScreen>
  );
}
