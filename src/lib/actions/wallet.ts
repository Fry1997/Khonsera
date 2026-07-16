import { createClient } from "@/lib/supabase/server";
import { requireUserContext } from "@/lib/auth";
import { connectionBufferMinutes } from "@/lib/planning/door-to-door";
import { foldStopsToTickets, type TransitStop } from "@/lib/tickets/from-stops";
import type {
  TicketVM,
  TicketLegVM,
  TicketChange,
  BarcodeVM,
  DocumentSource,
  BarcodeFormat,
} from "@/components/concierge";

// The Wallet's real data (planner master brief §7). Maps booked travel documents
// (travel_bookings + travel_booking_segments, migrations 0011/0023/0027) → the
// TicketVM the document family renders. Mode-scoped (via the owning itinerary)
// and RLS-bounded. The barcode payload (segment.barcode_data) flows straight to
// BarcodePresenter, which renders it client-side — so it works offline (§7.3).

type SegmentRow = {
  sequence: number;
  from_location_name: string | null;
  to_location_name: string | null;
  from_station_code: string | null;
  to_station_code: string | null;
  departure_at: string | null;
  arrival_at: string | null;
  train_number: string | null;
  platform_dep: string | null;
  platform_arr: string | null;
  operator: string | null;
  ticket_type: string | null;
  route_restriction: string | null;
  coach: string | null;
  seat: string | null;
  barcode_ref: string | null;
  barcode_data: string | null;
};

type BookingRow = {
  id: string;
  booking_intent_id: string;
  provider: string | null;
  booking_reference: string | null;
  ticket_status: string | null;
  actual_price: number | null;
  currency: string | null;
  departure_at: string | null;
  arrival_at: string | null;
  seat_reservation: string | null;
  source: string | null;
  segments: SegmentRow[] | null;
};

const SOURCE_MAP: Record<string, DocumentSource> = {
  parsed_email: "forwarded",
  partner_api: "affiliate",
  captured: "typed",
  manual: "manual",
  calendar: "manual",
  inferred: "manual",
  system: "manual",
};

export async function loadWalletTickets(): Promise<TicketVM[]> {
  const ctx = await requireUserContext();
  const supabase = await createClient();

  // One unified wallet — every held pass, work or personal (RLS scopes to the
  // user/workspace; personal stays invisible upward).
  const { data: itins } = await supabase
    .from("itineraries")
    .select("id");
  const itinIds = (itins ?? []).map((r) => r.id as string);
  if (itinIds.length === 0) return [];

  return ticketsForItineraries(itinIds);
}

// The booked documents for a single journey (used by Today's projection to
// promote the next document at the moment of use, §8.3).
export async function loadJourneyTickets(itineraryId: string): Promise<TicketVM[]> {
  return ticketsForItineraries([itineraryId]);
}

async function ticketsForItineraries(itinIds: string[]): Promise<TicketVM[]> {
  if (itinIds.length === 0) return [];
  const supabase = await createClient();

  // Primary source: booked travel folded from STOP METADATA (where the Gmail /
  // brief import actually writes it — the user's real tickets + Aztec barcodes).
  const { data: stops } = await supabase
    .from("stops")
    .select("id, itinerary_id, sequence, type, title, start_time, metadata")
    .in("itinerary_id", itinIds)
    .order("itinerary_id")
    .order("sequence");

  const byItin = new Map<string, TransitStop[]>();
  for (const st of stops ?? []) {
    const arr = byItin.get(st.itinerary_id as string) ?? [];
    arr.push({
      id: st.id as string,
      type: st.type as string,
      title: (st.title as string | null) ?? null,
      start_time: (st.start_time as string | null) ?? null,
      metadata: (st.metadata as Record<string, unknown> | null) ?? null,
    });
    byItin.set(st.itinerary_id as string, arr);
  }
  const stopTickets: TicketVM[] = [];
  for (const [itineraryId, list] of byItin.entries()) {
    for (const f of foldStopsToTickets(list)) stopTickets.push({ ...f.ticket, itineraryId });
  }

  // Secondary source: travel_bookings rows (future/affiliate path), deduped by
  // reference so we don't double-list the same booking.
  const { data: intents } = await supabase.from("booking_intents").select("id, itinerary_id").in("itinerary_id", itinIds);
  const intentItinerary = new Map((intents ?? []).map((r) => [r.id as string, r.itinerary_id as string]));
  const intentIds = (intents ?? []).map((r) => r.id as string);
  let bookingTickets: TicketVM[] = [];
  if (intentIds.length) {
    const { data: bookings } = await supabase
      .from("travel_bookings")
      .select(
        `id, booking_intent_id, provider, booking_reference, ticket_status, actual_price, currency,
         departure_at, arrival_at, seat_reservation, source,
         segments:travel_booking_segments(
           sequence, from_location_name, to_location_name, from_station_code, to_station_code,
           departure_at, arrival_at, train_number, platform_dep, platform_arr, operator,
           ticket_type, route_restriction, coach, seat, barcode_ref, barcode_data)`,
      )
      .in("booking_intent_id", intentIds);
    bookingTickets = ((bookings ?? []) as unknown as BookingRow[]).map((b) => ({ ...toTicket(b), itineraryId: intentItinerary.get(b.booking_intent_id) }));
  }

  const seen = new Set(stopTickets.map((t) => t.reference).filter(Boolean));
  const merged = [...stopTickets, ...bookingTickets.filter((t) => !t.reference || !seen.has(t.reference))];
  return merged;
}

function toTicket(b: BookingRow): TicketVM {
  const segs = (b.segments ?? []).slice().sort((a, z) => a.sequence - z.sequence);
  const first = segs[0];
  const last = segs[segs.length - 1];

  // The journey leg, assembled from the segments (the connections between them
  // become `changes` with tight-connection flags).
  const changes: TicketChange[] = [];
  for (let i = 1; i < segs.length; i++) {
    const prev = segs[i - 1];
    const cur = segs[i];
    const transfer = minutesBetween(prev.arrival_at, cur.departure_at);
    changes.push({
      place: cur.from_location_name ?? prev.to_location_name ?? "Change",
      arrive: prev.arrival_at ?? undefined,
      depart: cur.departure_at ?? undefined,
      transferMinutes: transfer ?? undefined,
      platform: cur.platform_dep ?? undefined,
      tight: transfer != null && transfer < connectionBufferMinutes("train", "train"),
    });
  }

  const barcodes: BarcodeVM[] = segs
    .filter((s) => s.barcode_data)
    .map((s) => ({
      format: guessFormat(s.barcode_data!),
      value: s.barcode_data!,
      passengerLabel: segs.length > 1 ? `Leg ${s.sequence}` : (s.barcode_ref ?? undefined),
    }));

  const leg: TicketLegVM = {
    id: `${b.id}-leg`,
    origin: {
      place: first?.from_location_name ?? "Departure",
      code: first?.from_station_code ?? undefined,
      time: first?.departure_at ?? b.departure_at ?? undefined,
      platform: first?.platform_dep ?? undefined,
    },
    destination: {
      place: last?.to_location_name ?? "Arrival",
      code: last?.to_station_code ?? undefined,
      time: last?.arrival_at ?? b.arrival_at ?? undefined,
      platform: last?.platform_arr ?? undefined,
    },
    durationMinutes:
      minutesBetween(first?.departure_at ?? b.departure_at, last?.arrival_at ?? b.arrival_at) ?? undefined,
    changes: changes.length ? changes : undefined,
    coach: first?.coach ?? undefined,
    seat: first?.seat ?? b.seat_reservation ?? undefined,
    travelClass: undefined,
    ticketType: first?.ticket_type ?? undefined,
    restrictions: first?.route_restriction ?? undefined,
    barcodes: barcodes.length ? barcodes : undefined,
    status: {
      status: b.ticket_status === "cancelled" ? "cancelled" : "on_time",
    },
  };

  return {
    id: b.id,
    kind: "rail", // P1 path; air/stay differentiation lands with those importers
    operator: first?.operator ?? b.provider ?? "Train",
    reference: b.booking_reference ?? undefined,
    price: b.actual_price != null ? Math.round(b.actual_price * 100) : undefined,
    currency: b.currency ?? "GBP",
    source: SOURCE_MAP[b.source ?? "manual"] ?? "manual",
    legs: [leg],
  };
}

function minutesBetween(a?: string | null, z?: string | null): number | null {
  if (!a || !z) return null;
  const ms = new Date(z).getTime() - new Date(a).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.round(ms / 60000);
}

// RSP rail tickets are Aztec; most airline passes PDF417; transit is QR. We only
// have the payload, so infer conservatively — rail is the P1 path, default Aztec.
function guessFormat(_payload: string): BarcodeFormat {
  return "aztec";
}
