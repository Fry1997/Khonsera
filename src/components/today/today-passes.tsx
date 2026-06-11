"use client";

import { useState } from "react";
import { LivePass } from "@/components/plan/live-pass";
import { ScanView } from "@/components/concierge";
import type { TicketVM, BarcodeVM } from "@/components/concierge";

// Today's promoted travel: each booked rail HOP as its own live rail card (user
// request — a card per station-to-station leg, platform + times + live status),
// one tap from ScanView at the barrier. Rendered when a journey is approaching /
// in motion; otherwise Today shows the day's anchors only.
export function TodayPasses({
  legs,
}: {
  legs: Array<{ key: string; ticket: TicketVM; crs: string | null; time: string | null; dest: string | null }>;
}) {
  const [scan, setScan] = useState<{ summary: string; barcodes: BarcodeVM[] } | null>(null);

  function openScan(ticket: TicketVM) {
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
      {legs.map((l) => (
        <LivePass key={l.key} ticket={l.ticket} crs={l.crs} time={l.time} dest={l.dest} onShow={openScan} />
      ))}
      {scan ? <ScanView summary={scan.summary} barcodes={scan.barcodes} onClose={() => setScan(null)} /> : null}
    </section>
  );
}
