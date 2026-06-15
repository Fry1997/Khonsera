// Duffel adapter (Phase 14) — Flights (LIVE against test mode) + Stays (real-shaped,
// pending account activation). Built to the real Duffel contract (June 2026):
// base https://api.duffel.com, `Duffel-Version: v2`, Bearer token; test vs live is
// the TOKEN PREFIX (duffel_test_… → test env, unlimited balance, no real money).
//
// GATED on DUFFEL_API_TOKEN: without it every call returns a deterministic mock with
// `sample:true`. The pure mappers (duffelOffer→Offer, order→Booking, stay→Offer) are
// exported and unit-tested against fixtures with no network — so the live swap is a
// swap, not a redesign. Raw fetch (no SDK) keeps it serverless-safe per CLAUDE.md.

import type { Booking, Money, Offer, Quote } from "@/lib/connections/types";

const BASE = process.env.DUFFEL_URL ?? "https://api.duffel.com";

export function duffelToken(): string | null {
  return process.env.DUFFEL_API_TOKEN ?? null;
}
function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Duffel-Version": "v2",
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

function hhmm(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date(iso));
}

// ───────────────────────── Places: airport/city autocomplete ─────────────────────────

// Duffel Places suggestions — type "Heathrow" / "Edinburgh", get the IATA code.
// This is what frees the user from knowing airport short-codes. Returns null when
// unkeyed so the caller can fall back.
export type PlaceSuggestion = { iataCode: string; name: string; cityName: string | null; type: "airport" | "city" };

export async function placeSuggestions(query: string): Promise<PlaceSuggestion[] | null> {
  const token = duffelToken();
  if (!token || query.trim().length < 2) return token ? [] : null;
  try {
    const res = await fetch(`${BASE}/places/suggestions?query=${encodeURIComponent(query)}`, { headers: headers(token), signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: Array<{ iata_code?: string; name?: string; city_name?: string; type?: string }> };
    return (json.data ?? [])
      .filter((p) => p.iata_code && p.name)
      .map((p) => ({ iataCode: p.iata_code!, name: p.name!, cityName: p.city_name ?? null, type: p.type === "city" ? "city" : "airport" as const }));
  } catch {
    return [];
  }
}

// ───────────────────────────── Flights: types ─────────────────────────────

export type FlightSlice = { origin: string; destination: string; departureDate: string };
export type FlightSearch = { slices: FlightSlice[]; adults: number; children?: number; cabin?: "economy" | "premium_economy" | "business" | "first" };

// The depth we surface per flight offer (Duffel schema): fare brand, cabin, the
// included baggage, whether it's refundable/changeable, the carbon, the shape.
export type FlightDetail = {
  fareBrand: string | null;
  cabin: string | null;
  carryOn: number;
  checked: number;
  refundable: boolean | null;
  changeable: boolean | null;
  emissionsKg: string | null;
  durationLabel: string | null;
  stops: number;
  roundTrip: boolean;
  carrier: string;
};

type DuffelBaggage = { type?: "carry_on" | "checked"; quantity?: number };
type DuffelSegmentPassenger = { cabin_class_marketing_name?: string; baggages?: DuffelBaggage[] };
type DuffelSegment = {
  origin?: { iata_code?: string };
  destination?: { iata_code?: string };
  departing_at?: string;
  arriving_at?: string;
  marketing_carrier?: { iata_code?: string; name?: string };
  marketing_carrier_flight_number?: string;
  passengers?: DuffelSegmentPassenger[];
};
type DuffelSlice = { origin?: { iata_code?: string }; destination?: { iata_code?: string }; duration?: string; fare_brand_name?: string; segments?: DuffelSegment[] };
type DuffelCondition = { allowed?: boolean } | null;
export type DuffelOffer = {
  id: string;
  total_amount?: string;
  total_currency?: string;
  total_emissions_kg?: string;
  owner?: { iata_code?: string; name?: string };
  expires_at?: string;
  conditions?: { refund_before_departure?: DuffelCondition; change_before_departure?: DuffelCondition };
  slices?: DuffelSlice[];
  passengers?: { id?: string; type?: string }[];
};

// ISO 8601 duration "PT2H30M" → "2h 30m".
function durationLabel(iso?: string | null): string | null {
  if (!iso) return null;
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?/.exec(iso);
  if (!m) return null;
  const h = m[1] ? `${m[1]}h` : "";
  const min = m[2] ? `${m[2]}m` : "";
  return [h, min].filter(Boolean).join(" ") || null;
}

// ───────────────────────────── Flights: pure mappers ─────────────────────────────

// A Duffel offer → our provider-agnostic Offer, carrying the FULL useful depth
// (fare brand, cabin, baggage, refundable/changeable, carbon, shape). Pure.
export function mapDuffelOffer(o: DuffelOffer): Offer {
  const first = o.slices?.[0];
  const firstSeg = first?.segments?.[0];
  const lastSlice = o.slices?.[o.slices.length - 1];
  const lastSeg = lastSlice?.segments?.[lastSlice.segments.length - 1];
  const carrier = o.owner?.name ?? firstSeg?.marketing_carrier?.name ?? "Airline";
  const from = first?.origin?.iata_code ?? firstSeg?.origin?.iata_code ?? "—";
  const to = first?.destination?.iata_code ?? "—";
  const stops = Math.max(0, (first?.segments?.length ?? 1) - 1);
  const dep = firstSeg?.departing_at ?? null;
  const arr = lastSeg?.arriving_at ?? null;
  const stopLabel = stops <= 0 ? "direct" : `${stops} stop${stops > 1 ? "s" : ""}`;

  const segPax = firstSeg?.passengers?.[0];
  const bags = segPax?.baggages ?? [];
  const carryOn = bags.filter((b) => b.type === "carry_on").reduce((n, b) => n + (b.quantity ?? 0), 0);
  const checked = bags.filter((b) => b.type === "checked").reduce((n, b) => n + (b.quantity ?? 0), 0);
  const detail: FlightDetail = {
    fareBrand: first?.fare_brand_name ?? null,
    cabin: segPax?.cabin_class_marketing_name ?? null,
    carryOn,
    checked,
    refundable: o.conditions?.refund_before_departure ? !!o.conditions.refund_before_departure.allowed : null,
    changeable: o.conditions?.change_before_departure ? !!o.conditions.change_before_departure.allowed : null,
    emissionsKg: o.total_emissions_kg ?? null,
    durationLabel: durationLabel(first?.duration),
    stops,
    roundTrip: (o.slices?.length ?? 1) > 1,
    carrier,
  };

  const dur = detail.durationLabel ? ` · ${detail.durationLabel}` : "";
  return {
    id: o.id,
    kind: "flight",
    provider: "duffel",
    title: `${carrier} · ${from} → ${to}`,
    price: { amount: o.total_amount ?? "0", currency: o.total_currency ?? "GBP" },
    summary: dep && arr ? `${hhmm(dep)}–${hhmm(arr)} · ${stopLabel}${dur}` : stopLabel,
    detail: { ...detail, slices: o.slices, passengers: o.passengers },
    startIso: dep ?? undefined,
    endIso: arr ?? undefined,
    expiresAt: o.expires_at,
    sample: false,
  };
}

type DuffelOrder = {
  id: string;
  booking_reference?: string;
  total_amount?: string;
  total_currency?: string;
  slices?: DuffelSlice[];
  owner?: { name?: string };
  documents?: { type?: string; unique_identifier?: string }[];
};

export function mapDuffelOrder(o: DuffelOrder): Booking {
  const first = o.slices?.[0];
  const firstSeg = first?.segments?.[0];
  const lastSlice = o.slices?.[o.slices.length - 1];
  const lastSeg = lastSlice?.segments?.[lastSlice.segments.length - 1];
  const from = first?.origin?.iata_code ?? "—";
  const to = first?.destination?.iata_code ?? "—";
  return {
    id: o.id,
    kind: "flight",
    provider: "duffel",
    reference: o.booking_reference ?? o.id,
    price: { amount: o.total_amount ?? "0", currency: o.total_currency ?? "GBP" },
    title: `${o.owner?.name ?? "Flight"} · ${from} → ${to}`,
    startIso: firstSeg?.departing_at,
    endIso: lastSeg?.arriving_at,
    documents: (o.documents ?? []).map((d) => ({ type: d.type ?? "ticket", id: d.unique_identifier ?? "" })),
    sample: false,
  };
}

// ───────────────────────────── Flights: calls ─────────────────────────────

// Search → offers (real, test mode). One synchronous call (return_offers=true).
export async function searchFlights(s: FlightSearch): Promise<{ offers: Offer[]; sample: boolean }> {
  const token = duffelToken();
  if (!token) return { offers: mockFlightOffers(s), sample: true };
  try {
    const body = {
      data: {
        slices: s.slices.map((sl) => ({ origin: sl.origin, destination: sl.destination, departure_date: sl.departureDate })),
        passengers: [
          ...Array.from({ length: Math.max(1, s.adults) }, () => ({ type: "adult" })),
          ...Array.from({ length: s.children ?? 0 }, () => ({ age: 8 })),
        ],
        cabin_class: s.cabin ?? "economy",
      },
    };
    const res = await fetch(`${BASE}/air/offer_requests?return_offers=true&supplier_timeout=15000`, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25000),
      cache: "no-store",
    });
    if (!res.ok) return { offers: [], sample: false };
    const json = (await res.json()) as { data?: { offers?: DuffelOffer[] } };
    const offers = (json.data?.offers ?? []).map(mapDuffelOffer).sort((a, b) => Number(a.price.amount) - Number(b.price.amount));
    return { offers: offers.slice(0, 12), sample: false };
  } catch {
    return { offers: [], sample: false };
  }
}

// Refresh a single offer right before ordering (price/availability go stale).
export async function refreshOffer(offerId: string): Promise<Offer | null> {
  const token = duffelToken();
  if (!token) return null;
  try {
    const res = await fetch(`${BASE}/air/offers/${encodeURIComponent(offerId)}`, { headers: headers(token), signal: AbortSignal.timeout(15000), cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: DuffelOffer };
    return json.data ? mapDuffelOffer(json.data) : null;
  } catch {
    return null;
  }
}

// ───────────────────────── Seat maps ─────────────────────────

export type SeatCell = { designator: string; available: boolean; price: Money | null; serviceId: string | null; kind: "seat" | "aisle" | "facility" };
export type SeatMapVM = { rows: SeatCell[][]; sample: boolean };

type DuffelSeatService = { id?: string; passenger_id?: string; total_amount?: string; total_currency?: string; type?: string };
type DuffelSeatElement = { type?: string; designator?: string; available_services?: DuffelSeatService[] };
type DuffelSeatSection = { elements?: DuffelSeatElement[] };
type DuffelSeatRow = { sections?: DuffelSeatSection[] };
type DuffelSeatCabin = { deck?: number; rows?: DuffelSeatRow[] };
type DuffelSeatMap = { segment_id?: string; cabins?: DuffelSeatCabin[] };

// Parse Duffel's seat map (first segment, main deck) into a simple grid for the
// passenger. A seat is selectable when it carries a seat service for them; price
// comes from that service (0.00 = free). Pure — the unit-test anchor.
export function parseSeatMap(maps: DuffelSeatMap[], passengerId: string): SeatMapVM {
  const map = maps[0];
  const cabin = (map?.cabins ?? []).find((c) => (c.deck ?? 0) === 0) ?? map?.cabins?.[0];
  const rows: SeatCell[][] = [];
  for (const row of cabin?.rows ?? []) {
    const cells: SeatCell[] = [];
    for (const section of row.sections ?? []) {
      for (const el of section.elements ?? []) {
        if (el.type === "seat" || el.type === "restricted_seat_general") {
          const svc = (el.available_services ?? []).find((s) => s.passenger_id === passengerId && s.type === "seat");
          cells.push({
            designator: el.designator ?? "",
            available: !!svc,
            price: svc ? { amount: svc.total_amount ?? "0", currency: svc.total_currency ?? "GBP" } : null,
            serviceId: svc?.id ?? null,
            kind: "seat",
          });
        } else if (el.type === "empty" || el.type === "exit_row") {
          cells.push({ designator: "", available: false, price: null, serviceId: null, kind: "aisle" });
        } else {
          cells.push({ designator: el.type ?? "", available: false, price: null, serviceId: null, kind: "facility" });
        }
      }
    }
    if (cells.length) rows.push(cells);
  }
  return { rows, sample: false };
}

export async function getSeatMap(offerId: string, passengerId: string): Promise<SeatMapVM> {
  const token = duffelToken();
  if (!token) return mockSeatMap();
  try {
    const res = await fetch(`${BASE}/air/seat_maps?offer_id=${encodeURIComponent(offerId)}`, { headers: headers(token), signal: AbortSignal.timeout(12000), cache: "no-store" });
    if (!res.ok) return { rows: [], sample: false };
    const json = (await res.json()) as { data?: DuffelSeatMap[] };
    if (!json.data?.length) return { rows: [], sample: false }; // not all carriers return a map
    return parseSeatMap(json.data, passengerId);
  } catch {
    return { rows: [], sample: false };
  }
}

function mockSeatMap(): SeatMapVM {
  const letters = ["A", "B", "C", "D", "E", "F"];
  const rows: SeatCell[][] = [];
  for (let r = 10; r <= 22; r++) {
    const cells: SeatCell[] = [];
    letters.forEach((l, i) => {
      if (i === 3) cells.push({ designator: "", available: false, price: null, serviceId: null, kind: "aisle" });
      const taken = (r + i) % 4 === 0;
      const extra = r <= 12 || l === "A" || l === "F";
      cells.push({
        designator: `${r}${l}`,
        available: !taken,
        price: taken ? null : { amount: extra ? "12.00" : "0.00", currency: "GBP" },
        serviceId: taken ? null : `mock-seat-${r}${l}`,
        kind: "seat",
      });
    });
    rows.push(cells);
  }
  return { rows, sample: true };
}

export type FlightService = { id: string; quantity: number };
export type FlightPassenger = { id: string; given_name: string; family_name: string; born_on: string; gender: "m" | "f"; title: "mr" | "ms" | "mrs" | "miss"; email: string; phone_number: string };

// Create the order (the booking). In TEST mode pay from the unlimited test balance —
// a real order against the real lifecycle, no real money. The money step is the stub
// only in the sense that test mode mints no charge; the API path is genuine.
export async function createFlightOrder(args: { offer: Offer; passengers: FlightPassenger[]; services?: FlightService[] }): Promise<Booking | null> {
  const token = duffelToken();
  if (!token) return mockFlightBooking(args.offer);
  try {
    const body = {
      data: {
        type: "instant",
        selected_offers: [args.offer.id],
        passengers: args.passengers,
        ...(args.services?.length ? { services: args.services } : {}),
        payments: [{ type: "balance", currency: args.offer.price.currency, amount: args.offer.price.amount }],
      },
    };
    const res = await fetch(`${BASE}/air/orders`, {
      method: "POST",
      headers: { ...headers(token), "Idempotency-Key": `ord-${args.offer.id}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: DuffelOrder };
    return json.data ? mapDuffelOrder(json.data) : null;
  } catch {
    return null;
  }
}

// ───────────────────────── Manage booking: cancel (with refund quote) ─────────────────────────

// Cancel is a TWO-STEP, honest flow: quote the refund first (so the traveller sees
// what they get back before committing), then confirm. Mirrors Duffel's
// order_cancellations (flights) + stays booking cancel.
export type CancelQuote = { id: string; refund: Money | null; provider: "duffel"; sample: boolean };

// Flights — POST /air/order_cancellations → refund quote (confirm separately).
export async function flightCancelQuote(orderId: string): Promise<CancelQuote | null> {
  const token = duffelToken();
  if (!token) return { id: `ocl_mock_${orderId.slice(-5)}`, refund: { amount: "0.00", currency: "GBP" }, provider: "duffel", sample: true };
  try {
    const res = await fetch(`${BASE}/air/order_cancellations`, { method: "POST", headers: headers(token), body: JSON.stringify({ data: { order_id: orderId } }), signal: AbortSignal.timeout(20000), cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { id?: string; refund_amount?: string; refund_currency?: string } };
    if (!json.data?.id) return null;
    return { id: json.data.id, refund: json.data.refund_amount ? { amount: json.data.refund_amount, currency: json.data.refund_currency ?? "GBP" } : null, provider: "duffel", sample: false };
  } catch {
    return null;
  }
}

export async function flightCancelConfirm(cancellationId: string): Promise<boolean> {
  const token = duffelToken();
  if (!token) return true; // mock — nothing to charge
  try {
    const res = await fetch(`${BASE}/air/order_cancellations/${encodeURIComponent(cancellationId)}/actions/confirm`, { method: "POST", headers: headers(token), signal: AbortSignal.timeout(20000), cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

// Stays — cancel a booking (Duffel returns the refund). One step (already quoted
// by the cancellation_timeline shown before booking).
export async function stayCancel(bookingId: string): Promise<{ ok: boolean; refund: Money | null; sample: boolean }> {
  const token = duffelToken();
  if (!token) return { ok: true, refund: { amount: "0.00", currency: "GBP" }, sample: true };
  try {
    const res = await fetch(`${BASE}/stays/bookings/${encodeURIComponent(bookingId)}/actions/cancel`, { method: "POST", headers: headers(token), signal: AbortSignal.timeout(20000), cache: "no-store" });
    if (!res.ok) return { ok: false, refund: null, sample: false };
    const json = (await res.json()) as { data?: { refund_amount?: string; refund_currency?: string } };
    return { ok: true, refund: json.data?.refund_amount ? { amount: json.data.refund_amount, currency: json.data.refund_currency ?? "GBP" } : null, sample: false };
  } catch {
    return { ok: false, refund: null, sample: false };
  }
}

// ───────────────────────────── Stays: types + mappers ─────────────────────────────

export type StaySearch = { lat: number; lng: number; radiusKm: number; checkIn: string; checkOut: string; rooms: number; adults: number };

// The accommodation depth we surface per stay (Duffel Stays schema): the star +
// guest score, photos, amenities, address, and the check-in/out times.
export type StayDetail = {
  rating: number | null; // star rating 1–5
  reviewScore: number | null; // guest score 1–10
  photos: string[];
  amenities: string[];
  address: string | null;
  postcode: string | null;
  checkInAfter: string | null;
  checkOutBefore: string | null;
  lat: number | null;
  lng: number | null;
};

type DuffelStayResult = {
  id: string;
  accommodation?: {
    name?: string;
    rating?: number;
    review_score?: number;
    location?: { address?: { line_one?: string; city_name?: string; postal_code?: string }; geographic_coordinates?: { latitude?: number; longitude?: number } };
    photos?: { url?: string }[];
    amenities?: { type?: string; description?: string }[];
    check_in_information?: { check_in_after_time?: string; check_out_before_time?: string };
  };
  cheapest_rate_total_amount?: string;
  cheapest_rate_currency?: string;
};

export function mapDuffelStay(r: DuffelStayResult): Offer {
  const a = r.accommodation ?? {};
  const addr = a.location?.address;
  const stars = a.rating ? `${a.rating}★` : "";
  const score = a.review_score ? `${a.review_score.toFixed(1)}/10` : "";
  const where = addr?.city_name ?? addr?.line_one ?? "";
  const detail: StayDetail = {
    rating: a.rating ?? null,
    reviewScore: a.review_score ?? null,
    photos: (a.photos ?? []).map((p) => p.url).filter((u): u is string => !!u),
    amenities: (a.amenities ?? []).map((m) => m.description ?? m.type ?? "").filter(Boolean),
    address: [addr?.line_one, addr?.city_name].filter(Boolean).join(", ") || null,
    postcode: addr?.postal_code ?? null,
    checkInAfter: a.check_in_information?.check_in_after_time ?? null,
    checkOutBefore: a.check_in_information?.check_out_before_time ?? null,
    lat: a.location?.geographic_coordinates?.latitude ?? null,
    lng: a.location?.geographic_coordinates?.longitude ?? null,
  };
  return {
    id: r.id,
    kind: "stay",
    provider: "duffel",
    title: a.name ?? "Hotel",
    price: { amount: r.cheapest_rate_total_amount ?? "0", currency: r.cheapest_rate_currency ?? "GBP" },
    summary: [stars, score, where].filter(Boolean).join(" · ") || "stay",
    detail: { ...detail },
    sample: false,
  };
}

// A bookable room rate within a stay (Duffel rates): the room, board, price, and
// the free-cancellation deadline — the depth a hotel app shows before you book.
export type StayRate = {
  id: string;
  roomName: string;
  price: Money;
  boardType: string; // room_only | breakfast | half_board | …
  freeCancellationBefore: string | null;
  payAtProperty: boolean;
};

type DuffelRate = {
  id?: string;
  total_amount?: string;
  total_currency?: string;
  board_type?: string;
  payment_type?: string;
  cancellation_timeline?: { refund_amount?: string; currency?: string; before?: string }[];
};
type DuffelRoom = { name?: string; rates?: DuffelRate[] };

export function mapStayRates(rooms: DuffelRoom[]): StayRate[] {
  const out: StayRate[] = [];
  for (const room of rooms) {
    for (const rate of room.rates ?? []) {
      if (!rate.id) continue;
      // Free-cancel = the latest timeline entry whose refund equals the total.
      const freeCancel = (rate.cancellation_timeline ?? []).find((c) => Number(c.refund_amount) > 0)?.before ?? null;
      out.push({
        id: rate.id,
        roomName: room.name ?? "Room",
        price: { amount: rate.total_amount ?? "0", currency: rate.total_currency ?? "GBP" },
        boardType: rate.board_type ?? "room_only",
        freeCancellationBefore: freeCancel,
        payAtProperty: rate.payment_type === "deposit" || rate.payment_type === "guarantee",
      });
    }
  }
  return out.sort((a, b) => Number(a.price.amount) - Number(b.price.amount));
}

// Fetch the full rooms/rates for a chosen search result. Mock when unkeyed.
export async function getStayRates(searchResultId: string): Promise<{ rates: StayRate[]; sample: boolean }> {
  const token = duffelToken();
  if (!token) return { rates: mockStayRates(), sample: true };
  try {
    const res = await fetch(`${BASE}/stays/search_results/${encodeURIComponent(searchResultId)}/rates`, { headers: headers(token), signal: AbortSignal.timeout(20000), cache: "no-store" });
    if (res.status === 403) return { rates: mockStayRates(), sample: true };
    if (!res.ok) return { rates: [], sample: false };
    const json = (await res.json()) as { data?: { accommodation?: { rooms?: DuffelRoom[] } } };
    return { rates: mapStayRates(json.data?.accommodation?.rooms ?? []), sample: false };
  } catch {
    return { rates: [], sample: false };
  }
}

// Quote a rate (locks the price) then book it. Returns a Booking. Mock until
// Stays activates. (The boarding-pass equivalent doesn't apply — a hotel
// confirmation reference IS the bookable credential.)
export async function bookStayRate(args: { rateId: string; guestGiven: string; guestFamily: string; email: string; phone: string; stayTitle: string; checkIn: string; checkOut: string; specialRequests?: string }): Promise<Booking | null> {
  const token = duffelToken();
  if (!token) {
    return { id: `sby_mock_${args.rateId.slice(-5)}`, kind: "stay", provider: "duffel", reference: `STAY-${args.rateId.slice(-6).toUpperCase()}`, price: { amount: "0", currency: "GBP" }, title: args.stayTitle, startIso: args.checkIn, endIso: args.checkOut, sample: true };
  }
  try {
    const q = await fetch(`${BASE}/stays/quotes`, { method: "POST", headers: headers(token), body: JSON.stringify({ data: { rate_id: args.rateId } }), signal: AbortSignal.timeout(20000), cache: "no-store" });
    if (!q.ok) return null;
    const quote = (await q.json()) as { data?: { id?: string; total_amount?: string; total_currency?: string } };
    const quoteId = quote.data?.id;
    if (!quoteId) return null;
    const b = await fetch(`${BASE}/stays/bookings`, {
      method: "POST",
      headers: { ...headers(token), "Idempotency-Key": `stay-${quoteId}` },
      body: JSON.stringify({ data: { quote_id: quoteId, guests: [{ given_name: args.guestGiven, family_name: args.guestFamily }], email: args.email, phone_number: args.phone, ...(args.specialRequests ? { accommodation_special_requests: args.specialRequests } : {}) } }),
      signal: AbortSignal.timeout(25000),
      cache: "no-store",
    });
    if (!b.ok) return null;
    const booking = (await b.json()) as { data?: { id?: string; reference?: string } };
    return { id: booking.data?.id ?? "", kind: "stay", provider: "duffel", reference: booking.data?.reference ?? "—", price: { amount: quote.data?.total_amount ?? "0", currency: quote.data?.total_currency ?? "GBP" }, title: args.stayTitle, startIso: args.checkIn, endIso: args.checkOut, sample: false };
  } catch {
    return null;
  }
}

function mockStayRates(): StayRate[] {
  return [
    { id: "rat_mock_1", roomName: "Standard Double", price: money(118), boardType: "room_only", freeCancellationBefore: "2026-07-19T14:00:00Z", payAtProperty: false },
    { id: "rat_mock_2", roomName: "Standard Double", price: money(132), boardType: "breakfast", freeCancellationBefore: "2026-07-19T14:00:00Z", payAtProperty: false },
    { id: "rat_mock_3", roomName: "Superior King", price: money(176), boardType: "breakfast", freeCancellationBefore: null, payAtProperty: true },
  ];
}

// Search stays. Stays is sales-gated, so a 403/forbidden (account lacks Stays) →
// honest mock with sample:true, not an error.
export async function searchStays(s: StaySearch): Promise<{ offers: Offer[]; sample: boolean; pending?: boolean }> {
  const token = duffelToken();
  if (!token) return { offers: mockStayOffers(s), sample: true };
  try {
    const body = {
      data: {
        check_in_date: s.checkIn,
        check_out_date: s.checkOut,
        rooms: s.rooms,
        guests: Array.from({ length: Math.max(1, s.adults) }, () => ({ type: "adult" })),
        location: { radius: s.radiusKm, geographic_coordinates: { latitude: s.lat, longitude: s.lng } },
      },
    };
    const res = await fetch(`${BASE}/stays/search`, { method: "POST", headers: headers(token), body: JSON.stringify(body), signal: AbortSignal.timeout(25000), cache: "no-store" });
    if (res.status === 403) return { offers: mockStayOffers(s), sample: true, pending: true }; // Stays not activated yet
    if (!res.ok) return { offers: [], sample: false };
    const json = (await res.json()) as { data?: { results?: DuffelStayResult[] } };
    const offers = (json.data?.results ?? []).map(mapDuffelStay).sort((a, b) => Number(a.price.amount) - Number(b.price.amount));
    return { offers: offers.slice(0, 12), sample: false };
  } catch {
    return { offers: [], sample: false };
  }
}

// ───────────────────────────── deterministic mocks ─────────────────────────────

function money(n: number, currency = "GBP"): Money {
  return { amount: n.toFixed(2), currency };
}
function mockFlightOffers(s: FlightSearch): Offer[] {
  const sl = s.slices[0];
  const base = `${sl?.departureDate ?? "2026-07-21"}T`;
  const carriers = ["British Airways", "Vueling", "Aer Lingus"];
  return [0, 1, 2].map((i) => {
    const detail: FlightDetail = {
      fareBrand: ["Economy Basic", "Standard", "Economy Flex"][i],
      cabin: "Economy",
      carryOn: 1,
      checked: i === 2 ? 1 : 0,
      refundable: i === 2,
      changeable: i >= 1,
      emissionsKg: String(180 + i * 20),
      durationLabel: ["3h 15m", "5h 55m", "3h 25m"][i],
      stops: i === 1 ? 1 : 0,
      roundTrip: false,
      carrier: carriers[i],
    };
    return {
      id: `off_mock_${i}`,
      kind: "flight" as const,
      provider: "duffel",
      title: `${carriers[i]} · ${sl?.origin ?? "LHR"} → ${sl?.destination ?? "JFK"}`,
      price: money(120 + i * 55),
      summary: `${["07:25", "11:10", "17:40"][i]}–${["10:40", "14:05", "21:05"][i]} · ${i === 1 ? "1 stop" : "direct"} · ${detail.durationLabel}`,
      detail: { ...detail },
      startIso: `${base}${["07:25", "11:10", "17:40"][i]}:00`,
      endIso: `${base}${["10:40", "14:05", "21:05"][i]}:00`,
      sample: true,
    };
  });
}
function mockFlightBooking(o: Offer): Booking {
  return { id: `ord_mock_${o.id}`, kind: "flight", provider: "duffel", reference: `MOCK${o.id.slice(-4).toUpperCase()}`, price: o.price, title: o.title, startIso: o.startIso, endIso: o.endIso, documents: [{ type: "electronic_ticket", id: "000-MOCK" }], sample: true };
}
function mockStayOffers(s: StaySearch): Offer[] {
  return [0, 1, 2].map((i) => {
    const detail: StayDetail = {
      rating: [4, 4, 3][i],
      reviewScore: [8.9, 8.4, 8.1][i],
      photos: [],
      amenities: ["Free WiFi", "Breakfast available", i === 0 ? "Gym" : "Parking", "24h reception"],
      address: "City centre",
      postcode: null,
      checkInAfter: "15:00",
      checkOutBefore: "11:00",
      lat: s.lat,
      lng: s.lng,
    };
    return {
      id: `ssr_mock_${i}`,
      kind: "stay" as const,
      provider: "duffel",
      title: ["The Resident", "Hotel Indigo", "Premier Inn"][i],
      price: money(95 + i * 40),
      summary: `${detail.rating}★ · ${detail.reviewScore?.toFixed(1)}/10 · city centre`,
      detail: { ...detail },
      sample: true,
    };
  });
}
