"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { searchFlightOffers, bookFlightOffer, airportSuggest } from "@/lib/actions/connections";
import type { PlaceSuggestion } from "@/lib/integrations/duffel";
import type { FlightDetail } from "@/lib/integrations/duffel";
import type { Offer } from "@/lib/connections/types";

export type DefaultPassenger = { givenName: string; familyName: string; email: string };
type Passenger = { title: "mr" | "ms" | "mrs" | "miss"; givenName: string; familyName: string; bornOn: string; gender: "m" | "f"; email: string; phoneNumber: string };
type Airport = { iata: string; label: string };
type Sort = "cheapest" | "fastest";

// Flight finder (ED-Flight) — its OWN flow (no toggle with stays). Airport
// autocomplete (no IATA typing), fare depth surfaced at compare time (the industry
// weak spot Duffel hands us: refundable/changeable + baggage + carbon), sort +
// filter, then a real booking confirmation: PNR + e-ticket + the airline check-in
// deep-link (check-in & the boarding pass are airline-issued — the barcode rule).
export function FlightFinder({ itineraryId, defaultDate, defaultPassenger }: { itineraryId: string; defaultDate: string; defaultPassenger: DefaultPassenger }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState<Airport | null>(null);
  const [dest, setDest] = useState<Airport | null>(null);
  const [date, setDate] = useState(defaultDate);
  const [cabin, setCabin] = useState<"economy" | "premium_economy" | "business" | "first">("economy");

  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [sample, setSample] = useState(false);
  const [sort, setSort] = useState<Sort>("cheapest");
  const [directOnly, setDirectOnly] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ title: string; ref: string; eticket: string | null; airport: string } | null>(null);
  const [pax, setPax] = useState<Passenger>({ title: "mr", givenName: defaultPassenger.givenName, familyName: defaultPassenger.familyName, bornOn: "", gender: "m", email: defaultPassenger.email, phoneNumber: "" });
  const [booking, setBooking] = useState<Offer | null>(null);

  function search() {
    if (!origin || !dest) return setError("Pick a from and to airport.");
    setError(null);
    setConfirmed(null);
    setBooking(null);
    startTransition(async () => {
      const res = await searchFlightOffers({ itineraryId, origin: origin.iata, destination: dest.iata, departureDate: date, adults: 1, cabin });
      if (res.error) return setError(res.error);
      setOffers(res.offers);
      setSample(res.sample);
    });
  }

  function confirmFlight() {
    if (!booking) return;
    if (!pax.givenName || !pax.familyName || !pax.bornOn || !pax.email || !pax.phoneNumber) return setError("Fill the traveller's name, date of birth, email and phone.");
    setBusyId(booking.id);
    setError(null);
    startTransition(async () => {
      const res = await bookFlightOffer({ itineraryId, offer: { id: booking.id, title: booking.title, price: booking.price, startIso: booking.startIso, endIso: booking.endIso, detail: booking.detail }, passenger: pax });
      setBusyId(null);
      if (!res.ok) return setError(res.error ?? "The airline couldn't confirm that fare — try another.");
      const [carrier] = booking.title.split(" · ");
      setConfirmed({ title: `Booked — ${carrier}`, ref: res.booking?.reference ?? "—", eticket: res.booking?.documents?.[0]?.id ?? null, airport: origin?.label ?? dest?.label ?? "the airport" });
      setOffers(null);
      setBooking(null);
      router.refresh();
    });
  }

  const shown = sortFilter(offers ?? [], sort, directOnly);

  if (!open) {
    return <button type="button" className="cc-btn cc-btn-ghost" onClick={() => setOpen(true)}>Find a flight</button>;
  }

  return (
    <section className="cc-conn">
      <div className="cc-conn-head">
        <span className="cc-eyebrow" style={{ marginRight: "auto" }}>Find a flight{sample ? " · sample" : ""}</span>
        <button type="button" className="cc-conn-close" aria-label="Close" onClick={() => setOpen(false)}>✕</button>
      </div>

      <div className="cc-conn-form">
        <AirportField label="From" value={origin} onPick={setOrigin} />
        <AirportField label="To" value={dest} onPick={setDest} />
        <div className="cc-conn-field"><label className="cc-conn-lbl">Date</label><input className="cc-field" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="cc-conn-field"><label className="cc-conn-lbl">Cabin</label>
          <select className="cc-field" value={cabin} onChange={(e) => setCabin(e.target.value as typeof cabin)}>
            <option value="economy">Economy</option><option value="premium_economy">Premium</option><option value="business">Business</option><option value="first">First</option>
          </select>
        </div>
        <button type="button" className="cc-btn" onClick={search} disabled={pending || !origin || !dest}>{pending && !busyId && !booking ? "Searching…" : "Search"}</button>
      </div>

      {error ? <p className="cc-conn-error">{error}</p> : null}
      {confirmed ? (
        <div className="cc-conn-confirmed">
          <span className="cc-conn-confirmed-mark" aria-hidden />
          <div>
            <p className="cc-conn-confirmed-title">{confirmed.title}</p>
            <p className="cc-conn-confirmed-detail">Reference <span className="ref">{confirmed.ref}</span>{confirmed.eticket ? <> · e-ticket <span className="ref">{confirmed.eticket}</span></> : null}. It&rsquo;s on your day.</p>
            <p className="cc-conn-confirmed-tail">Check in on the airline&rsquo;s app ~24–48h before — your boarding pass is issued there, then add it to your Wallet.</p>
          </div>
        </div>
      ) : null}

      {booking ? (
        <PassengerForm offer={booking} pax={pax} setPax={setPax} busy={busyId === booking.id} onConfirm={confirmFlight} onBack={() => setBooking(null)} />
      ) : offers && offers.length > 0 ? (
        <>
          <div className="cc-conn-list-head">
            <span className="cc-conn-list-count">{shown.length} fares</span>
            <span className="cc-conn-controls" style={{ display: "inline-flex", gap: "var(--space-3)", alignItems: "center" }}>
              <label className="cc-conn-sort" style={{ display: "inline-flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
                <input type="checkbox" checked={directOnly} onChange={(e) => setDirectOnly(e.target.checked)} /> Direct only
              </label>
              <select className="cc-field" value={sort} onChange={(e) => setSort(e.target.value as Sort)} style={{ padding: "4px 8px" }}>
                <option value="cheapest">Cheapest</option><option value="fastest">Fastest</option>
              </select>
            </span>
          </div>
          <div className="cc-conn-list">
            {shown.map((o) => {
              const d = o.detail as Partial<FlightDetail> | undefined;
              return (
                <div key={o.id} className="cc-conn-offer">
                  <div className="cc-conn-offer-main">
                    <span className="cc-conn-offer-title">{o.title.split(" · ")[0]}<span className="cc-conn-offer-op">{o.title.split(" · ").slice(1).join(" · ")}</span></span>
                    <span className="cc-conn-offer-summary">{renderSummary(o, d)}</span>
                    <span className="cc-conn-offer-chips" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 5 }}>
                      {d?.fareBrand ? <Chip>{d.fareBrand}</Chip> : null}
                      <Chip>{bagLabel(d)}</Chip>
                      {d?.refundable ? <Chip tone="good">Refundable</Chip> : d?.refundable === false ? <Chip tone="dim">Non-refundable</Chip> : null}
                      {d?.changeable ? <Chip tone="good">Changeable</Chip> : null}
                      {d?.emissionsKg ? <Chip tone="dim">{d.emissionsKg}kg CO2</Chip> : null}
                    </span>
                  </div>
                  <div className="cc-conn-offer-right">
                    <span className="cc-conn-offer-price">{money(o.price.amount, o.price.currency)}</span>
                    <button type="button" className="cc-conn-offer-action" disabled={pending} onClick={() => { setBooking(o); setError(null); }}>Select</button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : offers && offers.length === 0 ? (
        <p className="cc-conn-empty">Nothing found for that route and date.<span className="hint">Try a day either side</span></p>
      ) : null}
    </section>
  );
}

// ── airport autocomplete field ──
function AirportField({ label, value, onPick }: { label: string; value: Airport | null; onPick: (a: Airport | null) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PlaceSuggestion[]>([]);
  const [openList, setOpenList] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2 || value?.label === term) { setResults([]); return; }
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      const r = await airportSuggest(term);
      if (seq.current === mine) { setResults(r); setOpenList(true); }
    }, 250);
    return () => clearTimeout(t);
  }, [q, value]);

  return (
    <div className="cc-conn-field cc-conn-field--airport" style={{ position: "relative" }}>
      <label className="cc-conn-lbl">{label}</label>
      <input
        className="cc-field"
        placeholder="City or airport"
        value={value ? value.label : q}
        onChange={(e) => { onPick(null); setQ(e.target.value); }}
        onFocus={() => results.length && setOpenList(true)}
        onBlur={() => setTimeout(() => setOpenList(false), 150)}
      />
      {openList && results.length > 0 ? (
        <ul className="cc-conn-suggest" style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20, listStyle: "none", margin: "4px 0 0", padding: 4, background: "var(--card)", border: "1px solid var(--rule)", borderRadius: 8, boxShadow: "var(--shadow)" }}>
          {results.map((r) => (
            <li key={r.iataCode}>
              <button type="button" className="cc-conn-suggest-item" style={{ width: "100%", textAlign: "left", background: "none", border: "none", padding: "8px 10px", cursor: "pointer", borderRadius: 6, color: "var(--ink)" }}
                onMouseDown={(e) => { e.preventDefault(); onPick({ iata: r.iataCode, label: `${r.name} (${r.iataCode})` }); setQ(""); setOpenList(false); }}>
                <span style={{ fontFamily: "var(--mono)", color: "var(--gold-2)", marginRight: 8 }}>{r.iataCode}</span>
                {r.name}{r.cityName && r.cityName !== r.name ? <span style={{ color: "var(--ink-dim)" }}> · {r.cityName}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function PassengerForm({ offer, pax, setPax, busy, onConfirm, onBack }: { offer: Offer; pax: Passenger; setPax: (p: Passenger) => void; busy: boolean; onConfirm: () => void; onBack: () => void }) {
  return (
    <div className="cc-conn-pax">
      <div className="cc-conn-pax-lead"><span className="title">Who&rsquo;s travelling?</span><span className="fare">{offer.title.split(" · ")[0]} · {money(offer.price.amount, offer.price.currency)}</span></div>
      <p className="cc-conn-pax-note">Just what the airline needs to issue the ticket.</p>
      <div className="cc-conn-pax-grid">
        <div className="cc-conn-field"><label className="cc-conn-lbl">Title</label>
          <select className="cc-field" value={pax.title} onChange={(e) => setPax({ ...pax, title: e.target.value as Passenger["title"] })}><option value="mr">Mr</option><option value="ms">Ms</option><option value="mrs">Mrs</option><option value="miss">Miss</option></select>
        </div>
        <div className="cc-conn-field"><label className="cc-conn-lbl">Date of birth</label><input className="cc-field" type="date" value={pax.bornOn} onChange={(e) => setPax({ ...pax, bornOn: e.target.value })} /></div>
        <div className="cc-conn-field"><label className="cc-conn-lbl">First name</label><input className="cc-field" value={pax.givenName} onChange={(e) => setPax({ ...pax, givenName: e.target.value })} /></div>
        <div className="cc-conn-field"><label className="cc-conn-lbl">Last name</label><input className="cc-field" value={pax.familyName} onChange={(e) => setPax({ ...pax, familyName: e.target.value })} /></div>
        <div className="cc-conn-field"><label className="cc-conn-lbl">Gender</label>
          <select className="cc-field" value={pax.gender} onChange={(e) => setPax({ ...pax, gender: e.target.value as Passenger["gender"] })}><option value="m">Male</option><option value="f">Female</option></select>
        </div>
        <div className="cc-conn-field"><label className="cc-conn-lbl">Phone</label><input className="cc-field" placeholder="+44…" value={pax.phoneNumber} onChange={(e) => setPax({ ...pax, phoneNumber: e.target.value })} /></div>
        <div className="cc-conn-field span-2"><label className="cc-conn-lbl">Email</label><input className="cc-field" type="email" value={pax.email} onChange={(e) => setPax({ ...pax, email: e.target.value })} /></div>
      </div>
      <div className="cc-conn-pax-actions">
        <button type="button" className="cc-conn-confirm" onClick={onConfirm} disabled={busy}>{busy ? "Booking…" : <>Confirm <span className="price">{money(offer.price.amount, offer.price.currency)}</span></>}</button>
        <button type="button" className="cc-conn-back" onClick={onBack}>Back</button>
        <span className="cc-conn-pax-secure">Secured by Duffel</span>
      </div>
    </div>
  );
}

function Chip({ children, tone }: { children: ReactNode; tone?: "good" | "dim" }) {
  const color = tone === "good" ? "var(--success)" : tone === "dim" ? "var(--ink-dim)" : "var(--ink-2)";
  return <span className="cc-conn-chip" data-tone={tone} style={{ fontFamily: "var(--mono)", fontSize: "9px", letterSpacing: "0.06em", textTransform: "uppercase", color, border: "1px solid var(--rule)", borderRadius: 999, padding: "2px 7px" }}>{children}</span>;
}

function bagLabel(d?: Partial<FlightDetail>): string {
  const carry = d?.carryOn ?? 0;
  const checked = d?.checked ?? 0;
  if (!carry && !checked) return "No bags";
  const parts: string[] = [];
  if (carry) parts.push(`${carry} cabin`);
  if (checked) parts.push(`${checked} checked`);
  return parts.join(" + ");
}

function renderSummary(o: Offer, d?: Partial<FlightDetail>): ReactNode {
  const [times, ...rest] = o.summary.split(" · ");
  const stops = rest.join(" · ");
  const direct = (d?.stops ?? 0) === 0;
  return (<><span>{times}</span>{stops ? <span className="stops" data-direct={direct ? "true" : "false"}>{stops}</span> : null}</>);
}

function sortFilter(offers: Offer[], sort: Sort, directOnly: boolean): Offer[] {
  let out = offers;
  if (directOnly) out = out.filter((o) => ((o.detail as Partial<FlightDetail>)?.stops ?? 0) === 0);
  const dur = (o: Offer) => (o.startIso && o.endIso ? new Date(o.endIso).getTime() - new Date(o.startIso).getTime() : Infinity);
  return [...out].sort((a, b) => (sort === "cheapest" ? Number(a.price.amount) - Number(b.price.amount) : dur(a) - dur(b)));
}

function money(amount: string, currency: string): string {
  const n = Number(amount);
  if (Number.isNaN(n)) return `${amount} ${currency}`;
  try { return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(n); } catch { return `${amount} ${currency}`; }
}
