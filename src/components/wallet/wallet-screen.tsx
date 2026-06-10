"use client";

import { useMemo, useState } from "react";
import { TicketCard, ScanView } from "@/components/concierge";
import type { TicketVM, BarcodeVM } from "@/components/concierge";
import { ticketUseMoment } from "@/components/concierge";

// The Wallet (planner master brief §7) — document-centric: every booking across
// trips, grouped by date, ordered within a date by *time-needed* (§7.1). Reuses
// the booked-document family (compact TicketCard + StatusStrip + ScanView); adds
// NO new components. ScanView opens straight from a card for the barrier. The
// list + barcodes are a hard offline requirement (§7.3) — wired at materialise.

type Group = { key: string; label: string; tickets: TicketVM[] };

export function WalletScreen({ tickets }: { tickets: TicketVM[] }) {
  const [scan, setScan] = useState<{ summary: string; barcodes: BarcodeVM[] } | null>(null);

  const groups = useMemo(() => groupByDate(tickets), [tickets]);

  if (tickets.length === 0) {
    return (
      <div className="cc-wallet-empty">
        <p className="cc-wallet-empty-lead">Your tickets will live here.</p>
        <p className="cc-wallet-empty-sub">
          Every booking across your trips — grouped by day, the next one you need
          on top, ready to scan even without signal. Forward a confirmation or add
          one to begin.
        </p>
      </div>
    );
  }

  return (
    <div className="cc-wallet">
      {groups.map((g) => (
        <section key={g.key} className="cc-wallet-group">
          <h2 className="cc-wallet-group-head">{g.label}</h2>
          <div className="cc-wallet-list">
            {g.tickets.map((t) => (
              <TicketCard
                key={t.id}
                ticket={t}
                variant="compact"
                onScan={(_id, legId) => openScan(t, legId, setScan)}
                onSelect={() => openScan(t, t.legs[0]?.id, setScan)}
              />
            ))}
          </div>
        </section>
      ))}

      {scan ? (
        <ScanView summary={scan.summary} barcodes={scan.barcodes} onClose={() => setScan(null)} />
      ) : null}
    </div>
  );
}

function openScan(
  t: TicketVM,
  legId: string | undefined,
  set: (s: { summary: string; barcodes: BarcodeVM[] } | null) => void,
) {
  const leg = t.legs.find((l) => l.id === legId) ?? t.legs[0];
  if (!leg?.barcodes?.length) return; // stays etc. have no barcode
  const summary = `${t.operator} · ${leg.origin.place} → ${leg.destination.place}`;
  set({ summary, barcodes: leg.barcodes });
}

// Group by calendar day of the use-moment; order groups chronologically and
// tickets within a group by time-needed. Today / Tomorrow / dated headers.
function groupByDate(tickets: TicketVM[]): Group[] {
  const withMoment = tickets
    .map((t) => ({ t, m: ticketUseMoment(t) }))
    .filter((x): x is { t: TicketVM; m: string } => Boolean(x.m))
    .sort((a, b) => a.m.localeCompare(b.m));

  const map = new Map<string, Group>();
  for (const { t, m } of withMoment) {
    const d = new Date(m);
    const key = dayKey(d);
    const g = map.get(key) ?? { key, label: dayLabel(d), tickets: [] };
    g.tickets.push(t);
    map.set(key, g);
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayLabel(d: Date): string {
  const today = new Date();
  const t0 = dayKey(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const k = dayKey(d);
  if (k === t0) return "Today";
  if (k === dayKey(tomorrow)) return "Tomorrow";
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(d);
}
