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
  type FlightPassenger,
} from "@/lib/integrations/duffel";
import type { Offer, Booking } from "@/lib/connections/types";

// Connections actions (Phase 14) — the search → compare → book → land orchestration.
// Flights run LIVE against Duffel test mode (offer→order); the booked result lands
// in the day as a flight run via addTransport, so a connection becomes a real
// Commitment, not a detached receipt.

const flightSearchSchema = z.object({
  itineraryId: z.string().uuid(),
  origin: z.string().trim().min(3).max(3),
  destination: z.string().trim().min(3).max(3),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  adults: z.number().int().min(1).max(9).default(1),
  cabin: z.enum(["economy", "premium_economy", "business", "first"]).default("economy"),
});

export async function searchFlightOffers(input: z.input<typeof flightSearchSchema>): Promise<{ offers: Offer[]; sample: boolean; error?: string }> {
  const parsed = flightSearchSchema.safeParse(input);
  if (!parsed.success) return { offers: [], sample: false, error: "Check the airports and date." };
  const v = parsed.data;
  await requireUserContext();
  const { offers, sample } = await duffelSearchFlights({
    slices: [{ origin: v.origin.toUpperCase(), destination: v.destination.toUpperCase(), departureDate: v.departureDate }],
    adults: v.adults,
    cabin: v.cabin,
  });
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
});

export async function bookFlightOffer(input: z.input<typeof bookFlightSchema>): Promise<{ ok: boolean; booking?: Booking; error?: string }> {
  const parsed = bookFlightSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Couldn't read that offer." };
  const { itineraryId, offer } = parsed.data;
  const ctx = await requireUserContext();

  // Refresh for the live price + the passenger id Duffel expects on the order.
  const fresh = (await refreshOffer(offer.id)) ?? null;
  const liveOffer: Offer = fresh ?? { ...(offer as Offer), kind: "flight", provider: "duffel", summary: "", sample: false };

  // Passenger: name from the profile; test-mode defaults for the rest (a dedicated
  // passenger-details capture step is the positioned in-phase follow-on).
  const [given = "Traveller", family = "Khonsera"] = String(ctx.fullName ?? "").trim().split(/\s+/);
  const passengerId = ((liveOffer.detail?.passengers as { id?: string }[] | undefined)?.[0]?.id) ?? "pas_0";
  const passengers: FlightPassenger[] = [
    { id: passengerId, given_name: given, family_name: family || "Khonsera", born_on: "1990-01-01", gender: "m", title: "mr", email: ctx.email ?? "traveller@example.com", phone_number: "+442080160508" },
  ];

  const booking = await createFlightOrder({ offer: liveOffer, passengers });
  if (!booking) return { ok: false, error: "The airline couldn't confirm that fare — try another." };

  // Land it in the day as a flight run.
  const dep = dateTime(booking.startIso ?? liveOffer.startIso);
  const arr = dateTime(booking.endIso ?? liveOffer.endIso);
  const [, route] = booking.title.split(" · ");
  const [fromLabel = "Origin", toLabel = "Destination"] = (route ?? "").split(" → ");
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

// Book a stay → lands as an accommodation constraint anchor (check-in). Duffel
// Stays is pending activation, so this is real-shaped; the booking flows through
// the same Offer→Booking vocabulary as flights.
const bookStaySchema = z.object({
  itineraryId: z.string().uuid(),
  offer: z.object({ id: z.string(), title: z.string(), price: z.object({ amount: z.string(), currency: z.string() }) }),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function bookStayOffer(input: z.input<typeof bookStaySchema>): Promise<{ ok: boolean; error?: string }> {
  const parsed = bookStaySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Couldn't read that stay." };
  const { itineraryId, offer, checkIn } = parsed.data;
  await requireUserContext();
  // Lands as an accommodation anchor at check-in (15:00 default) carrying the stay
  // payload. Duffel Stays is pending activation, so the booking is real-shaped.
  await addManualAnchor({
    itineraryId,
    kind: "accommodation",
    title: offer.title,
    iso: wallClockToIso(checkIn, "15:00"),
    details: {
      property_name: offer.title,
      confirmation_ref: `STAY-${offer.id.slice(-6).toUpperCase()}`,
      price: offer.price.amount,
      currency: offer.price.currency,
      channel: "other",
    },
  });
  return { ok: true };
}
