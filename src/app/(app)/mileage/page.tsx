import Link from "next/link";
import type { Route } from "next";
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
        {trips.length === 0 ? (
          <div className="cc-empty">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/mk-ink.png" alt="" />
            <p className="cc-empty-title">No trips yet</p>
            <p className="cc-empty-sub">Drive legs from a plan or trips you record here become your mileage ledger.</p>
            <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", justifyContent: "center" }}>
              <Link href={"/plan" as Route} className="cc-btn cc-btn-gold">Open plan</Link>
              <Link href={"/navigate" as Route} className="cc-btn cc-btn-ghost">Navigate</Link>
            </div>
          </div>
        ) : null}
        <MileageLedger trips={trips} report={report} />
      </div>
    </AppScreen>
  );
}
