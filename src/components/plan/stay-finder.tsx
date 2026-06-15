"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { searchStayOffers, stayRates, bookStayRoom, stayLocationSuggest, type StayLocation } from "@/lib/actions/connections";
import type { Offer } from "@/lib/connections/types";
import type { StayDetail, StayRate } from "@/lib/integrations/duffel";

// Stay finder (ED-Stay) — its own flow, independent of flights/the day. Skin =
// Design Round 12 (`.cc-conn*` / `.cc-stay*`); NO inline styles. Honest limit
// (the stay-side boarding-pass): digital key / mobile check-in / loyalty are
// chain-app-only — we book + service, we don't mint a door key.
export function StayFinder({ itineraryId, defaultDate }: { itineraryId: string; defaultDate: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<StayLocation | null>(null);
  const [checkIn, setCheckIn] = useState(defaultDate);
  const [checkOut, setCheckOut] = useState(defaultDate);
  const [freeCancelOnly, setFreeCancelOnly] = useState(false);
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [sample, setSample] = useState(false);
  const [pendingNote, setPendingNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<string | null>(null);
  const [property, setProperty] = useState<Offer | null>(null);
  const [rates, setRates] = useState<StayRate[] | null>(null);
  const [ratesSample, setRatesSample] = useState(false);
  const [requests, setRequests] = useState("");
  const [busyRate, setBusyRate] = useState<string | null>(null);

  const nights = Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000) || 1);

  function search() {
    if (!place) return setError("Pick where you want to stay.");
    setError(null); setConfirmed(null); setPendingNote(null); setProperty(null); setRates(null);
    startTransition(async () => {
      const res = await searchStayOffers({ itineraryId, lat: place.lat, lng: place.lng, radiusKm: 5, checkIn, checkOut, rooms: 1, adults: 1 });
      if (res.error) return setError(res.error);
      setOffers(res.offers); setSample(res.sample);
      if (res.pending) setPendingNote("Stays not activated — showing representative results");
    });
  }
  function openProperty(o: Offer) {
    setProperty(o); setRates(null); setError(null);
    startTransition(async () => { const r = await stayRates(o.id); setRates(r.rates); setRatesSample(r.sample); });
  }
  function bookRate(rate: StayRate) {
    if (!property) return;
    setBusyRate(rate.id); setError(null);
    startTransition(async () => {
      const d = property.detail as Partial<StayDetail> | undefined;
      const res = await bookStayRoom({ itineraryId, rateId: rate.id, stayTitle: property.title, checkIn, checkOut, checkInAfter: d?.checkInAfter ?? undefined, checkOutBefore: d?.checkOutBefore ?? undefined, board: rate.boardType, freeCancellationBefore: rate.freeCancellationBefore, specialRequests: requests || undefined });
      setBusyRate(null);
      if (!res.ok) return setError(res.error ?? "Couldn't book that room.");
      setConfirmed(`Booked — ${property.title}, ${rate.roomName}. Ref ${res.reference}.`);
      setProperty(null); setRates(null); setOffers(null); setRequests("");
      router.refresh();
    });
  }

  if (!open) return <button type="button" className="cc-btn cc-btn-ghost" onClick={() => setOpen(true)}>Find a stay</button>;

  if (property) {
    const d = property.detail as Partial<StayDetail> | undefined;
    return (
      <section className="cc-conn cc-stay-detail">
        <div className="cc-conn-head">
          <span className="cc-conn-title">{property.title}</span>
          {ratesSample || property.sample ? <span className="cc-conn-sample">· sample</span> : null}
          <button type="button" className="cc-conn-back" onClick={() => { setProperty(null); setRates(null); }}>Back</button>
        </div>
        <div className="cc-stay-detail-meta">
          {d?.rating ? <span className="rating">{d.rating}★</span> : null}
          {d?.reviewScore ? <span className="score">{d.reviewScore.toFixed(1)}/10</span> : null}
          {d?.address ? <span className="addr">{d.address}</span> : null}
          {d?.checkInAfter ? <span className="n">check-in {d.checkInAfter}</span> : null}
        </div>
        {d?.amenities && d.amenities.length ? (
          <div className="cc-stay-amenities">{d.amenities.slice(0, 8).map((a, i) => <span key={i} className="cc-conn-chip">{a}</span>)}</div>
        ) : null}
        <div className="cc-conn-form"><input className="cc-field" placeholder="Special requests to the property (optional)" value={requests} onChange={(e) => setRequests(e.target.value)} /></div>
        {error ? <p className="cc-conn-error">{error}</p> : null}
        {!rates ? <p className="cc-conn-empty">Loading rooms…</p> : rates.length === 0 ? <p className="cc-conn-empty">No rooms available for those dates.</p> : (
          <div className="cc-conn-list">
            {rates.map((r) => (
              <div key={r.id} className="cc-stay-rate">
                <div className="cc-stay-rate-name">{r.roomName}
                  <span className="cc-stay-rate-chips">
                    <span className="cc-conn-chip">{boardLabel(r.boardType)}</span>
                    {r.freeCancellationBefore ? <span className="cc-conn-chip" data-tone="good">Free cancellation</span> : <span className="cc-conn-chip" data-tone="dim">Non-refundable</span>}
                    {r.payAtProperty ? <span className="cc-conn-chip" data-tone="dim">Pay at property</span> : null}
                  </span>
                </div>
                <div className="cc-stay-rate-right">
                  <span className="cc-stay-rate-price">{money(r.price.amount, r.price.currency)}<span className="per"> total</span></span>
                  <button type="button" className="cc-stay-rate-book" disabled={pending} onClick={() => bookRate(r)}>{busyRate === r.id ? "Booking…" : "Book"}</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="cc-stay-limit">Digital room key, mobile check-in and loyalty points stay in the hotel&rsquo;s own app — we book and service the stay, and carry your key-collection instructions for the day.</p>
      </section>
    );
  }

  return (
    <section className="cc-conn">
      <div className="cc-conn-head">
        <span className="cc-conn-title">Find a stay</span>
        {sample ? <span className="cc-conn-sample">· sample</span> : null}
        <button type="button" className="cc-conn-close" aria-label="Close" onClick={() => setOpen(false)}>✕</button>
      </div>
      <div className="cc-conn-form">
        <PlaceField value={place} onPick={setPlace} />
        <div className="cc-conn-field"><label className="cc-conn-lbl">Check in</label><input className="cc-field" type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} /></div>
        <div className="cc-conn-field"><label className="cc-conn-lbl">Check out</label><input className="cc-field" type="date" value={checkOut} min={checkIn} onChange={(e) => setCheckOut(e.target.value)} /></div>
        <label className="cc-conn-control"><input type="checkbox" checked={freeCancelOnly} onChange={(e) => setFreeCancelOnly(e.target.checked)} /> Free cancellation</label>
        <button type="button" className="cc-btn" onClick={search} disabled={pending || !place}>{pending ? "Searching…" : "Search"}</button>
      </div>

      {error ? <p className="cc-conn-error">{error}</p> : null}
      {pendingNote ? <p className="cc-conn-pending">{pendingNote} <span className="sample">· sample</span></p> : null}
      {confirmed ? <div className="cc-conn-confirmed"><span className="cc-conn-confirmed-mark" aria-hidden /><div><p className="cc-conn-confirmed-title">{confirmed}</p><p className="cc-conn-confirmed-tail">Added to your day · free-cancellation and check-in time on the card</p></div></div> : null}

      {offers && offers.length > 0 ? (
        <div className="cc-conn-list">
          {offers.map((o) => {
            const d = o.detail as Partial<StayDetail> | undefined;
            const perNight = (Number(o.price.amount) / nights).toFixed(0);
            return (
              <button key={o.id} type="button" className="cc-conn-offer cc-stay-card" onClick={() => openProperty(o)}>
                <div className="cc-conn-offer-main">
                  <span className="cc-conn-offer-title">{o.title}</span>
                  <span className="cc-conn-offer-summary">{d?.rating ? <span className="rating">{d.rating}★</span> : null}{d?.reviewScore ? <span className="board"> · {d.reviewScore.toFixed(1)}/10</span> : null}{d?.address ? <span className="board"> · {d.address}</span> : null}</span>
                </div>
                <div className="cc-conn-offer-right">
                  <span className="cc-conn-offer-price">{money(perNight, o.price.currency)}<span className="per"> / night</span></span>
                  <span className="cc-conn-offer-total">{money(o.price.amount, o.price.currency)} · {nights}n</span>
                </div>
              </button>
            );
          })}
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
    const t = setTimeout(async () => { const r = await stayLocationSuggest(term); if (seq.current === mine) { setResults(r); setOpenList(true); } }, 280);
    return () => clearTimeout(t);
  }, [q, value]);
  return (
    <div className="cc-conn-field cc-conn-near">
      <label className="cc-conn-lbl">Where</label>
      <input className="cc-field" placeholder="City or hotel" value={value ? value.label : q} onChange={(e) => { onPick(null); setQ(e.target.value); }} onFocus={() => results.length && setOpenList(true)} onBlur={() => setTimeout(() => setOpenList(false), 150)} />
      {openList && results.length > 0 ? (
        <ul className="cc-conn-suggest">
          {results.map((r, i) => <li key={i}><button type="button" className="cc-conn-suggest-item" onMouseDown={(e) => { e.preventDefault(); onPick(r); setQ(""); setOpenList(false); }}><span className="cc-conn-suggest-name">{r.label}</span></button></li>)}
        </ul>
      ) : null}
    </div>
  );
}

function boardLabel(b: string): string {
  return { room_only: "Room only", breakfast: "Breakfast", half_board: "Half board", full_board: "Full board", all_inclusive: "All-inclusive" }[b] ?? b;
}
function money(amount: string, currency: string): string {
  const n = Number(amount);
  if (Number.isNaN(n)) return `${amount} ${currency}`;
  try { return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(n); } catch { return `${amount} ${currency}`; }
}
