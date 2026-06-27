"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addManualAnchor, addBookingRun } from "@/lib/actions/plan-edit";
import {
  type AccommodationDetails,
  type BoardBasis,
  type BookingChannel,
  BOARD_LABELS,
  CHANNEL_LABELS,
} from "@/lib/accommodation/types";
import { wallClockToIso } from "@/lib/time-zone";
import { TransportHubPicker } from "@/components/transport-hub-picker";
import { ContactPicker, type BoundContact } from "@/components/plan/contact-picker";
import {
  PlacePicker,
  type PlaceSelection,
  type PlacePickerCustomer,
  type PlacePickerCustomerSite,
  type PlacePickerLocation,
} from "@/components/place-picker";

// Manual structured add (planner master brief §4.2) — the precise / fallback
// capture door. Three fact types: an Appointment or Place (bound to a real,
// geocoded place via the PlacePicker so it gets coordinates and routes), or
// Transport as a STANDALONE fact (a train/flight from A to B at a time — no
// fixed anchor required first).

type Kind =
  | "appointment"
  | "dinner"
  | "event"
  | "place"
  | "transport"
  | "accommodation";
type TMode = "train" | "flight";
type Hub = { id: string | null; label: string | null };

export function PlanAdd({
  journeyId,
  journeyDate,
  customers,
  customerSites,
  locations,
  // "primary" renders a prominent always-visible button (the plan topbar's
  // main action); "tile" is the quieter Build-the-day tile. Same sheet either way.
  variant = "tile",
}: {
  journeyId: string;
  journeyDate: string;
  customers: PlacePickerCustomer[];
  customerSites: PlacePickerCustomerSite[];
  locations: PlacePickerLocation[];
  variant?: "tile" | "primary";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("appointment");

  // anchor fields — arrive + leave (a window, e.g. 09:00–17:00). Both optional.
  const [title, setTitle] = useState("");
  const [place, setPlace] = useState<PlaceSelection | null>(null);
  const [arriveBy, setArriveBy] = useState("");
  const [leaveBy, setLeaveBy] = useState("");

  // dinner fields — a reservation: restaurant, date+time, party size, who.
  const [mealDate, setMealDate] = useState(journeyDate);
  const [mealTime, setMealTime] = useState("19:30");
  const [partySize, setPartySize] = useState("");
  const [who, setWho] = useState<BoundContact | null>(null);

  // accommodation fields (check-in-from / check-out-by — constraints, not events)
  const [checkInDate, setCheckInDate] = useState(journeyDate);
  const [checkInTime, setCheckInTime] = useState("15:00");
  const [checkOutDate, setCheckOutDate] = useState(journeyDate);
  const [checkOutTime, setCheckOutTime] = useState("11:00");
  // structured stay detail (ED1) — one object; the arrival payload is the edge
  const [acc, setAcc] = useState<AccommodationDetails>({});
  const [accMore, setAccMore] = useState(false);
  const setA = (patch: Partial<AccommodationDetails>) => setAcc((p) => ({ ...p, ...patch }));

  // transport fields — parity with the brief's booking card (One Toolkit, Two Views):
  // changeovers, service number, seat, class, price.
  const [tmode, setTmode] = useState<TMode>("train");
  const [from, setFrom] = useState<Hub>({ id: null, label: null });
  const [to, setTo] = useState<Hub>({ id: null, label: null });
  const [date, setDate] = useState(journeyDate);
  const [depart, setDepart] = useState("");
  const [arrive, setArrive] = useState("");
  const [reference, setReference] = useState("");
  const [serviceNumber, setServiceNumber] = useState("");
  const [seatNo, setSeatNo] = useState("");
  const [ticketClass, setTicketClass] = useState("");
  const [tprice, setTprice] = useState("");
  type Changeover = { hub: Hub; arriveTime: string; departTime: string };
  const [changeovers, setChangeovers] = useState<Changeover[]>([]);
  const setCo = (idx: number, patch: Partial<Changeover>) =>
    setChangeovers((cs) => cs.map((c, i) => (i === idx ? { ...c, ...patch } : c)));

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function reset() {
    setTitle(""); setPlace(null); setArriveBy(""); setLeaveBy("");
    setMealDate(journeyDate); setMealTime("19:30"); setPartySize(""); setWho(null);
    setFrom({ id: null, label: null }); setTo({ id: null, label: null });
    setDate(journeyDate); setDepart(""); setArrive(""); setReference("");
    setServiceNumber(""); setSeatNo(""); setTicketClass(""); setTprice(""); setChangeovers([]);
    setCheckInDate(journeyDate); setCheckInTime("15:00"); setCheckOutDate(journeyDate); setCheckOutTime("11:00");
    setAcc({}); setAccMore(false);
    setError(null);
  }

  function done(res: { ok: boolean; error?: string }) {
    setPending(false);
    if (!res.ok) {
      setError(res.error ?? "Couldn't add that.");
      return;
    }
    setOpen(false);
    reset();
    router.refresh();
  }

  function save() {
    setError(null);
    if (kind === "transport") {
      if (!from.label || !to.label) {
        setError("Pick where from and where to.");
        return;
      }
      if (!depart || !arrive) {
        setError("Set depart and arrive times.");
        return;
      }
      for (const c of changeovers) {
        if (!c.hub.label) { setError("Pick the changeover station."); return; }
        if (!c.arriveTime || !c.departTime) { setError("Set the changeover's arrive and depart times."); return; }
      }
      // Build the run's segments: from → co1 → … → coN → to. Each changeover is
      // the join between two segments (arrive on one, depart on the next).
      const segments = [] as Parameters<typeof addBookingRun>[0]["segments"];
      let legFrom = from;
      let legDepart = depart;
      for (const c of changeovers) {
        segments.push({ fromHubId: legFrom.id, fromLabel: legFrom.label!, toHubId: c.hub.id, toLabel: c.hub.label!, date, departTime: legDepart, arriveTime: c.arriveTime });
        legFrom = c.hub;
        legDepart = c.departTime;
      }
      segments.push({ fromHubId: legFrom.id, fromLabel: legFrom.label!, toHubId: to.id, toLabel: to.label!, date, departTime: legDepart, arriveTime: arrive, serviceNumber: serviceNumber || null, seat: seatNo || null });
      // Service number / seat sit on the FIRST segment when there are no changeovers.
      if (changeovers.length === 0) { segments[0].serviceNumber = serviceNumber || null; segments[0].seat = seatNo || null; }
      setPending(true);
      void addBookingRun({
        itineraryId: journeyId,
        mode: tmode,
        reference: reference || null,
        price: tprice || null,
        ticketType: ticketClass || null,
        segments,
      }).then(done);
      return;
    }

    if (kind === "accommodation") {
      if (!place?.label) {
        setError("Pick or name the hotel.");
        return;
      }
      setPending(true);
      const ci = wallClockToIso(checkInDate, checkInTime) || null;
      const co = wallClockToIso(checkOutDate, checkOutTime) || null;
      const fcu = acc.free_cancel_until ? wallClockToIso(acc.free_cancel_until, "23:59") || null : null;
      const details: AccommodationDetails = { ...acc, property_name: place.label, free_cancel_until: fcu };
      void addManualAnchor({
        itineraryId: journeyId,
        kind: "accommodation",
        title: place.label,
        locationId: place.kind === "location" ? place.location_id : null,
        customerSiteId: place.kind === "customer_site" ? place.customer_site_id : null,
        iso: ci,
        leaveIso: co,
        details,
      }).then(done);
      return;
    }

    if (kind === "dinner") {
      // A dinner reservation: the restaurant is the place; time is fixed;
      // party size + who ride along as metadata / a bound contact.
      if (!place?.label) {
        setError("Pick or name the restaurant.");
        return;
      }
      setPending(true);
      const iso = mealTime ? wallClockToIso(mealDate, mealTime) || null : null;
      void addManualAnchor({
        itineraryId: journeyId,
        kind: "meal",
        role: "dinner",
        title: title.trim() || place.label,
        locationId: place.kind === "location" ? place.location_id : null,
        customerSiteId: place.kind === "customer_site" ? place.customer_site_id : null,
        iso,
        partySize: partySize ? Number(partySize) : null,
        contactId: who?.id ?? null,
      }).then(done);
      return;
    }

    // Appointment / Event / Place all sit at a place across an arrive→leave
    // window. For a Place the bound place name IS the title; an Appointment or
    // Event keeps its own "what".
    const resolvedTitle = title.trim() || (kind === "place" ? place?.label?.trim() ?? "" : "");
    if (!resolvedTitle) {
      setError(kind === "place" ? "Pick or name a place." : "Give it a name.");
      return;
    }
    setPending(true);
    const iso = arriveBy ? wallClockToIso(journeyDate, arriveBy) || null : null;
    const leaveIso = leaveBy ? wallClockToIso(journeyDate, leaveBy) || null : null;
    void addManualAnchor({
      itineraryId: journeyId,
      kind: kind === "appointment" ? "appointment" : kind === "event" ? "event" : "place",
      title: resolvedTitle,
      locationId: place?.kind === "location" ? place.location_id : null,
      customerSiteId: place?.kind === "customer_site" ? place.customer_site_id : null,
      iso,
      leaveIso,
      contactId: kind === "appointment" ? who?.id ?? null : null,
    }).then(done);
  }

  const hubKind = tmode === "flight" ? "airport" : "rail_station";

  return (
    <>
      {variant === "primary" ? (
        <button type="button" className="cc-btn cc-btn-gold" onClick={() => setOpen(true)}>
          <span aria-hidden>+</span> Add
        </button>
      ) : (
        <button type="button" className="cc-add-trigger" onClick={() => setOpen(true)}>
          <span aria-hidden>+</span> Add
        </button>
      )}

      {open ? (
        <div className="cc-sheet-scrim" onClick={() => setOpen(false)}>
          <div className="cc-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
            <div className="cc-sheet-grip" />
            <header className="cc-sheet-head">
              <span className="cc-eyebrow">Add to your day</span>
              <h3 className="cc-sheet-title">What would you like to add?</h3>
            </header>

            <div className="cc-kind-row">
              {(["appointment", "dinner", "event", "place", "transport", "accommodation"] as Kind[]).map((k) => (
                <button key={k} type="button" className="cc-kind-chip" data-active={kind === k ? "" : undefined} onClick={() => setKind(k)}>
                  {k === "appointment"
                    ? "Appointment"
                    : k === "dinner"
                      ? "Dinner"
                      : k === "event"
                        ? "Event"
                        : k === "place"
                          ? "Place"
                          : k === "transport"
                            ? "Transport"
                            : "Stay"}
                </button>
              ))}
            </div>

            {kind === "transport" ? (
              <>
                <div className="cc-kind-row">
                  <button type="button" className="cc-kind-chip" data-active={tmode === "train" ? "" : undefined} onClick={() => setTmode("train")}>Train</button>
                  <button type="button" className="cc-kind-chip" data-active={tmode === "flight" ? "" : undefined} onClick={() => setTmode("flight")}>Flight</button>
                </div>
                <label className="cc-time-field">
                  <span className="cc-var-label">From</span>
                  <TransportHubPicker kind={hubKind} value={from} onChange={setFrom} name="from" placeholder={tmode === "flight" ? "Departure airport" : "From station"} />
                </label>
                <label className="cc-time-field">
                  <span className="cc-var-label">To</span>
                  <TransportHubPicker kind={hubKind} value={to} onChange={setTo} name="to" placeholder={tmode === "flight" ? "Arrival airport" : "To station"} />
                </label>
                <div className="cc-dur-row">
                  <label>
                    <span className="cc-var-label">Date</span>
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                  </label>
                  <label>
                    <span className="cc-var-label">Depart</span>
                    <input type="time" value={depart} onChange={(e) => setDepart(e.target.value)} />
                  </label>
                  <label>
                    <span className="cc-var-label">Arrive</span>
                    <input type="time" value={arrive} onChange={(e) => setArrive(e.target.value)} />
                  </label>
                </div>

                {/* Changeovers — each splits the journey into two booked legs, like the
                    brief's booking card. */}
                {changeovers.map((co, idx) => (
                  <div key={idx} className="cc-co-row">
                    <div className="cc-co-head">
                      <span className="cc-var-label">{tmode === "flight" ? "Connection" : "Changeover"} {idx + 1}</span>
                      <button type="button" className="cc-co-remove" onClick={() => setChangeovers((cs) => cs.filter((_, i) => i !== idx))} aria-label="Remove changeover">Remove</button>
                    </div>
                    <TransportHubPicker kind={hubKind} value={co.hub} onChange={(h) => setCo(idx, { hub: h })} name={`co-${idx}`} placeholder={tmode === "flight" ? "Connecting airport" : "Changeover station"} />
                    <div className="cc-dur-row">
                      <label>
                        <span className="cc-var-label">Arrive</span>
                        <input type="time" value={co.arriveTime} onChange={(e) => setCo(idx, { arriveTime: e.target.value })} />
                      </label>
                      <label>
                        <span className="cc-var-label">Depart onward</span>
                        <input type="time" value={co.departTime} onChange={(e) => setCo(idx, { departTime: e.target.value })} />
                      </label>
                    </div>
                  </div>
                ))}
                <button type="button" className="cc-co-add" onClick={() => setChangeovers((cs) => [...cs, { hub: { id: null, label: null }, arriveTime: "", departTime: "" }])}>
                  + Add {tmode === "flight" ? "connection" : "changeover"}
                </button>

                <div className="cc-dur-row">
                  <label>
                    <span className="cc-var-label">{tmode === "flight" ? "Flight no." : "Service no."} (optional)</span>
                    <input type="text" value={serviceNumber} onChange={(e) => setServiceNumber(e.target.value)} placeholder={tmode === "flight" ? "BA2772" : "1F23"} />
                  </label>
                  <label>
                    <span className="cc-var-label">Seat (optional)</span>
                    <input type="text" value={seatNo} onChange={(e) => setSeatNo(e.target.value)} placeholder="12A" />
                  </label>
                </div>
                <div className="cc-dur-row">
                  <label>
                    <span className="cc-var-label">{tmode === "flight" ? "Cabin" : "Class"} (optional)</span>
                    <input type="text" value={ticketClass} onChange={(e) => setTicketClass(e.target.value)} placeholder={tmode === "flight" ? "Economy" : "Standard"} />
                  </label>
                  <label>
                    <span className="cc-var-label">Price (optional)</span>
                    <input type="text" value={tprice} onChange={(e) => setTprice(e.target.value)} placeholder="£48.50" />
                  </label>
                </div>
                <label className="cc-time-field">
                  <span className="cc-var-label">Booking ref (optional)</span>
                  <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. MC287441" />
                </label>
              </>
            ) : kind === "accommodation" ? (
              <>
                {/* A stay is a CONSTRAINT, not an event: check-in-from / check-out-by
                    (handover — accommodation is a window the day plans around). */}
                <div className="cc-time-field">
                  <span className="cc-var-label">Hotel</span>
                  <PlacePicker
                    customers={customers}
                    customerSites={customerSites}
                    locations={locations}
                    value={place}
                    onChange={setPlace}
                    placeholder="Search the hotel, or type its name"
                  />
                </div>
                <div className="cc-dur-row">
                  <label>
                    <span className="cc-var-label">Check-in from</span>
                    <input type="date" value={checkInDate} onChange={(e) => setCheckInDate(e.target.value)} />
                  </label>
                  <label>
                    <span className="cc-var-label">Time</span>
                    <input type="time" value={checkInTime} onChange={(e) => setCheckInTime(e.target.value)} />
                  </label>
                </div>
                <div className="cc-dur-row">
                  <label>
                    <span className="cc-var-label">Check-out by</span>
                    <input type="date" value={checkOutDate} onChange={(e) => setCheckOutDate(e.target.value)} />
                  </label>
                  <label>
                    <span className="cc-var-label">Time</span>
                    <input type="time" value={checkOutTime} onChange={(e) => setCheckOutTime(e.target.value)} />
                  </label>
                </div>
                <div className="cc-dur-row">
                  <label>
                    <span className="cc-var-label">Confirmation</span>
                    <input type="text" value={acc.confirmation_ref ?? ""} onChange={(e) => setA({ confirmation_ref: e.target.value })} placeholder="Booking ref" />
                  </label>
                  <label>
                    <span className="cc-var-label">Booked via</span>
                    <select value={acc.channel ?? ""} onChange={(e) => setA({ channel: (e.target.value || null) as BookingChannel | null })}>
                      <option value="">—</option>
                      {(Object.keys(CHANNEL_LABELS) as BookingChannel[]).map((c) => (
                        <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="cc-dur-row">
                  <label>
                    <span className="cc-var-label">Room</span>
                    <input type="text" value={acc.room_type ?? ""} onChange={(e) => setA({ room_type: e.target.value })} placeholder="e.g. King, 2 guests" />
                  </label>
                  <label>
                    <span className="cc-var-label">Board</span>
                    <select value={acc.board_basis ?? ""} onChange={(e) => setA({ board_basis: (e.target.value || null) as BoardBasis | null })}>
                      <option value="">—</option>
                      {(Object.keys(BOARD_LABELS) as BoardBasis[]).map((b) => (
                        <option key={b} value={b}>{BOARD_LABELS[b]}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <button type="button" className="cc-stay-expand" aria-expanded={accMore} onClick={() => setAccMore((v) => !v)}>
                  <span className="cc-chev" aria-hidden>›</span>
                  Arrival details (wifi, parking, check-in…)
                </button>
                {accMore ? (
                  <div className="cc-stay-detail">
                    <label className="cc-stay-wide">
                      <span className="cc-var-label">Hotel phone</span>
                      <input type="tel" value={acc.phone ?? ""} onChange={(e) => setA({ phone: e.target.value })} placeholder="For 'hold my room, running late'" />
                    </label>
                    <label className="cc-stay-wide">
                      <span className="cc-var-label">Check-in / access</span>
                      <input type="text" value={acc.access_instructions ?? ""} onChange={(e) => setA({ access_instructions: e.target.value })} placeholder="Front desk · or lockbox code" />
                    </label>
                    <label>
                      <span className="cc-var-label">Wi-Fi network</span>
                      <input type="text" value={acc.wifi_ssid ?? ""} onChange={(e) => setA({ wifi_ssid: e.target.value })} />
                    </label>
                    <label>
                      <span className="cc-var-label">Wi-Fi password</span>
                      <input type="text" value={acc.wifi_password ?? ""} onChange={(e) => setA({ wifi_password: e.target.value })} />
                    </label>
                    <label className="cc-stay-wide">
                      <span className="cc-var-label">Parking</span>
                      <input type="text" value={acc.parking_info ?? ""} onChange={(e) => setA({ parking_info: e.target.value })} placeholder="On-site £18/night · or none" />
                    </label>
                    <label className="cc-stay-wide">
                      <span className="cc-var-label">Breakfast hours</span>
                      <input type="text" value={acc.breakfast_window ?? ""} onChange={(e) => setA({ breakfast_window: e.target.value })} placeholder="07:00–10:30" />
                    </label>
                    <label className="cc-stay-wide">
                      <span className="cc-var-label">Cancellation</span>
                      <input type="text" value={acc.cancellation_policy ?? ""} onChange={(e) => setA({ cancellation_policy: e.target.value })} placeholder="Free cancellation policy" />
                    </label>
                    <label>
                      <span className="cc-var-label">Free-cancel until</span>
                      <input type="date" value={acc.free_cancel_until ?? ""} onChange={(e) => setA({ free_cancel_until: e.target.value })} />
                    </label>
                    <label>
                      <span className="cc-var-label">Price</span>
                      <input type="text" value={acc.price ?? ""} onChange={(e) => setA({ price: e.target.value })} placeholder="£240" />
                    </label>
                  </div>
                ) : null}
              </>
            ) : kind === "dinner" ? (
              <>
                {/* A dinner reservation: the restaurant, a fixed time, how many,
                    and who. Its own bespoke fields — nothing extraneous. */}
                <div className="cc-time-field">
                  <span className="cc-var-label">Restaurant</span>
                  <PlacePicker
                    customers={customers}
                    customerSites={customerSites}
                    locations={locations}
                    value={place}
                    onChange={setPlace}
                    googleTypes="restaurant"
                    placeholder="Search the restaurant, or type its name"
                  />
                </div>
                <div className="cc-dur-row">
                  <label>
                    <span className="cc-var-label">Date</span>
                    <input type="date" value={mealDate} onChange={(e) => setMealDate(e.target.value)} />
                  </label>
                  <label>
                    <span className="cc-var-label">Time</span>
                    <input type="time" value={mealTime} onChange={(e) => setMealTime(e.target.value)} />
                  </label>
                  <label>
                    <span className="cc-var-label">Party size</span>
                    <input type="number" min="1" max="50" value={partySize} onChange={(e) => setPartySize(e.target.value)} placeholder="2" />
                  </label>
                </div>
                <div className="cc-time-field">
                  <span className="cc-var-label">Who’s coming (optional)</span>
                  <ContactPicker value={who} onChange={setWho} />
                </div>
                <label className="cc-time-field">
                  <span className="cc-var-label">Name (optional)</span>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Birthday dinner" />
                </label>
              </>
            ) : (
              <>
                {/* An Appointment or Event has its own name ("what"), distinct from
                    where it happens. A Place IS its place — one search box, no
                    separate name field (the picked place's name becomes the title). */}
                {kind === "appointment" || kind === "event" ? (
                  <label className="cc-time-field">
                    <span className="cc-var-label">What</span>
                    <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                      placeholder={kind === "event" ? "Keynote, show, expo…" : "Client meeting"} autoFocus />
                  </label>
                ) : null}
                {/* NOT a <label>: PlacePicker renders its own input plus a
                    dropdown of <button> options. A wrapping <label> forwards
                    clicks to its control, which swallowed the option click and
                    left the selection unsaved. Use a plain div. */}
                <div className="cc-time-field">
                  <span className="cc-var-label">{kind === "place" ? "Place" : "Where"}</span>
                  <PlacePicker
                    customers={customers}
                    customerSites={customerSites}
                    locations={locations}
                    value={place}
                    onChange={setPlace}
                    placeholder={kind === "place" ? "Search a place, or type a new one" : "Search where it happens"}
                  />
                </div>
                {/* Arrive + leave — set both for a window ("at the office 9 to 5"),
                    or just one. The day solver fills the rest around it. */}
                <div className="cc-dur-row">
                  <label>
                    <span className="cc-var-label">Arrive by</span>
                    <input type="time" value={arriveBy} onChange={(e) => setArriveBy(e.target.value)} />
                  </label>
                  <label>
                    <span className="cc-var-label">Leave by</span>
                    <input type="time" value={leaveBy} onChange={(e) => setLeaveBy(e.target.value)} />
                  </label>
                </div>
                {kind === "appointment" ? (
                  <div className="cc-time-field">
                    <span className="cc-var-label">Who (optional)</span>
                    <ContactPicker value={who} onChange={setWho} />
                  </div>
                ) : null}
                <p style={{ marginTop: "calc(-1 * var(--space-1))", fontSize: "var(--fs-micro)", color: "var(--ink-faint)" }}>
                  Set both for a window, e.g. 09:00 to 17:00. Leave blank if it’s flexible.
                </p>
              </>
            )}

            {error ? <p className="cc-sheet-error">{error}</p> : null}

            <div className="cc-sheet-actions">
              <button type="button" className="cc-btn cc-btn-ghost" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </button>
              <button type="button" className="cc-btn cc-btn-gold" onClick={save} disabled={pending}>
                {pending ? "Adding…" : "Add it"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
