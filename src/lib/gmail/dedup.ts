// Trainline duplicate-email reconciliation. Pure (no IO) so it's unit-testable
// without a Gmail/Supabase harness. Imported by the scan action in
// `src/lib/actions/gmail.ts`.

import { type ParsedBooking, getTravelDate } from "@/lib/gmail/types";

type TransportBooking = Extract<ParsedBooking, { type: "transport" }>;

export function deduplicateTrainlineBookings(bookings: ParsedBooking[]): ParsedBooking[] {
  const trainline: ParsedBooking[] = [];
  const rest: ParsedBooking[] = [];

  for (const b of bookings) {
    if (b.type === "transport" && b.provider === "Trainline") {
      trainline.push(b);
    } else {
      rest.push(b);
    }
  }

  if (trainline.length <= 1) return bookings;

  // Group by travel DATE, then within a date cluster by SHARED STATION. The two
  // emails of one trip (a round-trip confirmation WEL→…→WEL + an outbound eticket
  // WEL→HAR) share stations, so they cluster and reconcile; two genuinely
  // unrelated trips on the same day share no station and stay separate (the bug
  // the Codex review flagged). Callers filter to future trips BEFORE this.
  const byDate = new Map<string, TransportBooking[]>();
  for (const b of trainline) {
    const date = getTravelDate(b) ?? "unknown";
    const group = byDate.get(date) ?? [];
    group.push(b as TransportBooking);
    byDate.set(date, group);
  }

  const kept: ParsedBooking[] = [];
  for (const group of byDate.values()) {
    for (const cluster of clusterBySharedStation(group)) {
      kept.push(cluster.length === 1 ? cluster[0] : mergeTrainlineGroup(cluster));
    }
  }

  return [...rest, ...kept];
}

// Every station a booking touches (origin/destination of each leg), normalised to
// a CRS code or the first 3 letters of the name so "Wellingborough" and "WEL" agree.
function stationsOf(b: TransportBooking): Set<string> {
  const out = new Set<string>();
  for (const s of b.segments) {
    if (s.from_station_code || s.from_station) out.add((s.from_station_code ?? s.from_station).slice(0, 3).toUpperCase());
    if (s.to_station_code || s.to_station) out.add((s.to_station_code ?? s.to_station).slice(0, 3).toUpperCase());
  }
  return out;
}

// Union bookings that share at least one station into clusters (same trip) —
// UNLESS they have a departure-time CONFLICT at a shared origin (see below), which
// marks them as two genuinely different bookings (e.g. a rebooking after a
// cancellation: 07:13 cancelled, 07:50 rebooked, same route + date). Without the
// conflict guard the rebooking gets merged into the cancelled trip and never shows.
function clusterBySharedStation(group: TransportBooking[]): TransportBooking[][] {
  const stations = group.map(stationsOf);
  const parent = group.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (a: number, b: number) => {
    parent[find(a)] = find(b);
  };
  for (let i = 0; i < group.length; i++) {
    for (let j = i + 1; j < group.length; j++) {
      if ([...stations[i]].some((s) => stations[j].has(s)) && !departuresConflict(group[i], group[j])) {
        union(i, j);
      }
    }
  }
  const byRoot = new Map<number, TransportBooking[]>();
  for (let i = 0; i < group.length; i++) {
    const r = find(i);
    const c = byRoot.get(r) ?? [];
    c.push(group[i]);
    byRoot.set(r, c);
  }
  return [...byRoot.values()];
}

// Real (non-placeholder) departure times per ORIGIN station for a booking.
// Anytime etickets carry 00:00 placeholders → excluded, so a confirmation+eticket
// of ONE trip never looks conflicting.
function departuresByOrigin(b: TransportBooking): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const s of b.segments) {
    if (!s.departure_time || s.departure_time === "00:00") continue;
    const key = (s.from_station_code ?? s.from_station ?? "").slice(0, 3).toUpperCase();
    if (!key) continue;
    (m.get(key) ?? m.set(key, new Set()).get(key)!).add(s.departure_time);
  }
  return m;
}

// Two bookings CONFLICT when they both have a real departure from the SAME origin
// station but at NON-OVERLAPPING times — i.e. you can't board the same train, so
// they're different bookings (a rebooking), not two emails of one trip.
function departuresConflict(a: TransportBooking, b: TransportBooking): boolean {
  const da = departuresByOrigin(a);
  const db = departuresByOrigin(b);
  for (const [origin, timesA] of da) {
    const timesB = db.get(origin);
    if (!timesB) continue; // the other side has no real departure here (placeholder) → not a conflict
    if (![...timesA].some((t) => timesB.has(t))) return true; // shared origin, disjoint times → conflict
  }
  return false;
}

// Trainline sends two emails for one trip: a booking CONFIRMATION (carries the
// intended train times + price) and an ETICKET (carries the scannable barcodes).
// For an "Anytime Day Return" / open ticket the eticket/PDF has no scheduled
// time at all (it's valid all day → 00:00 placeholders), so picking the eticket
// alone strands the trip at midnight. Rather than discard one, MERGE: take the
// member with the real intended times as the spine, then graft the barcodes /
// ticket detail from the others onto matching legs. Confirmation gives the WHEN,
// the eticket gives the WHAT-YOU-SCAN.
export function mergeTrainlineGroup(group: ParsedBooking[]): ParsedBooking {
  const transport = group.filter((b): b is TransportBooking => b.type === "transport");
  if (transport.length === 0) return group[0];

  const realTimeCount = (b: TransportBooking) =>
    b.segments.filter((s) => s.departure_time && s.departure_time !== "00:00").length;

  // The spine = whoever actually knows the times. Tiebreak to the booking
  // confirmation, then to the one with more legs (multi-leg detail).
  const base = [...transport].sort((a, b) => {
    const t = realTimeCount(b) - realTimeCount(a);
    if (t !== 0) return t;
    const aConf = /booking\s*confirmation/i.test(a.raw_subject) ? 1 : 0;
    const bConf = /booking\s*confirmation/i.test(b.raw_subject) ? 1 : 0;
    if (aConf !== bConf) return bConf - aConf;
    return b.segments.length - a.segments.length;
  })[0];

  // Index barcode-bearing donor legs by their ORIGIN station — NOT the full
  // station pair. A through-ticket Aztec from the eticket covers a whole journey
  // (WEL→HAR) keyed at where you board (WEL), but the confirmation splits that
  // journey into legs (WEL→Luton→Harpenden). Matching on origin attaches the
  // barcode to the base leg you board at (WEL→Luton), so the Pass shows the Aztec.
  // Key on the station NAME (first 3 letters), not the CRS code: a confirmation
  // names the station ("Harpenden") while the eticket carries the code ("HPD"),
  // and HPD ≠ HAR — so a code-first key would miss the return barcode. The PDF
  // donor resolves its code to the same name ("Harpenden"), so name-first aligns.
  const origin = (s: { from_station: string; from_station_code: string | null }) =>
    (s.from_station ?? s.from_station_code ?? "").slice(0, 3).toUpperCase();
  const barcodeByOrigin = new Map<
    string,
    { barcode_ref: string | null; barcode_data: string | null; from_station_code: string | null; ticket_type: string | null; coach: string | null; seat: string | null }
  >();
  for (const b of transport) {
    for (const s of b.segments) {
      if (!s.barcode_ref && !s.barcode_data) continue;
      const key = origin(s);
      if (!barcodeByOrigin.has(key)) {
        barcodeByOrigin.set(key, {
          barcode_ref: s.barcode_ref,
          barcode_data: s.barcode_data,
          from_station_code: s.from_station_code,
          ticket_type: s.ticket_type,
          coach: s.coach,
          seat: s.seat,
        });
      }
    }
  }

  // Graft each donor barcode onto the FIRST base leg departing that origin (the
  // boarding leg of the matching journey), so a barcode isn't duplicated across
  // every same-origin leg.
  const used = new Set<string>();
  const mergedSegments = base.segments.map((s) => {
    if (s.barcode_data || s.barcode_ref) return s;
    const key = origin(s);
    if (used.has(key)) return s;
    const donor = barcodeByOrigin.get(key);
    if (!donor) return s;
    used.add(key);
    return {
      ...s,
      barcode_ref: donor.barcode_ref,
      barcode_data: donor.barcode_data,
      from_station_code: s.from_station_code ?? donor.from_station_code,
      ticket_type: s.ticket_type ?? donor.ticket_type,
      coach: s.coach ?? donor.coach,
      seat: s.seat ?? donor.seat,
    };
  });

  // Best price + booking ref across the group. Reject junk refs like "N" / "N/A"
  // (a confirmation's "NRS Booking Reference N/A" mis-parses to these) in favour of
  // a real reference from another email.
  const validRef = (r: string | null): r is string => !!r && r.length > 2 && !/^N\/?A?$/i.test(r);
  const price = transport.map((b) => b.price).find((p) => p != null) ?? base.price;
  const booking_reference =
    transport.map((b) => b.booking_reference).find(validRef) ?? base.booking_reference;

  // Carry EVERY source email id, so importing the merged booking marks them all
  // (otherwise the un-marked eticket reappears alone — midnight — next scan).
  const source_message_ids = [
    ...new Set(group.map((g) => g.gmail_message_id).filter((id): id is string => !!id)),
  ];

  return { ...base, segments: mergedSegments, price, booking_reference, source_message_ids };
}
