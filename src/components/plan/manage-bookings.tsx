"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelFlightPreview, cancelFlightConfirm, cancelStayBooking, type BookedConnection } from "@/lib/actions/connections";

// Manage booking (ED-Flight/Stay) — view + cancel the day's Duffel-booked flights
// and stays, with the **refund shown before you commit** (the honest two-step:
// quote → confirm). Change-flight (search new slices) is the positioned next step.
// Functional + `.cc-manage*` contract classes; Design skins later.
export function ManageBookings({ itineraryId, bookings }: { itineraryId: string; bookings: BookedConnection[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [quote, setQuote] = useState<{ stopId: string; cancellationId: string; refund: { amount: string; currency: string } | null } | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!bookings.length) return null;

  function previewFlight(b: Extract<BookedConnection, { kind: "flight" }>) {
    setBusy(b.stopId); setError(null);
    startTransition(async () => {
      const res = await cancelFlightPreview(b.orderId);
      setBusy(null);
      if (!res.ok) return setError(res.error ?? "Couldn't quote a cancellation.");
      setQuote({ stopId: b.stopId, cancellationId: res.cancellationId!, refund: res.refund ?? null });
    });
  }
  function confirmFlight(b: Extract<BookedConnection, { kind: "flight" }>) {
    if (!quote) return;
    setBusy(b.stopId); setError(null);
    startTransition(async () => {
      const res = await cancelFlightConfirm({ cancellationId: quote.cancellationId, departureStopId: b.stopId, itineraryId });
      setBusy(null); setQuote(null); setOpenId(null);
      if (!res.ok) return setError(res.error ?? "Cancellation failed.");
      setDone(`${b.label} cancelled.`);
      router.refresh();
    });
  }
  function cancelStay(b: Extract<BookedConnection, { kind: "stay" }>) {
    setBusy(b.stopId); setError(null);
    startTransition(async () => {
      const res = await cancelStayBooking({ bookingId: b.bookingId, stopId: b.stopId, itineraryId });
      setBusy(null); setOpenId(null);
      if (!res.ok) return setError(res.error ?? "Cancellation failed.");
      setDone(`${b.label} cancelled${res.refund ? ` — ${money(res.refund.amount, res.refund.currency)} refunded` : ""}.`);
      router.refresh();
    });
  }

  return (
    <section className="cc-manage" style={{ border: "1px solid var(--rule)", borderRadius: "var(--radius-lg, 12px)", padding: "var(--space-3) var(--space-4)", background: "var(--card)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <span className="cc-eyebrow">Booked connections</span>
      {done ? <p className="cc-manage-done" style={{ color: "var(--sage, var(--ink))", fontSize: "var(--fs-label)" }}>{done}</p> : null}
      {error ? <p className="cc-manage-error" style={{ color: "var(--rust)", fontSize: "var(--fs-label)" }}>{error}</p> : null}
      {bookings.map((b) => (
        <div key={b.stopId} className="cc-manage-row" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-2)" }}>
          <span style={{ color: "var(--ink)" }}><span style={{ fontFamily: "var(--mono)", fontSize: "var(--fs-micro, 11px)", color: "var(--ink-dim)", textTransform: "uppercase", letterSpacing: "0.08em", marginRight: 8 }}>{b.kind}</span>{b.label}</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: "var(--fs-micro, 11px)", color: "var(--ink-dim)" }}>{b.reference}</span>
          <span style={{ marginLeft: "auto", display: "inline-flex", gap: 8 }}>
            {openId === b.stopId ? (
              b.kind === "flight" && quote?.stopId === b.stopId ? (
                <>
                  <span style={{ fontSize: "var(--fs-label)", color: "var(--ink)" }}>Refund {quote.refund ? money(quote.refund.amount, quote.refund.currency) : "£0"} — confirm?</span>
                  <button type="button" className="cc-btn cc-btn-gold" disabled={pending} onClick={() => confirmFlight(b)}>{busy === b.stopId ? "Cancelling…" : "Confirm cancel"}</button>
                  <button type="button" className="cc-btn cc-btn-ghost" onClick={() => { setQuote(null); setOpenId(null); }}>Keep it</button>
                </>
              ) : b.kind === "stay" ? (
                <>
                  <span style={{ fontSize: "var(--fs-label)", color: "var(--ink)" }}>Cancel this stay?</span>
                  <button type="button" className="cc-btn cc-btn-gold" disabled={pending} onClick={() => cancelStay(b)}>{busy === b.stopId ? "Cancelling…" : "Confirm cancel"}</button>
                  <button type="button" className="cc-btn cc-btn-ghost" onClick={() => setOpenId(null)}>Keep it</button>
                </>
              ) : (
                <button type="button" className="cc-btn cc-btn-ghost" disabled={pending} onClick={() => previewFlight(b as Extract<BookedConnection, { kind: "flight" }>)}>{busy === b.stopId ? "Checking…" : "See refund"}</button>
              )
            ) : (
              <button type="button" className="cc-btn cc-btn-ghost" onClick={() => { setOpenId(b.stopId); setQuote(null); setError(null); }}>Manage</button>
            )}
          </span>
        </div>
      ))}
    </section>
  );
}

function money(amount: string, currency: string): string {
  const n = Number(amount);
  if (Number.isNaN(n)) return `${amount} ${currency}`;
  try { return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(n); } catch { return `${amount} ${currency}`; }
}
