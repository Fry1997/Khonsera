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

// ── Per-leg itinerary (the changeover the JSON-LD omits) ────────────────────
// Trainline's confirmation JSON-LD lists ONE reservation per direction (endpoints
// only: Wellingborough→Derby), but the email's human-readable itinerary spells out
// the change: "07:50 Wellingborough … 08:20 Leicester … 08:37 Leicester … 09:08
// Derby". A traveller needs those changeover stations + times regardless of the
// fare (an Anytime Day Return still changes at Leicester), so we parse the
// itinerary and EXPAND each endpoint segment into its real legs.

// Words that follow a station in the itinerary (operator / fare / labels) — trimmed
// off the captured station run so "Wellingborough East Midlands Railway" → "Wellingborough".
const ITIN_STOPWORDS = new Set([
  "East", "West", "Midlands", "Railway", "Avanti", "CrossCountry", "Cross", "Country",
  "LNER", "Great", "Western", "Northern", "TransPennine", "Express", "Southern",
  "Thameslink", "Southeastern", "Chiltern", "Merseyrail", "ScotRail", "Transport",
  "Wales", "Elizabeth", "Line", "Anytime", "Advance", "Off", "Peak", "Super", "Day",
  "Return", "Single", "Standard", "First", "Class", "Adult", "Child", "Railcard",
  "Change", "No", "Specific", "Seat", "Coach", "Platform", "Outbound", "Inbound",
  "Mandatory", "Reservations", "Valid", "Until", "Operated", "by", "Departs", "Arrives",
]);

type ItinToken = { time: string; station: string };

// Extract the ordered (time, station) tokens from a confirmation's itinerary.
export function parseItineraryTokens(html: string): ItinToken[] {
  const text = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ");
  const tokens: ItinToken[] = [];
  const re = /\b(\d{1,2}:\d{2})\s+([A-Z][a-zA-Z']+(?:\s+[A-Z][a-zA-Z']+){0,4})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const words = m[2].split(/\s+/);
    while (words.length > 1 && ITIN_STOPWORDS.has(words[words.length - 1])) words.pop();
    if (words.length && !ITIN_STOPWORDS.has(words[0])) {
      tokens.push({ time: m[1], station: words.join(" ") });
    }
  }
  return tokens;
}

const sameStation = (a: string, b: string): boolean => {
  const x = a.toLowerCase().trim();
  const y = b.toLowerCase().trim();
  return x === y || x.startsWith(y) || y.startsWith(x);
};

// Replace each endpoint segment with its per-leg legs IFF the itinerary contains a
// contiguous chain that matches that segment's endpoints exactly (same departure
// time + origin, same arrival time + destination). The strict endpoint match is the
// safety valve: a misparse simply doesn't match, so we keep the original segment
// (no wrong data, no regression).
function expandSegmentsWithItinerary(
  segments: ParsedTransportSegment[],
  tokens: ItinToken[],
): ParsedTransportSegment[] {
  const out: ParsedTransportSegment[] = [];
  for (const seg of segments) {
    let expanded: ParsedTransportSegment[] | null = null;
    if (seg.departure_time && seg.arrival_time && seg.from_station && seg.to_station) {
      const s = tokens.findIndex(
        (t) => t.time === seg.departure_time && sameStation(t.station, seg.from_station),
      );
      if (s >= 0) {
        let e = -1;
        for (let i = s + 1; i < tokens.length; i++) {
          if (tokens[i].time === seg.arrival_time && sameStation(tokens[i].station, seg.to_station)) {
            e = i;
            break;
          }
        }
        // A real chain needs an EVEN number of tokens (dep/arr per leg) and at least
        // two legs (e > s+1) — otherwise it's just the endpoint pair, nothing to add.
        if (e > s + 1 && (e - s + 1) % 2 === 0) {
          const legs: ParsedTransportSegment[] = [];
          for (let k = s; k < e; k += 2) {
            const dep = tokens[k];
            const arr = tokens[k + 1];
            legs.push({
              ...emptySegment({
                from_station: k === s ? seg.from_station : dep.station,
                to_station: k + 1 === e ? seg.to_station : arr.station,
                from_station_code: k === s ? seg.from_station_code : null,
                to_station_code: k + 1 === e ? seg.to_station_code : null,
                departure_date: seg.departure_date,
                departure_time: dep.time,
                arrival_date: seg.arrival_date,
                arrival_time: arr.time,
                operator: seg.operator,
                service_number: null,
              }),
              ticket_type: seg.ticket_type,
            });
          }
          expanded = legs;
        }
      }
    }
    if (expanded) out.push(...expanded);
    else out.push(seg);
  }
  return out;
}

// Convenience: parse a whole email's HTML straight to bookings (used by the scan).
export function parseStructuredFromHtml(
  html: string,
  ctx: { gmail_message_id: string; raw_subject: string; email_date: string; providerHint: string | null },
): ParsedBooking[] {
  const bookings = parseStructuredBookings(extractJsonLd(html), ctx);
  const tokens = parseItineraryTokens(html);
  if (tokens.length >= 4) {
    for (const b of bookings) {
      if (b.type === "transport" && b.mode === "train") {
        b.segments = expandSegmentsWithItinerary(b.segments, tokens);
      }
    }
  }
  return bookings;
}
