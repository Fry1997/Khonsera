"use client";

import { useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { searchFlightOffers, bookFlightOffer, searchStayOffers, bookStayOffer } from "@/lib/actions/connections";
import type { Offer } from "@/lib/connections/types";

export type DefaultPassenger = { givenName: string; familyName: string; email: string };
export type StayDestination = { lat: number; lng: number; label: string };

type Mode = "flight" | "stay";
type Passenger = { title: "mr" | "ms" | "mrs" | "miss"; givenName: string; familyName: string; bornOn: string; gender: "m" | "f"; email: string; phoneNumber: string };

// Connections finder (Phase 14) — the search → compare → book surface for the
// connections framework. Flights run LIVE against Duffel test mode (offer→order),
// with a passenger-capture step; Stays search near the day's destination (Duffel
// Stays, pending activation → mock). A booked item lands in the day. Functional +
// on-token + `.cc-conn*` contract classes; Design skins later (handoff logged).
export function ConnectionsFinder({
  itineraryId,
  defaultDate,
  defaultPassenger,
  destination,
}: {
  itineraryId: string;
  defaultDate: string;
  defaultPassenger: DefaultPassenger;
  destination: StayDestination | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("flight");

  // flight state
  const [origin, setOrigin] = useState("");
  const [dest, setDest] = useState("");
  const [date, setDate] = useState(defaultDate);
  // stay state
  const [checkIn, setCheckIn] = useState(defaultDate);
  const [checkOut, setCheckOut] = useState(defaultDate);

  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [sample, setSample] = useState(false);
  const [pendingNote, setPendingNote] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<string | null>(null);
  // the offer awaiting passenger details before a flight order
  const [pax, setPax] = useState<Passenger>({ title: "mr", givenName: defaultPassenger.givenName, familyName: defaultPassenger.familyName, bornOn: "", gender: "m", email: defaultPassenger.email, phoneNumber: "" });
  const [booking, setBooking] = useState<Offer | null>(null);

  function reset() {
    setOffers(null);
    setError(null);
    setConfirmed(null);
    setBooking(null);
    setPendingNote(null);
  }

  function search() {
    reset();
    startTransition(async () => {
      if (mode === "flight") {
        const res = await searchFlightOffers({ itineraryId, origin, destination: dest, departureDate: date, adults: 1, cabin: "economy" });
        if (res.error) return setError(res.error);
        setOffers(res.offers);
        setSample(res.sample);
      } else {
        if (!destination) return setError("Add a destination to the day first, then search for a stay nearby.");
        const res = await searchStayOffers({ itineraryId, lat: destination.lat, lng: destination.lng, radiusKm: 5, checkIn, checkOut, rooms: 1, adults: 1 });
        if (res.error) return setError(res.error);
        setOffers(res.offers);
        setSample(res.sample);
        if (res.pending) setPendingNote("Duffel Stays isn't activated on the account yet — showing sample stays.");
      }
    });
  }

  function bookStay(offer: Offer) {
    setBusyId(offer.id);
    setError(null);
    startTransition(async () => {
      const res = await bookStayOffer({ itineraryId, offer: { id: offer.id, title: offer.title, price: offer.price }, checkIn });
      setBusyId(null);
      if (!res.ok) return setError(res.error ?? "Couldn't book that stay.");
      setConfirmed(`Stay added — ${offer.title}.`);
      setOffers(null);
      router.refresh();
    });
  }

  function confirmFlight() {
    if (!booking) return;
    if (!pax.givenName || !pax.familyName || !pax.bornOn || !pax.email || !pax.phoneNumber) {
      return setError("Fill the traveller's name, date of birth, email and phone.");
    }
    setBusyId(booking.id);
    setError(null);
    startTransition(async () => {
      const res = await bookFlightOffer({ itineraryId, offer: { id: booking.id, title: booking.title, price: booking.price, startIso: booking.startIso, endIso: booking.endIso, detail: booking.detail }, passenger: pax });
      setBusyId(null);
      if (!res.ok) return setError(res.error ?? "The airline couldn't confirm that fare — try another.");
      setConfirmed(`Booked — reference ${res.booking?.reference ?? "ok"}. It's on your day.`);
      setOffers(null);
      setBooking(null);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button type="button" className="cc-btn cc-btn-ghost" onClick={() => setOpen(true)}>
        Find a flight or stay
      </button>
    );
  }

  // Placeholder layout only — Design owns the `.cc-conn*` skin (Round 9). Inline
  // styles here are stripped when that round lands (inline overrides a stylesheet).
  const card = { width: "100%", border: "1px solid var(--rule)", borderRadius: "var(--radius-lg, 12px)", padding: "var(--space-4)", background: "var(--card)", display: "flex", flexDirection: "column", gap: "var(--space-3)" } as const;
  const row = { display: "flex", gap: "var(--space-2)", flexWrap: "wrap", alignItems: "center" } as const;

  return (
    <section className="cc-conn" style={card}>
      <div className="cc-conn-head" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="cc-conn-tabs" role="tablist" style={{ display: "flex", gap: "var(--space-2)", alignItems: "baseline" }}>
          <button type="button" className="cc-conn-tab" data-active={mode === "flight"} onClick={() => { setMode("flight"); reset(); }} style={tab(mode === "flight")}>Flights</button>
          <button type="button" className="cc-conn-tab" data-active={mode === "stay"} onClick={() => { setMode("stay"); reset(); }} style={tab(mode === "stay")}>Stays</button>
          {sample ? <span className="cc-conn-sample" style={{ fontFamily: "var(--mono)", fontSize: "var(--fs-micro, 11px)", color: "var(--ink-faint)" }}>· sample</span> : null}
        </div>
        <button type="button" className="cc-conn-close" onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "var(--ink-dim)", cursor: "pointer", fontFamily: "var(--mono)", fontSize: "var(--fs-micro, 11px)" }}>Close</button>
      </div>

      {mode === "flight" ? (
        <div className="cc-conn-form" style={row}>
          <input className="cc-field" placeholder="From (LHR)" value={origin} maxLength={3} onChange={(e) => setOrigin(e.target.value.toUpperCase())} style={{ width: 110 }} />
          <input className="cc-field" placeholder="To (JFK)" value={dest} maxLength={3} onChange={(e) => setDest(e.target.value.toUpperCase())} style={{ width: 110 }} />
          <input className="cc-field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <button type="button" className="cc-btn cc-btn-ghost" onClick={search} disabled={pending || origin.length !== 3 || dest.length !== 3}>
            {pending && !busyId && !booking ? "Searching…" : "Search"}
          </button>
        </div>
      ) : (
        <div className="cc-conn-form" style={row}>
          <span className="cc-conn-near" style={{ fontSize: "var(--fs-label)", color: "var(--ink-dim)" }}>{destination ? `Near ${destination.label}` : "No destination on the day yet"}</span>
          <label className="cc-conn-lbl" style={{ fontSize: "var(--fs-micro, 11px)", color: "var(--ink-dim)", display: "inline-flex", gap: 6, alignItems: "center" }}>In <input className="cc-field" type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} /></label>
          <label className="cc-conn-lbl" style={{ fontSize: "var(--fs-micro, 11px)", color: "var(--ink-dim)", display: "inline-flex", gap: 6, alignItems: "center" }}>Out <input className="cc-field" type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} /></label>
          <button type="button" className="cc-btn cc-btn-ghost" onClick={search} disabled={pending || !destination}>
            {pending && !busyId ? "Searching…" : "Search"}
          </button>
        </div>
      )}

      {error ? <p className="cc-conn-error" style={{ color: "var(--rust)", fontSize: "var(--fs-label)" }}>{error}</p> : null}
      {pendingNote ? <p className="cc-conn-pending" style={{ color: "var(--gold-2)", fontSize: "var(--fs-label)" }}>{pendingNote}</p> : null}
      {confirmed ? <p className="cc-conn-confirmed" style={{ color: "var(--sage, var(--ink))", fontSize: "var(--fs-label)" }}>{confirmed}</p> : null}

      {/* Passenger capture before a flight order */}
      {booking ? (
        <div className="cc-conn-pax" style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <p className="cc-conn-pax-lead" style={{ fontSize: "var(--fs-label)", color: "var(--ink)" }}>Who&rsquo;s travelling on {booking.title}?</p>
          <div className="cc-conn-pax-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "var(--space-2)" }}>
            <select className="cc-field" value={pax.title} onChange={(e) => setPax({ ...pax, title: e.target.value as Passenger["title"] })}>
              <option value="mr">Mr</option><option value="ms">Ms</option><option value="mrs">Mrs</option><option value="miss">Miss</option>
            </select>
            <input className="cc-field" placeholder="First name" value={pax.givenName} onChange={(e) => setPax({ ...pax, givenName: e.target.value })} />
            <input className="cc-field" placeholder="Last name" value={pax.familyName} onChange={(e) => setPax({ ...pax, familyName: e.target.value })} />
            <label className="cc-conn-lbl">Born <input className="cc-field" type="date" value={pax.bornOn} onChange={(e) => setPax({ ...pax, bornOn: e.target.value })} /></label>
            <select className="cc-field" value={pax.gender} onChange={(e) => setPax({ ...pax, gender: e.target.value as Passenger["gender"] })}>
              <option value="m">Male</option><option value="f">Female</option>
            </select>
            <input className="cc-field" placeholder="Email" type="email" value={pax.email} onChange={(e) => setPax({ ...pax, email: e.target.value })} />
            <input className="cc-field" placeholder="Phone (+44…)" value={pax.phoneNumber} onChange={(e) => setPax({ ...pax, phoneNumber: e.target.value })} />
          </div>
          <div className="cc-conn-pax-actions" style={row}>
            <button type="button" className="cc-btn cc-btn-gold" onClick={confirmFlight} disabled={pending}>
              {busyId === booking.id ? "Booking…" : `Confirm — ${money(booking.price.amount, booking.price.currency)}`}
            </button>
            <button type="button" className="cc-btn cc-btn-ghost" onClick={() => setBooking(null)}>Back</button>
          </div>
        </div>
      ) : offers && offers.length > 0 ? (
        <ul className="cc-conn-list" style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          {offers.map((o) => (
            <li key={o.id} className="cc-conn-offer" style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "var(--space-3)", alignItems: "center", padding: "var(--space-3)", border: "1px solid var(--rule)", borderRadius: "var(--radius-md, 6px)" }}>
              <span className="cc-conn-offer-main">
                <span className="cc-conn-offer-title" style={{ display: "block", color: "var(--ink)" }}>{o.title}</span>
                <span className="cc-conn-offer-summary" style={{ display: "block", fontSize: "var(--fs-micro, 11px)", color: "var(--ink-dim)", fontFamily: "var(--mono)" }}>{o.summary}</span>
              </span>
              <span className="cc-conn-offer-price" style={{ fontFamily: "var(--mono)", color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{money(o.price.amount, o.price.currency)}</span>
              <button
                type="button"
                className="cc-btn cc-btn-gold"
                disabled={pending}
                onClick={() => (mode === "flight" ? (setBooking(o), setError(null)) : bookStay(o))}
              >
                {busyId === o.id ? "Booking…" : mode === "flight" ? "Select" : "Book"}
              </button>
            </li>
          ))}
        </ul>
      ) : offers && offers.length === 0 ? (
        <p className="cc-conn-empty" style={{ fontSize: "var(--fs-label)", color: "var(--ink-dim)" }}>Nothing found for those dates.</p>
      ) : null}
    </section>
  );
}

function tab(active: boolean): CSSProperties {
  return {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "0 0 2px",
    fontFamily: "var(--mono)",
    fontSize: "var(--fs-label)",
    letterSpacing: "0.04em",
    color: active ? "var(--ink)" : "var(--ink-dim)",
    borderBottom: active ? "2px solid var(--gold)" : "2px solid transparent",
  };
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
