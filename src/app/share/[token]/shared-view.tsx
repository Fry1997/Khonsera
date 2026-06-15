"use client";

import { useEffect, useState } from "react";
import { readSharePosition, type SharePosition } from "@/lib/actions/sharing";

// The recipient's live view — polls the position every 15s while active. Calm and
// minimal: who's sharing, the last-updated time, and a map link. No app chrome.
export function SharedLocationView({ token, initial }: { token: string; initial: SharePosition }) {
  const [pos, setPos] = useState<SharePosition>(initial);

  useEffect(() => {
    if (pos && !pos.active) return; // ended — stop polling
    const t = setInterval(async () => setPos(await readSharePosition(token)), 15_000);
    return () => clearInterval(t);
  }, [token, pos]);

  const who = pos?.recipient ? `${pos.recipient}, someone is` : "Someone is";
  const ended = !pos || !pos.active;

  return (
    <main style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24, background: "var(--paper, #f6efe0)", color: "var(--ink, #1e1812)", fontFamily: "var(--sans, system-ui)", textAlign: "center" }}>
      <span style={{ fontFamily: "var(--mono, monospace)", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--gold-2, #8a6a2f)" }}>Khonsera · live location</span>
      {ended ? (
        <>
          <h1 style={{ fontSize: 22, margin: 0 }}>This share has ended</h1>
          <p style={{ color: "var(--ink-dim, #6b5c46)", maxWidth: "40ch" }}>The live location is no longer being shared. Ask them to send a fresh link if you need it.</p>
        </>
      ) : pos && pos.lat != null && pos.lng != null ? (
        <>
          <h1 style={{ fontSize: 22, margin: 0 }}>{who} sharing their journey</h1>
          <p style={{ color: "var(--ink-dim, #6b5c46)" }}>Last updated {pos.at ? new Date(pos.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—"}</p>
          <a href={`https://www.google.com/maps?q=${pos.lat},${pos.lng}`} target="_blank" rel="noopener noreferrer" style={{ padding: "12px 20px", borderRadius: 8, background: "var(--gold, #b8893f)", color: "#fff", textDecoration: "none", fontWeight: 600 }}>
            View on map
          </a>
          <p style={{ fontFamily: "var(--mono, monospace)", fontSize: 12, color: "var(--ink-dim, #6b5c46)" }}>{pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}</p>
        </>
      ) : (
        <>
          <h1 style={{ fontSize: 22, margin: 0 }}>{who} sharing their journey</h1>
          <p style={{ color: "var(--ink-dim, #6b5c46)" }}>Waiting for their first location update…</p>
        </>
      )}
    </main>
  );
}
