"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { searchStayOffers, bookStayOffer, stayLocationSuggest, type StayLocation } from "@/lib/actions/connections";
import type { Offer } from "@/lib/connections/types";

// Stay finder (ED-Stay) — its OWN flow, fully independent of flights or the day's
// destination. Type any city or hotel → geocode → search. Duffel Stays is pending
// account activation, so it runs on representative data with the honest cue.
export function StayFinder({ itineraryId, defaultDate }: { itineraryId: string; defaultDate: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<StayLocation | null>(null);
  const [checkIn, setCheckIn] = useState(defaultDate);
  const [checkOut, setCheckOut] = useState(defaultDate);
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [sample, setSample] = useState(false);
  const [pendingNote, setPendingNote] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<string | null>(null);

  function search() {
    if (!place) return setError("Pick where you want to stay.");
    setError(null);
    setConfirmed(null);
    setPendingNote(null);
    startTransition(async () => {
      const res = await searchStayOffers({ itineraryId, lat: place.lat, lng: place.lng, radiusKm: 5, checkIn, checkOut, rooms: 1, adults: 1 });
      if (res.error) return setError(res.error);
      setOffers(res.offers);
      setSample(res.sample);
      if (res.pending) setPendingNote("Stays not activated — showing representative results");
    });
  }

  function book(offer: Offer) {
    setBusyId(offer.id);
    setError(null);
    startTransition(async () => {
      const res = await bookStayOffer({ itineraryId, offer: { id: offer.id, title: offer.title, price: offer.price }, checkIn });
      setBusyId(null);
      if (!res.ok) return setError(res.error ?? "Couldn't book that stay.");
      setConfirmed(`Stay added — ${offer.title}. Check-in ${checkIn}.`);
      setOffers(null);
      router.refresh();
    });
  }

  if (!open) {
    return <button type="button" className="cc-btn cc-btn-ghost" onClick={() => setOpen(true)}>Find a stay</button>;
  }

  return (
    <section className="cc-conn">
      <div className="cc-conn-head">
        <span className="cc-eyebrow" style={{ marginRight: "auto" }}>Find a stay{sample ? " · sample" : ""}</span>
        <button type="button" className="cc-conn-close" aria-label="Close" onClick={() => setOpen(false)}>✕</button>
      </div>

      <div className="cc-conn-form">
        <PlaceField value={place} onPick={setPlace} />
        <div className="cc-conn-field"><label className="cc-conn-lbl">Check in</label><input className="cc-field" type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} /></div>
        <div className="cc-conn-field"><label className="cc-conn-lbl">Check out</label><input className="cc-field" type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} /></div>
        <button type="button" className="cc-btn" onClick={search} disabled={pending || !place}>{pending && !busyId ? "Searching…" : "Search"}</button>
      </div>

      {error ? <p className="cc-conn-error">{error}</p> : null}
      {pendingNote ? <p className="cc-conn-pending">{pendingNote} <span className="sample">· sample</span></p> : null}
      {confirmed ? (
        <div className="cc-conn-confirmed">
          <span className="cc-conn-confirmed-mark" aria-hidden />
          <div><p className="cc-conn-confirmed-title">{confirmed}</p><p className="cc-conn-confirmed-tail">Added to your day</p></div>
        </div>
      ) : null}

      {offers && offers.length > 0 ? (
        <div className="cc-conn-list">
          {offers.map((o) => (
            <div key={o.id} className="cc-conn-offer">
              <div className="cc-conn-offer-main">
                <span className="cc-conn-offer-title">{o.title}</span>
                <span className="cc-conn-offer-summary"><span className="board">{o.summary}</span></span>
              </div>
              <div className="cc-conn-offer-right">
                <span className="cc-conn-offer-price">{money(o.price.amount, o.price.currency)}</span>
                <button type="button" className="cc-conn-offer-action" disabled={pending} onClick={() => book(o)}>{busyId === o.id ? "Booking…" : "Book"}</button>
              </div>
            </div>
          ))}
        </div>
      ) : offers && offers.length === 0 ? (
        <p className="cc-conn-empty">No stays found there for those dates.<span className="hint">Try a wider area or new dates</span></p>
      ) : null}
    </section>
  );
}

function PlaceField({ value, onPick }: { value: StayLocation | null; onPick: (p: StayLocation | null) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<StayLocation[]>([]);
  const [openList, setOpenList] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2 || value?.label === term) { setResults([]); return; }
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      const r = await stayLocationSuggest(term);
      if (seq.current === mine) { setResults(r); setOpenList(true); }
    }, 280);
    return () => clearTimeout(t);
  }, [q, value]);

  return (
    <div className="cc-conn-field cc-conn-near" style={{ position: "relative", flex: "1 1 240px" }}>
      <label className="cc-conn-lbl">Where</label>
      <input className="cc-field" placeholder="City or hotel" value={value ? value.label : q}
        onChange={(e) => { onPick(null); setQ(e.target.value); }}
        onFocus={() => results.length && setOpenList(true)}
        onBlur={() => setTimeout(() => setOpenList(false), 150)} />
      {openList && results.length > 0 ? (
        <ul className="cc-conn-suggest" style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20, listStyle: "none", margin: "4px 0 0", padding: 4, background: "var(--card)", border: "1px solid var(--rule)", borderRadius: 8, boxShadow: "var(--shadow)" }}>
          {results.map((r, i) => (
            <li key={i}>
              <button type="button" style={{ width: "100%", textAlign: "left", background: "none", border: "none", padding: "8px 10px", cursor: "pointer", borderRadius: 6, color: "var(--ink)", fontSize: "var(--fs-label)" }}
                onMouseDown={(e) => { e.preventDefault(); onPick(r); setQ(""); setOpenList(false); }}>{r.label}</button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function money(amount: string, currency: string): string {
  const n = Number(amount);
  if (Number.isNaN(n)) return `${amount} ${currency}`;
  try { return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(n); } catch { return `${amount} ${currency}`; }
}
