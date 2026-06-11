"use client";

import { useEffect } from "react";
import type { TicketVM } from "@/components/concierge";
import { saveWalletSnapshot } from "@/lib/offline/ticket-cache";

// Mirrors the day's booked tickets to the on-device cache whenever a surface that
// has them (Wallet, Today) renders online — so /offline can show the Aztec with
// no signal. Renders nothing; purely a write-through. Skips empty sets so a
// transient empty load never wipes a good snapshot.
export function OfflineTicketSync({ tickets }: { tickets: TicketVM[] }) {
  useEffect(() => {
    if (!tickets.length) return;
    void saveWalletSnapshot(tickets);
  }, [tickets]);
  return null;
}
