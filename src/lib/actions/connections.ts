"use server";

import { z } from "zod";
import { requireUserContext } from "@/lib/auth";
import { wallClockToIso } from "@/lib/time-zone";
import { addTransport, addManualAnchor } from "@/lib/actions/plan-edit";
import {
  searchFlights as duffelSearchFlights,
  searchStays as duffelSearchStays,
  refreshOffer,
  createFlightOrder,
  placeSuggestions,
  getSeatMap,
  getStayRates,
  bookStayRate,
  type FlightPassenger,
  type FlightService,
  type PlaceSuggestion,
  type SeatMapVM,
  type StayRate,
} from "@/lib/integrations/duffel";
import { textSearchPlaces } from "@/lib/google/places";
import type { Offer, Booking } from "@/lib/connections/types";

// Airport autocomplete — type "Heathrow"/"London"/"Edinburgh", get the IATA code,
// so the user NEVER types a short-code. INCLUDES city options ("London · all
// airports" → the metro code LON, which Duffel expands to every London airport) —
// a slice can be a CITY, not just one airport. Real via Duffel Places; a mock list
// (cities first) when unkeyed.
const MOCK_AIRPORTS: PlaceSuggestion[] = [
  { iataCode: "LON", name: "London", cityName: "All airports", type: "city" },
  { iataCode: "LHR", name: "Heathrow", cityName: "London", type: "airport" },
  { iataCode: "LGW", name: "Gatwick", cityName: "London", type: "airport" },
  { iataCode: "STN", name: "Stansted", cityName: "London", type: "airport" },
  { iataCode: "MAN", name: "Manchester", cityName: "Manchester", type: "airport" },
  { iataCode: "EDI", name: "Edinburgh", cityName: "Edinburgh", type: "airport" },
  { iataCode: "BHX", name: "Birmingham", cityName: "Birmingham", type: "airport" },
  { iataCode: "NYC", name: "New York", cityName: "All airports", type: "city" },
  { iataCode: "JFK", name: "John F. Kennedy", cityName: "New York", type: "airport" },
  { iataCode: "PAR", name: "Paris", cityName: "All airports", type: "city" },
  { iataCode: "CDG", name: "Charles de Gaulle", cityName: "Paris", type: "airport" },
  { iataCode: "DUB", name: "Dublin", cityName: "Dublin", type: "airport" },
  { iataCode: "AMS", name: "Schiphol", cityName: "Amsterdam", type: "airport" },
];

export async function airportSuggest(query: string): Promise<PlaceSuggestion[]> {
  await requireUserContext();
  const q = query.trim();
  if (q.length < 2) return [];
  const real = await placeSuggestions(q);
  // Keep BOTH cities (all-airports) and airports; cities lead so "any London
  // airport" is the easy default.
  if (real) return [...real].sort((a, b) => Number(b.type === "city") - Number(a.type === "city")).slice(0, 7);
  const lc = q.toLowerCase();
  return MOCK_AIRPORTS.filter((a) => a.name.toLowerCase().includes(lc) || a.iataCode.toLowerCase().includes(lc) || (a.cityName ?? "").toLowerCase().includes(lc)).slice(0, 7);
}

// Stay location lookup — type any city/hotel, geocode to coords (independent of the
// day). Uses the Google Text Search geocoder (fast, complete).
export type StayLocation = { label: string; lat: number; lng: number };
export async function stayLocationSuggest(query: string): Promise<StayLocation[]> {
  await requireUserContext();
  if (query.trim().length < 2) return [];
  const places = await textSearchPlaces({ query, limit: 6 });
  return places.map((p) => ({ label: p.address ? `${p.name} · ${p.address}` : p.name, lat: p.latitude, lng: p.longitude }));
}

// Connections actions (Phase 14) — the search → compare → book → land orchestration.
// Flights run LIVE against Duffel test mode (offer→order); the booked result lands
// in the day as a flight run via addTransport, so a connection becomes a real
// Commitment, not a detached receipt.

const flightSearchSchema = z.object({
  itineraryId: z.string().uuid(),
  origin: z.string().trim().min(3).max(3),
  destination: z.string().trim().min(3).max(3),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // Set for a return — adds the inbound slice. Omitted = one-way.
  returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  adults: z.number().int().min(1).max(9).default(1),
  children: z.number().int().min(0).max(8).default(0),
  cabin: z.enum(["economy", "premium_economy", "business", "first"]).default("economy"),
});

// Seat map for an offer + passenger (best-effort — not every carrier returns one).
export async function flightSeatMap(offerId: string, passengerId: string): Promise<SeatMapVM> {
  await requireUserContext();
  if (!offerId || !passengerId) return { rows: [], sample: false };
  return getSeatMap(offerId, passengerId);
}

export async function searchFlightOffers(input: z.input<typeof flightSearchSchema>): Promise<{ offers: Offer[]; sample: boolean; error?: string }> {
  const parsed = flightSearchSchema.safeParse(input);
  if (!parsed.success) return { offers: [], sample: false, error: "Check the airports and date." };
  const v = parsed.data;
  await requireUserContext();
  const o = v.origin.toUpperCase();
  const d = v.destination.toUpperCase();
  const slices = [{ origin: o, destination: d, departureDate: v.departureDate }];
  if (v.returnDate) slices.push({ origin: d, destination: o, departureDate: v.returnDate });
  const { offers, sample } = await duffelSearchFlights({ slices, adults: v.adults, children: v.children, cabin: v.cabin });
  return { offers, sample };
}

// Pull date + airport-local HH:MM straight from the ISO string (don't reinterpret
// the tz — these are local airport times; true cross-tz handling is P19).
function dateTime(iso?: string): { date: string; time: string } | null {
  if (!iso) return null;
  const m = /(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(iso);
  return m ? { date: m[1], time: m[2] } : null;
}

const bookFlightSchema = z.object({
  itineraryId: z.string().uuid(),
  offer: z.object({
    id: z.string(),
    title: z.string(),
    price: z.object({ amount: z.string(), currency: z.string() }),
    startIso: z.string().optional(),
    endIso: z.string().optional(),
    detail: z.record(z.unknown()).optional(),
  }),
  // The traveller on the ticket. Optional — falls back to the profile name +
  // test-mode defaults when omitted (so a quick test book still works).
  passenger: z
    .object({
      givenName: z.string().trim().min(1),
      familyName: z.string().trim().min(1),
      bornOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      gender: z.enum(["m", "f"]),
      title: z.enum(["mr", "ms", "mrs", "miss"]),
      email: z.string().email(),
      phoneNumber: z.string().trim().min(5),
    })
    .optional(),
  // Selected seat service ids (from the seat map) to add to the order.
  seatServiceIds: z.array(z.string()).optional(),
});

export async function bookFlightOffer(input: z.input<typeof bookFlightSchema>): Promise<{ ok: boolean; booking?: Booking; error?: string }> {
  const parsed = bookFlightSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Couldn't read that offer." };
  const { itineraryId, offer, passenger, seatServiceIds } = parsed.data;
  const ctx = await requireUserContext();

  // Refresh for the live price + the passenger id Duffel expects on the order.
  const fresh = (await refreshOffer(offer.id)) ?? null;
  const liveOffer: Offer = fresh ?? { ...(offer as Offer), kind: "flight", provider: "duffel", summary: "", sample: false };

  // The traveller: the captured passenger if given, else the profile name +
  // test-mode defaults. The passenger id always comes from the live offer.
  const [given = "Traveller", family = "Khonsera"] = String(ctx.fullName ?? "").trim().split(/\s+/);
  const passengerId = ((liveOffer.detail?.passengers as { id?: string }[] | undefined)?.[0]?.id) ?? "pas_0";
  const passengers: FlightPassenger[] = [
    passenger
      ? { id: passengerId, given_name: passenger.givenName, family_name: passenger.familyName, born_on: passenger.bornOn, gender: passenger.gender, title: passenger.title, email: passenger.email, phone_number: passenger.phoneNumber }
      : { id: passengerId, given_name: given, family_name: family || "Khonsera", born_on: "1990-01-01", gender: "m", title: "mr", email: ctx.email ?? "traveller@example.com", phone_number: "+442080160508" },
  ];

  const services: FlightService[] | undefined = seatServiceIds?.length ? seatServiceIds.map((id) => ({ id, quantity: 1 })) : undefined;
  const booking = await createFlightOrder({ offer: liveOffer, passengers, services });
  if (!booking) return { ok: false, error: "The airline couldn't confirm that fare — try another." };

  // Land it in the day as a flight run — a RICH ticket card built straight from
  // Duffel's order data (no email decode): operator, PNR, e-ticket, cabin, seat,
  // and the order id so it can be managed (change/cancel) later.
  const dep = dateTime(booking.startIso ?? liveOffer.startIso);
  const arr = dateTime(booking.endIso ?? liveOffer.endIso);
  const [, route] = booking.title.split(" · ");
  const [fromLabel = "Origin", toLabel = "Destination"] = (route ?? "").split(" → ");
  const d = liveOffer.detail as Partial<import("@/lib/integrations/duffel").FlightDetail> | undefined;
  if (dep && arr) {
    await addTransport({
      itineraryId,
      mode: "flight",
      fromLabel,
      toLabel,
      date: dep.date,
      departTime: dep.time,
      arriveTime: arr.time,
      operator: booking.title.split(" · ")[0],
      reference: booking.reference,
      seat: seatServiceIds?.length ? "selected" : null,
      metadata: {
        provider: "duffel",
        duffel_order_id: booking.id,
        e_ticket: booking.documents?.[0]?.id ?? null,
        cabin: d?.cabin ?? null,
        baggage: d ? { carryOn: d.carryOn ?? 0, checked: d.checked ?? 0 } : null,
        // The boarding pass is airline-issued at check-in (barcode rule); store
        // the check-in handle, not a minted pass.
        checkin: { via: "airline", pnr: booking.reference },
      },
    });
  }
  return { ok: true, booking };
}

const staySearchSchema = z.object({
  itineraryId: z.string().uuid(),
  lat: z.number(),
  lng: z.number(),
  radiusKm: z.number().min(1).max(30).default(5),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rooms: z.number().int().min(1).max(5).default(1),
  adults: z.number().int().min(1).max(9).default(1),
});

export async function searchStayOffers(input: z.input<typeof staySearchSchema>): Promise<{ offers: Offer[]; sample: boolean; pending?: boolean; error?: string }> {
  const parsed = staySearchSchema.safeParse(input);
  if (!parsed.success) return { offers: [], sample: false, error: "Check the dates and location." };
  const v = parsed.data;
  await requireUserContext();
  const { offers, sample, pending } = await duffelSearchStays({ lat: v.lat, lng: v.lng, radiusKm: v.radiusKm, checkIn: v.checkIn, checkOut: v.checkOut, rooms: v.rooms, adults: v.adults });
  return { offers, sample, pending };
}

// The rooms/rates for a chosen property (board, cancellation, pay-type).
export async function stayRates(searchResultId: string): Promise<{ rates: StayRate[]; sample: boolean }> {
  await requireUserContext();
  if (!searchResultId) return { rates: [], sample: false };
  return getStayRates(searchResultId);
}

// Book a chosen RATE (room) → Duffel quote→booking → lands as a rich accommodation
// anchor (check-in time from the property, board, cancellation, confirmation ref).
const bookStaySchema = z.object({
  itineraryId: z.string().uuid(),
  rateId: z.string().min(1),
  stayTitle: z.string().min(1),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkInAfter: z.string().optional(), // "15:00"
  checkOutBefore: z.string().optional(),
  board: z.string().optional(),
  freeCancellationBefore: z.string().nullable().optional(),
  specialRequests: z.string().trim().max(500).optional(),
});

export async function bookStayRoom(input: z.input<typeof bookStaySchema>): Promise<{ ok: boolean; reference?: string; error?: string }> {
  const parsed = bookStaySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Couldn't read that room." };
  const v = parsed.data;
  const ctx = await requireUserContext();
  const [given = "Guest", family = "Khonsera"] = String(ctx.fullName ?? "").trim().split(/\s+/);

  const board = (["room_only", "breakfast", "half_board", "full_board", "all_inclusive"] as const).find((b) => b === v.board) ?? null;
  const booking = await bookStayRate({
    rateId: v.rateId,
    guestGiven: given,
    guestFamily: family || "Khonsera",
    email: ctx.email ?? "guest@example.com",
    phone: "+442080160508",
    stayTitle: v.stayTitle,
    checkIn: v.checkIn,
    checkOut: v.checkOut,
    specialRequests: v.specialRequests,
  });
  if (!booking) return { ok: false, error: "The property couldn't confirm that room — try another." };

  await addManualAnchor({
    itineraryId: v.itineraryId,
    kind: "accommodation",
    title: v.stayTitle,
    iso: wallClockToIso(v.checkIn, v.checkInAfter ?? "15:00"),
    details: {
      property_name: v.stayTitle,
      confirmation_ref: booking.reference,
      board_basis: board,
      price: booking.price.amount,
      currency: booking.price.currency,
      free_cancel_until: v.freeCancellationBefore ?? null,
      channel: "other",
    },
  });
  return { ok: true, reference: booking.reference };
}
