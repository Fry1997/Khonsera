"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { searchFlightOffers, bookFlightOffer } from "@/lib/actions/connections";
import type { Offer } from "@/lib/connections/types";

// Flight finder (Phase 14) — search → compare → book, the connections framework's
// live path (Duffel, real against test mode). The booked flight lands in the day as
// a flight run. Functional + on-token + `.cc-conn-*` contract classes; Design skins
// later (handoff logged). The "· sample" cue shows when the provider is mocked.
export function FlightFinder({ itineraryId, defaultDate }: { itineraryId: string; defaultDate: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [sample, setSample] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<string | null>(null);

  function search() {
    setError(null);
    setConfirmed(null);
    startTransition(async () => {
      const res = await searchFlightOffers({ itineraryId, origin, destination, departureDate: date, adults: 1, cabin: "economy" });
      if (res.error) {
        setError(res.error);
        setOffers(null);
        return;
      }
      setOffers(res.offers);
      setSample(res.sample);
    });
  }

  function book(offer: Offer) {
    setBusyId(offer.id);
    setError(null);
    startTransition(async () => {
      const res = await bookFlightOffer({ itineraryId, offer: { id: offer.id, title: offer.title, price: offer.price, startIso: offer.startIso, endIso: offer.endIso, detail: offer.detail } });
      setBusyId(null);
      if (!res.ok) {
        setError(res.error ?? "Couldn't book that.");
        return;
      }
      setConfirmed(res.booking?.reference ?? "booked");
      setOffers(null);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button type="button" className="cc-btn cc-btn-ghost" onClick={() => setOpen(true)}>
        Find a flight
      </button>
    );
  }

  return (
    <section className="cc-conn" style={{ width: "100%", border: "1px solid var(--rule)", borderRadius: "var(--radius-lg, 12px)", padding: "var(--space-4)", background: "var(--card)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <div className="cc-conn-head" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span className="cc-eyebrow">Find a flight{sample ? " · sample" : ""}</span>
        <button type="button" className="cc-conn-close" onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "var(--ink-dim)", cursor: "pointer", fontFamily: "var(--mono)", fontSize: "var(--fs-micro, 11px)" }}>
          Close
        </button>
      </div>

      <div className="cc-conn-form" style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
        <input className="cc-field" placeholder="From (LHR)" value={origin} maxLength={3} onChange={(e) => setOrigin(e.target.value.toUpperCase())} style={{ width: 96 }} />
        <input className="cc-field" placeholder="To (JFK)" value={destination} maxLength={3} onChange={(e) => setDestination(e.target.value.toUpperCase())} style={{ width: 96 }} />
        <input className="cc-field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button type="button" className="cc-btn cc-btn-ghost" onClick={search} disabled={pending || origin.length !== 3 || destination.length !== 3}>
          {pending && !busyId ? "Searching…" : "Search"}
        </button>
      </div>

      {error ? <p className="cc-conn-error" style={{ color: "var(--rust)", fontSize: "var(--fs-label)" }}>{error}</p> : null}
      {confirmed ? (
        <p className="cc-conn-confirmed" style={{ color: "var(--sage, var(--ink))", fontSize: "var(--fs-label)" }}>
          Booked — reference {confirmed}. It&rsquo;s on your day.
        </p>
      ) : null}

      {offers && offers.length > 0 ? (
        <ul className="cc-conn-list" style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          {offers.map((o) => (
            <li key={o.id} className="cc-conn-offer" style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "var(--space-3)", alignItems: "center", padding: "var(--space-3)", border: "1px solid var(--rule)", borderRadius: "var(--radius-md, 6px)" }}>
              <span>
                <span className="cc-conn-offer-title" style={{ display: "block", color: "var(--ink)" }}>{o.title}</span>
                <span className="cc-conn-offer-summary" style={{ display: "block", fontSize: "var(--fs-micro, 11px)", color: "var(--ink-dim)", fontFamily: "var(--mono)" }}>{o.summary}</span>
              </span>
              <span className="cc-conn-offer-price" style={{ fontFamily: "var(--mono)", color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
                {money(o.price.amount, o.price.currency)}
              </span>
              <button type="button" className="cc-btn cc-btn-gold" onClick={() => book(o)} disabled={pending}>
                {busyId === o.id ? "Booking…" : "Book"}
              </button>
            </li>
          ))}
        </ul>
      ) : offers && offers.length === 0 ? (
        <p className="cc-conn-empty" style={{ fontSize: "var(--fs-label)", color: "var(--ink-dim)" }}>No fares found for that route and date.</p>
      ) : null}
    </section>
  );
}

function money(amount: string, currency: string): string {
  const n = Number(amount);
  if (Number.isNaN(n)) return `${amount} ${currency}`;
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(n);
  } catch {
    return `${amount} ${currency}`;
  }
}
