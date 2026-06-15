"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { searchFlightOffers, bookFlightOffer, airportSuggest, flightSeatMap } from "@/lib/actions/connections";
import type { PlaceSuggestion, FlightDetail, SeatMapVM, SeatCell } from "@/lib/integrations/duffel";
import type { Offer } from "@/lib/connections/types";

export type DefaultPassenger = { givenName: string; familyName: string; email: string };
type Passenger = { title: "mr" | "ms" | "mrs" | "miss"; givenName: string; familyName: string; bornOn: string; gender: "m" | "f"; email: string; phoneNumber: string };
type Airport = { iata: string; label: string };
type Sort = "cheapest" | "fastest";

// Flight finder (ED-Flight) — its own flow. Skin = Design Round 12
// (`khonsera-edition-iii-connections.css`) via the `.cc-conn*` contract; NO inline
// styles here (they'd override the skin). Airport autocomplete (cities + airports,
// no IATA typing), fare depth at compare time, seat picker, honest check-in handoff.
export function FlightFinder({ itineraryId, defaultDate, defaultPassenger }: { itineraryId: string; defaultDate: string; defaultPassenger: DefaultPassenger }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState<Airport | null>(null);

  // Readiness's "Find & book" deep-links here via ?find=flight — open the finder,
  // then clear the param so a refresh doesn't re-open. (Was a dead button.)
  useEffect(() => {
    if (searchParams.get("find") === "flight") {
      setOpen(true);
      router.replace(window.location.pathname as Parameters<typeof router.replace>[0], { scroll: false });
    }
  }, [searchParams, router]);
  const [dest, setDest] = useState<Airport | null>(null);
  const [date, setDate] = useState(defaultDate);
  const [tripType, setTripType] = useState<"oneway" | "return">("return");
  const [returnDate, setReturnDate] = useState(defaultDate);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [cabin, setCabin] = useState<"economy" | "premium_economy" | "business" | "first">("economy");

  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [sample, setSample] = useState(false);
  const [sort, setSort] = useState<Sort>("cheapest");
  const [directOnly, setDirectOnly] = useState(false);
  const [airline, setAirline] = useState<string>("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ title: string; ref: string; eticket: string | null } | null>(null);
  const [pax, setPax] = useState<Passenger>({ title: "mr", givenName: defaultPassenger.givenName, familyName: defaultPassenger.familyName, bornOn: "", gender: "m", email: defaultPassenger.email, phoneNumber: "" });
  const [booking, setBooking] = useState<Offer | null>(null);
  const [seat, setSeat] = useState<{ id: string; label: string } | null>(null);

  function search() {
    if (!origin || !dest) return setError("Pick a from and to airport.");
    setError(null); setConfirmed(null); setBooking(null);
    startTransition(async () => {
      const res = await searchFlightOffers({ itineraryId, origin: origin.iata, destination: dest.iata, departureDate: date, returnDate: tripType === "return" ? returnDate : undefined, adults, children, cabin });
      if (res.error) return setError(res.error);
      setOffers(res.offers); setSample(res.sample);
    });
  }

  function confirmFlight() {
    if (!booking) return;
    if (!pax.givenName || !pax.familyName || !pax.bornOn || !pax.email || !pax.phoneNumber) return setError("Fill the traveller's name, date of birth, email and phone.");
    setBusyId(booking.id); setError(null);
    startTransition(async () => {
      const res = await bookFlightOffer({ itineraryId, offer: { id: booking.id, title: booking.title, price: booking.price, startIso: booking.startIso, endIso: booking.endIso, detail: booking.detail }, passenger: pax, seatServiceIds: seat ? [seat.id] : undefined });
      setBusyId(null);
      if (!res.ok) return setError(res.error ?? "The airline couldn't confirm that fare — try another.");
      setConfirmed({ title: `Booked — ${booking.title.split(" · ")[0]}`, ref: res.booking?.reference ?? "—", eticket: res.booking?.documents?.[0]?.id ?? null });
      setOffers(null); setBooking(null); setSeat(null);
      router.refresh();
    });
  }

  const airlines = Array.from(new Set((offers ?? []).map((o) => (o.detail as Partial<FlightDetail>)?.carrier).filter((c): c is string => !!c))).sort();
  const shown = sortFilter(offers ?? [], sort, directOnly, airline);

  if (!open) return <button type="button" className="cc-btn cc-btn-ghost" onClick={() => setOpen(true)}>Find a flight</button>;

  return (
    <section className="cc-conn">
      <div className="cc-conn-head">
        <span className="cc-conn-title">Find a flight</span>
        {sample ? <span className="cc-conn-sample">· sample</span> : null}
        <button type="button" className="cc-conn-close" aria-label="Close" onClick={() => setOpen(false)}>✕</button>
      </div>

      <div className="cc-conn-triptype">
        <button type="button" className="cc-conn-tab" data-active={tripType === "return" ? "true" : "false"} onClick={() => setTripType("return")}>Return</button>
        <button type="button" className="cc-conn-tab" data-active={tripType === "oneway" ? "true" : "false"} onClick={() => setTripType("oneway")}>One-way</button>
      </div>

      <div className="cc-conn-form">
        <AirportField label="From" value={origin} onPick={setOrigin} />
        <AirportField label="To" value={dest} onPick={setDest} />
        <div className="cc-conn-field"><label className="cc-conn-lbl">Depart</label><input className="cc-field" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        {tripType === "return" ? <div className="cc-conn-field"><label className="cc-conn-lbl">Return</label><input className="cc-field" type="date" value={returnDate} min={date} onChange={(e) => setReturnDate(e.target.value)} /></div> : null}
        <div className="cc-conn-field cc-conn-field--num"><label className="cc-conn-lbl">Adults</label><select className="cc-field" value={adults} onChange={(e) => setAdults(Number(e.target.value))}>{[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}</select></div>
        <div className="cc-conn-field cc-conn-field--num"><label className="cc-conn-lbl">Children</label><select className="cc-field" value={children} onChange={(e) => setChildren(Number(e.target.value))}>{[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}</select></div>
        <div className="cc-conn-field"><label className="cc-conn-lbl">Cabin</label><select className="cc-field" value={cabin} onChange={(e) => setCabin(e.target.value as typeof cabin)}><option value="economy">Economy</option><option value="premium_economy">Premium</option><option value="business">Business</option><option value="first">First</option></select></div>
        <button type="button" className="cc-btn" onClick={search} disabled={pending || !origin || !dest}>{pending && !busyId && !booking ? "Searching…" : "Search"}</button>
      </div>

      {error ? <p className="cc-conn-error">{error}</p> : null}
      {confirmed ? (
        <div className="cc-conn-confirmed">
          <span className="cc-conn-confirmed-mark" aria-hidden />
          <div>
            <p className="cc-conn-confirmed-title">{confirmed.title}</p>
            <p className="cc-conn-confirmed-detail">Reference <span className="ref">{confirmed.ref}</span>{confirmed.eticket ? <> · e-ticket <span className="ref">{confirmed.eticket}</span></> : null}. It&rsquo;s on your day.</p>
            <p className="cc-conn-checkin">Check in on the airline&rsquo;s app ~24–48h before — your boarding pass is issued there, then add it to your Wallet.</p>
          </div>
        </div>
      ) : null}

      {booking ? (
        <>
          <SeatPicker offer={booking} seat={seat} onPick={setSeat} />
          <PassengerForm offer={booking} seat={seat} pax={pax} setPax={setPax} busy={busyId === booking.id} onConfirm={confirmFlight} onBack={() => { setBooking(null); setSeat(null); }} />
        </>
      ) : offers && offers.length > 0 ? (
        <>
          <div className="cc-conn-list-head">
            <span className="cc-conn-list-count">{shown.length} fares</span>
            <span className="cc-conn-controls">
              <label className="cc-conn-control"><input type="checkbox" checked={directOnly} onChange={(e) => setDirectOnly(e.target.checked)} /> Direct only</label>
              {airlines.length > 1 ? <select className="cc-field cc-conn-control" value={airline} onChange={(e) => setAirline(e.target.value)}><option value="">All airlines</option>{airlines.map((a) => <option key={a} value={a}>{a}</option>)}</select> : null}
              <select className="cc-field cc-conn-control" value={sort} onChange={(e) => setSort(e.target.value as Sort)}><option value="cheapest">Cheapest</option><option value="fastest">Fastest</option></select>
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
                    <span className="cc-conn-offer-chips">
                      {d?.roundTrip ? <Chip tone="good">Return</Chip> : null}
                      {d?.fareBrand ? <Chip>{d.fareBrand}</Chip> : null}
                      <Chip tone={(d?.carryOn || d?.checked) ? "good" : "dim"}>{bagLabel(d)}</Chip>
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

function AirportField({ label, value, onPick }: { label: string; value: Airport | null; onPick: (a: Airport | null) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PlaceSuggestion[]>([]);
  const [openList, setOpenList] = useState(false);
  const seq = useRef(0);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2 || value?.label === term) { setResults([]); return; }
    const mine = ++seq.current;
    const t = setTimeout(async () => { const r = await airportSuggest(term); if (seq.current === mine) { setResults(r); setOpenList(true); } }, 250);
    return () => clearTimeout(t);
  }, [q, value]);
  return (
    <div className="cc-conn-field cc-conn-field--airport">
      <label className="cc-conn-lbl">{label}</label>
      <input className="cc-field" placeholder="City or airport" value={value ? value.label : q} onChange={(e) => { onPick(null); setQ(e.target.value); }} onFocus={() => results.length && setOpenList(true)} onBlur={() => setTimeout(() => setOpenList(false), 150)} />
      {openList && results.length > 0 ? (
        <ul className="cc-conn-suggest">
          {results.map((r) => (
            <li key={r.iataCode}>
              <button type="button" className="cc-conn-suggest-item" data-type={r.type} onMouseDown={(e) => { e.preventDefault(); onPick({ iata: r.iataCode, label: r.type === "city" ? `${r.name} · all airports` : `${r.name} (${r.iataCode})` }); setQ(""); setOpenList(false); }}>
                <span className="cc-conn-suggest-iata">{r.iataCode}</span>
                <span className="cc-conn-suggest-name">{r.name}{r.type === "city" ? <span className="city"> · all airports</span> : r.cityName && r.cityName !== r.name ? ` · ${r.cityName}` : ""}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function SeatPicker({ offer, seat, onPick }: { offer: Offer; seat: { id: string; label: string } | null; onPick: (s: { id: string; label: string } | null) => void }) {
  const [open, setOpen] = useState(false);
  const [map, setMap] = useState<SeatMapVM | null>(null);
  const [loading, setLoading] = useState(false);
  const passengerId = (offer.detail?.passengers as { id?: string }[] | undefined)?.[0]?.id ?? "pas_0";
  function load() { setOpen(true); if (map || loading) return; setLoading(true); flightSeatMap(offer.id, passengerId).then((m) => { setMap(m); setLoading(false); }); }
  if (!open) return <div className="cc-conn-seats"><button type="button" className="cc-conn-back" onClick={load}>{seat ? `Seat ${seat.label} · change` : "Choose a seat (optional)"}</button></div>;
  return (
    <div className="cc-conn-seats">
      <div className="cc-conn-seats-lead">
        <span className="title">Pick a seat{map?.sample ? " · sample" : ""}</span>
        {map && map.rows.length === 0 && !loading ? <span className="note">No seat map — seats are assigned at check-in.</span> : null}
        {loading ? <span className="note">Loading…</span> : null}
      </div>
      {map && map.rows.length > 0 ? (
        <>
          {/* A real cabin (deep review 2026-06-15): a fuselage frame with a nose
              cue, rows down the aisle, each row numbered, the aisle a true gap. */}
          <div className="cc-plane">
            <span className="cc-plane-nose" aria-hidden />
            <div className="cc-plane-cabin">
              {map.rows.map((row, ri) => {
                const rowNum = rowNumberOf(row);
                return (
                  <div className="cc-plane-row" key={ri}>
                    <span className="cc-plane-rownum" aria-hidden>{rowNum}</span>
                    <div className="cc-plane-seats">
                      {row.map((c, ci) => (
                        <SeatButton key={`${ri}-${ci}`} cell={c} selected={seat?.id === c.serviceId} onPick={() => c.serviceId && onPick(seat?.id === c.serviceId ? null : { id: c.serviceId, label: c.designator })} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="cc-conn-seats-legend">
            <span className="free"><i />Free</span>
            <span className="paid"><i />Extra</span>
            <span className="sel"><i />Yours</span>
          </div>
        </>
      ) : null}
    </div>
  );
}

// The row number is the leading digits of the first real seat's designator
// (e.g. "12A" → "12"). Aisle/facility cells carry no designator.
function rowNumberOf(row: SeatCell[]): string {
  for (const c of row) {
    const m = /^(\d+)/.exec(c.designator);
    if (m) return m[1];
  }
  return "";
}

function SeatButton({ cell, selected, onPick }: { cell: SeatCell; selected: boolean; onPick: () => void }) {
  if (cell.kind === "aisle") return <span className="cc-plane-aisle" aria-hidden />;
  if (cell.kind === "facility") return <span className="cc-plane-facility" aria-hidden />;
  const free = cell.price ? Number(cell.price.amount) === 0 : false;
  const state = !cell.available ? "taken" : selected ? "selected" : free ? "free" : "paid";
  const letter = cell.designator.replace(/^\d+/, "");
  return (
    <button type="button" className="cc-conn-seat" data-state={state} disabled={!cell.available} onClick={onPick} title={cell.available && cell.price ? (free ? `Seat ${cell.designator} · free` : `Seat ${cell.designator} · ${cell.price.currency} ${cell.price.amount}`) : `Seat ${cell.designator} · taken`}>
      {letter}
    </button>
  );
}

function PassengerForm({ offer, seat, pax, setPax, busy, onConfirm, onBack }: { offer: Offer; seat: { id: string; label: string } | null; pax: Passenger; setPax: (p: Passenger) => void; busy: boolean; onConfirm: () => void; onBack: () => void }) {
  return (
    <div className="cc-conn-pax">
      <div className="cc-conn-pax-lead"><span className="title">Who&rsquo;s travelling?</span><span className="fare">{offer.title.split(" · ")[0]} · {money(offer.price.amount, offer.price.currency)}{seat ? ` · seat ${seat.label}` : ""}</span></div>
      <p className="cc-conn-pax-note">Just what the airline needs to issue the ticket.</p>
      <div className="cc-conn-pax-grid">
        <div className="cc-conn-field"><label className="cc-conn-lbl">Title</label><select className="cc-field" value={pax.title} onChange={(e) => setPax({ ...pax, title: e.target.value as Passenger["title"] })}><option value="mr">Mr</option><option value="ms">Ms</option><option value="mrs">Mrs</option><option value="miss">Miss</option></select></div>
        <div className="cc-conn-field"><label className="cc-conn-lbl">Date of birth</label><input className="cc-field" type="date" value={pax.bornOn} onChange={(e) => setPax({ ...pax, bornOn: e.target.value })} /></div>
        <div className="cc-conn-field"><label className="cc-conn-lbl">First name</label><input className="cc-field" value={pax.givenName} onChange={(e) => setPax({ ...pax, givenName: e.target.value })} /></div>
        <div className="cc-conn-field"><label className="cc-conn-lbl">Last name</label><input className="cc-field" value={pax.familyName} onChange={(e) => setPax({ ...pax, familyName: e.target.value })} /></div>
        <div className="cc-conn-field"><label className="cc-conn-lbl">Gender</label><select className="cc-field" value={pax.gender} onChange={(e) => setPax({ ...pax, gender: e.target.value as Passenger["gender"] })}><option value="m">Male</option><option value="f">Female</option></select></div>
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
  return <span className="cc-conn-chip" data-tone={tone}>{children}</span>;
}
function bagLabel(d?: Partial<FlightDetail>): string {
  const carry = d?.carryOn ?? 0, checked = d?.checked ?? 0;
  if (!carry && !checked) return "No bags";
  return [carry ? `${carry} cabin` : null, checked ? `${checked} checked` : null].filter(Boolean).join(" + ");
}
function renderSummary(o: Offer, d?: Partial<FlightDetail>): ReactNode {
  const [times, ...rest] = o.summary.split(" · ");
  const stops = rest.join(" · ");
  return (<><span>{times}</span>{stops ? <span className="stops" data-direct={(d?.stops ?? 0) === 0 ? "true" : "false"}>{stops}</span> : null}</>);
}
function sortFilter(offers: Offer[], sort: Sort, directOnly: boolean, airline: string): Offer[] {
  let out = offers;
  if (directOnly) out = out.filter((o) => ((o.detail as Partial<FlightDetail>)?.stops ?? 0) === 0);
  if (airline) out = out.filter((o) => (o.detail as Partial<FlightDetail>)?.carrier === airline);
  const dur = (o: Offer) => (o.startIso && o.endIso ? new Date(o.endIso).getTime() - new Date(o.startIso).getTime() : Infinity);
  return [...out].sort((a, b) => (sort === "cheapest" ? Number(a.price.amount) - Number(b.price.amount) : dur(a) - dur(b)));
}
function money(amount: string, currency: string): string {
  const n = Number(amount);
  if (Number.isNaN(n)) return `${amount} ${currency}`;
  try { return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(n); } catch { return `${amount} ${currency}`; }
}
