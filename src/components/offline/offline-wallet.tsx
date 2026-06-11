"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Pass, ScanView, ticketUseMoment } from "@/components/concierge";
import type { TicketVM, BarcodeVM } from "@/components/concierge";
import { loadWalletSnapshot } from "@/lib/offline/ticket-cache";

// The emergency ticket surface, served by the service worker when a navigation
// can't reach the network. Reads the on-device snapshot and renders the passes
// with their Aztec (drawn locally) — so the barrier always has your code, signal
// or not. No server calls, no remove (mutations need the network).

function fmtSaved(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function OfflineWallet() {
  const [tickets, setTickets] = useState<TicketVM[] | null>(null);
  const [savedAt, setSavedAt] = useState<string | undefined>();
  const [scan, setScan] = useState<{ summary: string; barcodes: BarcodeVM[] } | null>(null);

  useEffect(() => {
    let active = true;
    void loadWalletSnapshot().then((snap) => {
      if (!active) return;
      setSavedAt(snap?.savedAt);
      const sorted = (snap?.tickets ?? [])
        .map((t) => ({ t, m: ticketUseMoment(t) ?? "" }))
        .sort((a, b) => a.m.localeCompare(b.m))
        .map((x) => x.t);
      setTickets(sorted);
    });
    return () => {
      active = false;
    };
  }, []);

  function openScan(t: TicketVM) {
    const leg = t.legs[0];
    if (!leg?.barcodes?.length) return;
    setScan({ summary: `${t.operator} · ${leg.origin.place} → ${leg.destination.place}`, barcodes: leg.barcodes });
  }

  return (
    <div className="cc-screen">
      <header>
        <span className="cc-eyebrow">Offline · Saved tickets</span>
        <h1 className="cc-screen-title" style={{ marginTop: 6 }}>
          Your tickets
        </h1>
        {savedAt ? (
          <p style={{ marginTop: 4, fontSize: "var(--fs-micro)", color: "var(--ink-dim)" }}>
            Last saved {fmtSaved(savedAt)}. Connect to refresh.
          </p>
        ) : null}
      </header>

      {tickets === null ? (
        <p className="cc-at-sub">Reaching for your saved tickets…</p>
      ) : tickets.length === 0 ? (
        <div className="cc-active-tile" data-urgency="comfortable">
          <h2 className="cc-at-headline">No tickets saved yet</h2>
          <p className="cc-at-sub">
            Open your Wallet or Today once with signal and Khonsera keeps your tickets here for the
            barrier — ready to scan offline.
          </p>
          <div style={{ marginTop: "var(--space-4)" }}>
            <Link href={"/today" as Route} className="cc-btn cc-btn-gold">
              Try Today
            </Link>
          </div>
        </div>
      ) : (
        <div className="cc-wallet cc-wallet--lux">
          <div className="cc-pass-stack" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {tickets.map((t) => (
              <Pass key={t.id} ticket={t} onShow={openScan} />
            ))}
          </div>
        </div>
      )}

      {scan ? <ScanView summary={scan.summary} barcodes={scan.barcodes} onClose={() => setScan(null)} /> : null}
    </div>
  );
}
