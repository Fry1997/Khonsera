"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { searchFlightOffers, bookFlightOffer, searchStayOffers, bookStayOffer } from "@/lib/actions/connections";
import type { Offer } from "@/lib/connections/types";

export type DefaultPassenger = { givenName: string; familyName: string; email: string };
export type StayDestination = { lat: number; lng: number; label: string };

type Mode = "flight" | "stay";
type Passenger = { title: "mr" | "ms" | "mrs" | "miss"; givenName: string; familyName: string; bornOn: string; gender: "m" | "f"; email: string; phoneNumber: string };
type Confirmation = { title: string; detail: ReactNode; tail: string };

// Connections finder (Phase 14) — search → compare → book for flights + stays on
// `/plan/[id]`. Flights run LIVE against Duffel test mode (offer→order) with a
// passenger step; Stays search the day's destination (pending Duffel activation).
// The skin is Design's Round 9 (`khonsera-edition-iii-connections.css`) via the
// `.cc-conn*` contract + `data-*` hooks — NO inline styles here (they'd override it).
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

  const [origin, setOrigin] = useState("");
  const [dest, setDest] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [checkIn, setCheckIn] = useState(defaultDate);
  const [checkOut, setCheckOut] = useState(defaultDate);

  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [sample, setSample] = useState(false);
  const [pendingNote, setPendingNote] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Confirmation | null>(null);
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
        if (res.pending) setPendingNote("Stays not activated — showing representative results");
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
      setConfirmed({ title: `Stay added — ${offer.title}`, detail: <>Check-in {checkIn}, {money(offer.price.amount, offer.price.currency)}.</>, tail: "Added to your day" });
      setOffers(null);
      router.refresh();
    });
  }

  function confirmFlight() {
    if (!booking) return;
    if (!pax.givenName || !pax.familyName || !pax.bornOn || !pax.email || !pax.phoneNumber) {
      return setError("Some details are missing — fill name, date of birth, email and phone.");
    }
    setBusyId(booking.id);
    setError(null);
    startTransition(async () => {
      const res = await bookFlightOffer({ itineraryId, offer: { id: booking.id, title: booking.title, price: booking.price, startIso: booking.startIso, endIso: booking.endIso, detail: booking.detail }, passenger: pax });
      setBusyId(null);
      if (!res.ok) return setError(res.error ?? "The airline couldn't confirm that fare — try another.");
      const [carrier] = booking.title.split(" · ");
      setConfirmed({
        title: `Booked — ${carrier}`,
        detail: <>Reference <span className="ref">{res.booking?.reference ?? "—"}</span>.</>,
        tail: "Added to your day · pass in Wallet",
      });
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

  return (
    <section className="cc-conn">
      <div className="cc-conn-head">
        <div className="cc-conn-tabs" role="tablist">
          <button type="button" className="cc-conn-tab" data-active={mode === "flight" ? "true" : "false"} onClick={() => { setMode("flight"); reset(); }}>Flights</button>
          <button type="button" className="cc-conn-tab" data-active={mode === "stay" ? "true" : "false"} onClick={() => { setMode("stay"); reset(); }}>Stays</button>
        </div>
        {sample ? <span className="cc-conn-sample">· sample</span> : null}
        <button type="button" className="cc-conn-close" aria-label="Close" onClick={() => setOpen(false)}>✕</button>
      </div>

      {mode === "flight" ? (
        <div className="cc-conn-form">
          <div className="cc-conn-field cc-conn-field--iata">
            <label className="cc-conn-lbl">From</label>
            <input className="cc-field" placeholder="LHR" value={origin} maxLength={3} onChange={(e) => setOrigin(e.target.value.toUpperCase())} />
          </div>
          <div className="cc-conn-field cc-conn-field--iata">
            <label className="cc-conn-lbl">To</label>
            <input className="cc-field" placeholder="JFK" value={dest} maxLength={3} onChange={(e) => setDest(e.target.value.toUpperCase())} />
          </div>
          <div className="cc-conn-field">
            <label className="cc-conn-lbl">Date</label>
            <input className="cc-field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <button type="button" className="cc-btn" onClick={search} disabled={pending || origin.length !== 3 || dest.length !== 3}>
            {pending && !busyId && !booking ? "Searching…" : "Search"}
          </button>
        </div>
      ) : (
        <div className="cc-conn-form">
          <span className="cc-conn-near">{destination ? `Near ${destination.label}` : "No destination on the day yet"}</span>
          <div className="cc-conn-field">
            <label className="cc-conn-lbl">Check in</label>
            <input className="cc-field" type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
          </div>
          <div className="cc-conn-field">
            <label className="cc-conn-lbl">Check out</label>
            <input className="cc-field" type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
          </div>
          <button type="button" className="cc-btn" onClick={search} disabled={pending || !destination}>
            {pending && !busyId ? "Searching…" : "Search"}
          </button>
        </div>
      )}

      {error ? <p className="cc-conn-error">{renderError(error)}</p> : null}
      {pendingNote ? <p className="cc-conn-pending">{pendingNote} <span className="sample">· sample</span></p> : null}

      {confirmed ? (
        <div className="cc-conn-confirmed">
          <span className="cc-conn-confirmed-mark" aria-hidden />
          <div>
            <p className="cc-conn-confirmed-title">{confirmed.title}</p>
            <p className="cc-conn-confirmed-detail">{confirmed.detail}</p>
            <p className="cc-conn-confirmed-tail">{confirmed.tail}</p>
          </div>
        </div>
      ) : null}

      {/* Passenger capture before a flight order */}
      {booking ? (
        <div className="cc-conn-pax">
          <div className="cc-conn-pax-lead">
            <span className="title">Who&rsquo;s travelling?</span>
            <span className="fare">{booking.title.split(" · ")[0]} · {money(booking.price.amount, booking.price.currency)}</span>
          </div>
          <p className="cc-conn-pax-note">Just what the airline needs to issue the ticket.</p>
          <div className="cc-conn-pax-grid">
            <div className="cc-conn-field">
              <label className="cc-conn-lbl">Title</label>
              <select className="cc-field" value={pax.title} onChange={(e) => setPax({ ...pax, title: e.target.value as Passenger["title"] })}>
                <option value="mr">Mr</option><option value="ms">Ms</option><option value="mrs">Mrs</option><option value="miss">Miss</option>
              </select>
            </div>
            <div className="cc-conn-field">
              <label className="cc-conn-lbl">Date of birth</label>
              <input className="cc-field" type="date" value={pax.bornOn} onChange={(e) => setPax({ ...pax, bornOn: e.target.value })} />
            </div>
            <div className="cc-conn-field">
              <label className="cc-conn-lbl">First name</label>
              <input className="cc-field" value={pax.givenName} onChange={(e) => setPax({ ...pax, givenName: e.target.value })} />
            </div>
            <div className="cc-conn-field">
              <label className="cc-conn-lbl">Last name</label>
              <input className="cc-field" value={pax.familyName} onChange={(e) => setPax({ ...pax, familyName: e.target.value })} />
            </div>
            <div className="cc-conn-field">
              <label className="cc-conn-lbl">Gender</label>
              <select className="cc-field" value={pax.gender} onChange={(e) => setPax({ ...pax, gender: e.target.value as Passenger["gender"] })}>
                <option value="m">Male</option><option value="f">Female</option>
              </select>
            </div>
            <div className="cc-conn-field">
              <label className="cc-conn-lbl">Phone</label>
              <input className="cc-field" placeholder="+44…" value={pax.phoneNumber} onChange={(e) => setPax({ ...pax, phoneNumber: e.target.value })} />
            </div>
            <div className="cc-conn-field span-2">
              <label className="cc-conn-lbl">Email</label>
              <input className="cc-field" type="email" value={pax.email} onChange={(e) => setPax({ ...pax, email: e.target.value })} />
            </div>
          </div>
          <div className="cc-conn-pax-actions">
            <button type="button" className="cc-conn-confirm" onClick={confirmFlight} disabled={pending}>
              {busyId === booking.id ? "Booking…" : <>Confirm <span className="price">{money(booking.price.amount, booking.price.currency)}</span></>}
            </button>
            <button type="button" className="cc-conn-back" onClick={() => setBooking(null)}>Back</button>
            <span className="cc-conn-pax-secure">Secured by Duffel</span>
          </div>
        </div>
      ) : offers && offers.length > 0 ? (
        <div className="cc-conn-list">
          <div className="cc-conn-list-head">
            <span className="cc-conn-list-count">{offers.length} {mode === "flight" ? "fares" : "stays"}</span>
            <span className="cc-conn-list-sort">cheapest first</span>
          </div>
          {offers.map((o) => (
            <div key={o.id} className="cc-conn-offer">
              <div className="cc-conn-offer-main">
                <span className="cc-conn-offer-title">
                  {offerName(o)}
                  {offerOp(o) ? <span className="cc-conn-offer-op">{offerOp(o)}</span> : null}
                </span>
                <span className="cc-conn-offer-summary">{renderSummary(o)}</span>
                {o.kind === "flight" ? <span className="cc-conn-offer-fare">Economy</span> : null}
              </div>
              <div className="cc-conn-offer-right">
                <span className="cc-conn-offer-price">{money(o.price.amount, o.price.currency)}</span>
                <button
                  type="button"
                  className="cc-conn-offer-action"
                  disabled={pending}
                  onClick={() => (mode === "flight" ? (setBooking(o), setError(null)) : bookStay(o))}
                >
                  {busyId === o.id ? "Booking…" : mode === "flight" ? "Select" : "Book"}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : offers && offers.length === 0 ? (
        <p className="cc-conn-empty">
          Nothing found for those dates.
          <span className="hint">Try a day either side</span>
        </p>
      ) : null}
    </section>
  );
}

// "British Airways · LHR → JFK" → name "British Airways", op "LHR → JFK".
// A stay title has no " · " → the whole thing is the name, no op badge.
function offerName(o: Offer): string {
  return o.title.split(" · ")[0];
}
function offerOp(o: Offer): string | null {
  const parts = o.title.split(" · ");
  return parts.length > 1 ? parts.slice(1).join(" · ") : null;
}

// Flight summary "07:25–10:40 · direct" → times + a sage-able `.stops` span.
function renderSummary(o: Offer): ReactNode {
  if (o.kind !== "flight") return <span className="board">{o.summary}</span>;
  const [times, ...rest] = o.summary.split(" · ");
  const stops = rest.join(" · ");
  const direct = /direct/i.test(stops);
  return (
    <>
      <span>{times}</span>
      {stops ? <span className="stops" data-direct={direct ? "true" : "false"}>{stops}</span> : null}
    </>
  );
}

// Error: rust <strong> on the cause (before an em-dash), the rest in ink.
function renderError(msg: string): ReactNode {
  const [cause, ...rest] = msg.split(" — ");
  if (!rest.length) return msg;
  return (
    <>
      <strong>{cause}</strong> — {rest.join(" — ")}
    </>
  );
}

function money(amount: string, currency: string): string {
  const n = Number(amount);
  if (Number.isNaN(n)) return `${amount} ${currency}`;
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${amount} ${currency}`;
  }
}
