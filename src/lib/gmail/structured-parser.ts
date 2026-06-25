// Structured-data booking parser — the robust, deterministic path. Booking emails
// (Trainline, airlines, hotels, …) embed schema.org JSON-LD reservations; that's
// how Gmail shows trip cards. It is machine-readable and AUTHORITATIVE: the Derby
// email that the regex pipeline turned into "Kettering 07:26" plainly states
// `departureStation: "Wellingborough", departureTime: 07:50` in its JSON-LD. So we
// read THAT instead of scraping rendered HTML. No AI, no per-retailer regex — one
// well-built reader of an open standard, which most major providers emit.
//
// extractJsonLd + parseStructuredBookings are PURE (exported) so they unit-test
// against a real fixture with no network. The scan tries this FIRST and falls back
// to the legacy text/PDF parsers when an email carries no structured data.

import type { ParsedBooking, ParsedTransportSegment } from "./types";

type Obj = Record<string, unknown>;
const asObj = (v: unknown): Obj | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const typeOf = (o: Obj): string => String(o["@type"] ?? "").replace(/^.*[/#]/, "");

// Extract + JSON.parse every <script type="application/ld+json"> block, flattening
// arrays and @graph. Tolerant: a block that doesn't parse is skipped, not fatal.
export function extractJsonLd(html: string): Obj[] {
  const out: Obj[] = [];
  if (!html) return out;
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    for (const item of Array.isArray(parsed) ? parsed : [parsed]) {
      const o = asObj(item);
      if (!o) continue;
      const graph = o["@graph"];
      if (Array.isArray(graph)) {
        for (const g of graph) {
          const go = asObj(g);
          if (go) out.push(go);
        }
      } else {
        out.push(o);
      }
    }
  }
  return out;
}

function isoDateTime(iso: unknown): { date: string; time: string } | null {
  const s = str(iso);
  if (!s) return null;
  const base = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(s);
  if (!base) return null;
  // No timezone offset → the wall-clock time is already local; take it as-is.
  if (!/(Z|[+-]\d{2}:?\d{2})$/.test(s)) return { date: base[1], time: base[2] };
  // Has an offset → normalise the instant to UK local time (Europe/London).
  // Trainline encodes some legs in UTC (`...06:13:00+00:00`) and some in BST
  // (`...07:50:00+01:00`); a 07:13 BST departure shows as 06:13Z, so we MUST
  // convert or the old ticket imports an hour early.
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return { date: base[1], time: base[2] };
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  const hh = parts.hour === "24" ? "00" : parts.hour;
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${hh}:${parts.minute}` };
}

// schema.org station/airport/stop → a name (+ optional code).
function place(v: unknown): { name: string; code: string | null } | null {
  const o = asObj(v);
  if (!o) return null;
  const name = str(o.name);
  if (!name) return null;
  // Some feeds carry an IATA/CRS code in identifier/iataCode.
  const code = str(o.iataCode) ?? str(o.identifier) ?? null;
  return { name, code: code && code.length <= 4 ? code.toUpperCase() : null };
}

function emptySegment(p: {
  from_station: string;
  to_station: string;
  from_station_code: string | null;
  to_station_code: string | null;
  departure_date: string;
  departure_time: string;
  arrival_date: string;
  arrival_time: string;
  operator: string | null;
  service_number: string | null;
}): ParsedTransportSegment {
  return {
    ...p,
    route_restriction: null,
    ticket_type: null,
    platform_dep: null,
    platform_arr: null,
    coach: null,
    seat: null,
    barcode_ref: null,
    barcode_data: null,
  };
}

// Map schema.org reservation objects → our ParsedBooking[]. Groups transport
// reservations that share a reservationNumber into ONE booking (a return is two
// TrainReservations under the same number → one booking, two legs). Cancelled
// reservations are dropped (this is also how a rebooking stops importing the dead
// leg). `providerHint` comes from the sender so the brand is right.
export function parseStructuredBookings(
  objects: Obj[],
  ctx: { gmail_message_id: string; raw_subject: string; email_date: string; providerHint: string | null },
): ParsedBooking[] {
  type Group = {
    provider: string;
    booking_reference: string | null;
    mode: "train" | "flight" | "bus";
    segs: Array<ParsedTransportSegment & { _dep: string }>;
    price: number | null;
    currency: "GBP" | "EUR" | "USD";
  };
  const groups = new Map<string, Group>();
  const out: ParsedBooking[] = [];

  for (const o of objects) {
    const t = typeOf(o);

    if (/^(Train|Bus|Flight)Reservation$/.test(t)) {
      if (/Cancelled/i.test(String(o.reservationStatus ?? ""))) continue; // dropped: cancelled leg
      const forr = asObj(o.reservationFor);
      if (!forr) continue;
      const dep = isoDateTime(forr.departureTime);
      const arr = isoDateTime(forr.arrivalTime);
      const from = place(forr.departureStation) ?? place(forr.departureAirport) ?? place(forr.departureBusStop);
      const to = place(forr.arrivalStation) ?? place(forr.arrivalAirport) ?? place(forr.arrivalBusStop);
      if (!dep || !from || !to) continue;

      const mode: Group["mode"] = t === "FlightReservation" ? "flight" : t === "BusReservation" ? "bus" : "train";
      const ref = str(o.reservationNumber) ?? str(o.reservationId)?.split(/[,\s]/)[0] ?? null;
      const provider =
        ctx.providerHint ??
        str(asObj(o.provider)?.name) ??
        str(asObj(o.broker)?.name) ??
        (mode === "flight" ? "Airline" : "Rail");
      const key = ref ?? `${ctx.gmail_message_id}:${mode}`;

      const price = priceOf(o);
      const g = groups.get(key) ?? {
        provider,
        booking_reference: ref,
        mode,
        segs: [],
        price: price.amount,
        currency: price.currency,
      };
      if (g.price == null && price.amount != null) {
        g.price = price.amount;
        g.currency = price.currency;
      }
      g.segs.push({
        ...emptySegment({
          from_station: from.name,
          to_station: to.name,
          from_station_code: from.code,
          to_station_code: to.code,
          departure_date: dep.date,
          departure_time: dep.time,
          arrival_date: arr?.date ?? dep.date,
          arrival_time: arr?.time ?? "",
          operator: str(asObj(forr.provider)?.name) ?? str(forr.trainName) ?? null,
          service_number: str(forr.trainNumber) ?? str(forr.flightNumber) ?? null,
        }),
        _dep: `${dep.date}T${dep.time}`,
      });
      groups.set(key, g);
    } else if (t === "LodgingReservation") {
      if (/Cancelled/i.test(String(o.reservationStatus ?? ""))) continue;
      const forr = asObj(o.reservationFor);
      const hotel = str(forr?.name) ?? str(o.name);
      const ci = isoDateTime(o.checkinTime);
      const co = isoDateTime(o.checkoutTime);
      if (!hotel || !ci || !co) continue;
      const price = priceOf(o);
      out.push({
        type: "accommodation",
        hotel_name: hotel,
        provider: ctx.providerHint ?? str(asObj(o.provider)?.name) ?? "Hotel",
        booking_reference: str(o.reservationNumber) ?? null,
        check_in_date: ci.date,
        check_in_time: ci.time,
        check_out_date: co.date,
        check_out_time: co.time,
        price: price.amount,
        currency: price.currency,
        room_details: null,
        is_amendment: false,
        raw_subject: ctx.raw_subject,
        gmail_message_id: ctx.gmail_message_id,
        email_date: ctx.email_date,
      });
    }
  }

  for (const g of groups.values()) {
    if (!g.segs.length) continue;
    g.segs.sort((a, b) => a._dep.localeCompare(b._dep));
    out.push({
      type: "transport",
      mode: g.mode,
      provider: g.provider,
      booking_reference: g.booking_reference,
      price: g.price,
      currency: g.currency,
      segments: g.segs.map(({ _dep: _omit, ...s }) => s),
      is_amendment: false,
      raw_subject: ctx.raw_subject,
      gmail_message_id: ctx.gmail_message_id,
      email_date: ctx.email_date,
    });
  }
  return out;
}

function priceOf(o: Obj): { amount: number | null; currency: "GBP" | "EUR" | "USD" } {
  const total = asObj(o.totalPrice) ?? asObj(o.priceSpecification);
  const raw = str(o.totalPrice) ?? str(total?.price) ?? (typeof o.totalPrice === "number" ? String(o.totalPrice) : null);
  const amount = raw ? parseFloat(raw.replace(/[^\d.]/g, "")) : null;
  const cur = (str(o.priceCurrency) ?? str(total?.priceCurrency) ?? "GBP").toUpperCase();
  const currency = cur === "EUR" ? "EUR" : cur === "USD" ? "USD" : "GBP";
  return { amount: amount != null && !Number.isNaN(amount) ? amount : null, currency };
}

// Convenience: parse a whole email's HTML straight to bookings (used by the scan).
export function parseStructuredFromHtml(
  html: string,
  ctx: { gmail_message_id: string; raw_subject: string; email_date: string; providerHint: string | null },
): ParsedBooking[] {
  return parseStructuredBookings(extractJsonLd(html), ctx);
}
