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

// ───────────────────────────── Flights: types ─────────────────────────────

export type FlightSlice = { origin: string; destination: string; departureDate: string };
export type FlightSearch = { slices: FlightSlice[]; adults: number; cabin?: "economy" | "premium_economy" | "business" | "first" };

type DuffelSegment = {
  origin?: { iata_code?: string };
  destination?: { iata_code?: string };
  departing_at?: string;
  arriving_at?: string;
  marketing_carrier?: { iata_code?: string; name?: string };
  marketing_carrier_flight_number?: string;
};
type DuffelSlice = { origin?: { iata_code?: string }; destination?: { iata_code?: string }; duration?: string; segments?: DuffelSegment[] };
export type DuffelOffer = {
  id: string;
  total_amount?: string;
  total_currency?: string;
  owner?: { iata_code?: string; name?: string };
  expires_at?: string;
  slices?: DuffelSlice[];
  passengers?: { id?: string; type?: string }[];
};

// ───────────────────────────── Flights: pure mappers ─────────────────────────────

// A Duffel offer → our provider-agnostic Offer. Pure — the unit-test anchor.
export function mapDuffelOffer(o: DuffelOffer): Offer {
  const first = o.slices?.[0];
  const firstSeg = first?.segments?.[0];
  const lastSlice = o.slices?.[o.slices.length - 1];
  const lastSeg = lastSlice?.segments?.[lastSlice.segments.length - 1];
  const carrier = o.owner?.name ?? firstSeg?.marketing_carrier?.name ?? "Airline";
  const from = first?.origin?.iata_code ?? firstSeg?.origin?.iata_code ?? "—";
  const to = first?.destination?.iata_code ?? "—";
  const stops = (first?.segments?.length ?? 1) - 1;
  const dep = firstSeg?.departing_at ?? null;
  const arr = lastSeg?.arriving_at ?? null;
  const stopLabel = stops <= 0 ? "direct" : `${stops} stop${stops > 1 ? "s" : ""}`;
  return {
    id: o.id,
    kind: "flight",
    provider: "duffel",
    title: `${carrier} · ${from} → ${to}`,
    price: { amount: o.total_amount ?? "0", currency: o.total_currency ?? "GBP" },
    summary: dep && arr ? `${hhmm(dep)}–${hhmm(arr)} · ${stopLabel}` : stopLabel,
    detail: { slices: o.slices, owner: o.owner, passengers: o.passengers },
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
        passengers: Array.from({ length: Math.max(1, s.adults) }, () => ({ type: "adult" })),
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

export type FlightPassenger = { id: string; given_name: string; family_name: string; born_on: string; gender: "m" | "f"; title: "mr" | "ms" | "mrs" | "miss"; email: string; phone_number: string };

// Create the order (the booking). In TEST mode pay from the unlimited test balance —
// a real order against the real lifecycle, no real money. The money step is the stub
// only in the sense that test mode mints no charge; the API path is genuine.
export async function createFlightOrder(args: { offer: Offer; passengers: FlightPassenger[] }): Promise<Booking | null> {
  const token = duffelToken();
  if (!token) return mockFlightBooking(args.offer);
  try {
    const body = {
      data: {
        type: "instant",
        selected_offers: [args.offer.id],
        passengers: args.passengers,
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

// ───────────────────────────── Stays: types + mappers ─────────────────────────────

export type StaySearch = { lat: number; lng: number; radiusKm: number; checkIn: string; checkOut: string; rooms: number; adults: number };

type DuffelStayResult = {
  id: string;
  accommodation?: {
    name?: string;
    rating?: number;
    review_score?: number;
    location?: { address?: { line_one?: string; city_name?: string } };
    photos?: { url?: string }[];
  };
  cheapest_rate_total_amount?: string;
  cheapest_rate_currency?: string;
};

export function mapDuffelStay(r: DuffelStayResult): Offer {
  const a = r.accommodation ?? {};
  const stars = a.rating ? `${a.rating}★` : "";
  const where = a.location?.address?.city_name ?? a.location?.address?.line_one ?? "";
  return {
    id: r.id,
    kind: "stay",
    provider: "duffel",
    title: a.name ?? "Hotel",
    price: { amount: r.cheapest_rate_total_amount ?? "0", currency: r.cheapest_rate_currency ?? "GBP" },
    summary: [stars, where].filter(Boolean).join(" · ") || "stay",
    detail: { accommodation: a, reviewScore: a.review_score },
    sample: false,
  };
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
  return [0, 1, 2].map((i) => ({
    id: `off_mock_${i}`,
    kind: "flight" as const,
    provider: "duffel",
    title: `${carriers[i]} · ${sl?.origin ?? "LHR"} → ${sl?.destination ?? "JFK"}`,
    price: money(120 + i * 55),
    summary: `${["07:25", "11:10", "17:40"][i]}–${["10:40", "14:05", "21:05"][i]} · ${i === 1 ? "1 stop" : "direct"}`,
    startIso: `${base}${["07:25", "11:10", "17:40"][i]}:00`,
    endIso: `${base}${["10:40", "14:05", "21:05"][i]}:00`,
    sample: true,
  }));
}
function mockFlightBooking(o: Offer): Booking {
  return { id: `ord_mock_${o.id}`, kind: "flight", provider: "duffel", reference: `MOCK${o.id.slice(-4).toUpperCase()}`, price: o.price, title: o.title, startIso: o.startIso, endIso: o.endIso, documents: [{ type: "electronic_ticket", id: "000-MOCK" }], sample: true };
}
function mockStayOffers(s: StaySearch): Offer[] {
  void s;
  return [0, 1, 2].map((i) => ({
    id: `rat_mock_${i}`,
    kind: "stay" as const,
    provider: "duffel",
    title: ["The Resident", "Hotel Indigo", "Premier Inn"][i],
    price: money(95 + i * 40),
    summary: `${[4, 4, 3][i]}★ · city centre`,
    sample: true,
  }));
}
