"use client";

import { useState } from "react";
import { TicketCard, ScanView } from "@/components/concierge";
import type { TicketVM, BarcodeVM } from "@/components/concierge";

// Today's promoted document (planner master brief §8.3). As an anchor/leg
// approaches, its TicketCard is surfaced here, one tap from ScanView at the
// barrier — the same item the Wallet floats to the top of today's group.
export function TodayDocument({ ticket }: { ticket: TicketVM }) {
  const [scan, setScan] = useState<{ summary: string; barcodes: BarcodeVM[] } | null>(null);

  function openScan() {
    const leg = ticket.legs[0];
    if (!leg?.barcodes?.length) return;
    setScan({
      summary: `${ticket.operator} · ${leg.origin.place} → ${leg.destination.place}`,
      barcodes: leg.barcodes,
    });
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <div className="cc-eyebrow" style={{ color: "var(--gold-2)" }}>
        Ready when you are
      </div>
      <TicketCard ticket={ticket} variant="full" onScan={openScan} />
      {scan ? (
        <ScanView summary={scan.summary} barcodes={scan.barcodes} onClose={() => setScan(null)} />
      ) : null}
    </section>
  );
}
