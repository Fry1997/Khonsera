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

  return [...rest, ...supersedeRebookings(kept)];
}

// Rebooking supersede. A cancelled-then-rebooked trip leaves TWO confirmed bookings
// (same route + date, different departure — e.g. the 07:13 that was cancelled and
// the 07:50 rebooked) and Trainline sends NO cancellation email, so nothing in the
// data marks the old one dead. Heuristic: when two SEPARATE bookings cover the same
// stations + travel date but were BOOKED at different times, the more recently
// booked one wins; the older is dropped from import (it stays in the inbox). Only
// fires when the booking/email dates differ — genuine same-session double-bookings
// are untouched.
// Group candidates by SAME ORIGIN + travel date. The destination set is NOT part of
// the key: a rebooking can change the routing (the 07:13 ran direct WEL→Derby while
// the 07:50 went via Leicester), so keying on every station would split the very
// pair we want to compare. We then only flag within the group when destinations
// actually overlap (below), so two unrelated trips from the same origin/day don't
// false-match.
function originDateKey(b: TransportBooking): string {
  const origin = b.segments[0]
    ? (b.segments[0].from_station_code ?? b.segments[0].from_station ?? "").slice(0, 3).toUpperCase()
    : "";
  return origin + "|" + (getTravelDate(b) ?? "");
}
function destinationsOf(b: TransportBooking): Set<string> {
  const out = new Set<string>();
  for (const s of b.segments) {
    if (s.to_station_code || s.to_station) out.add((s.to_station_code ?? s.to_station).slice(0, 3).toUpperCase());
  }
  return out;
}
export function supersedeRebookings(bookings: ParsedBooking[]): ParsedBooking[] {
  const out: ParsedBooking[] = bookings.filter((b) => b.type !== "transport");
  const byRoute = new Map<string, TransportBooking[]>();
  for (const b of bookings) {
    if (b.type !== "transport") continue;
    const k = originDateKey(b);
    const g = byRoute.get(k) ?? [];
    g.push(b);
    byRoute.set(k, g);
  }
  for (const group of byRoute.values()) {
    if (group.length === 1) {
      out.push(group[0]);
      continue;
    }
    // The most recently booked is the live one. Flag any OLDER booking that shares
    // a destination with it (same trip, rebooked) — don't silently drop, so the
    // import surface can ASK and recommend the newer.
    const newest = group.reduce((a, b) => (b.email_date > a.email_date ? b : a));
    const newestDests = destinationsOf(newest);
    const newestDep = newest.segments[0]?.departure_time || "the later booking";
    for (const b of group) {
      const sharesDest = [...destinationsOf(b)].some((d) => newestDests.has(d));
      const older = b.email_date < newest.email_date;
      out.push(b !== newest && older && sharesDest ? { ...b, superseded_by: newestDep } : b);
    }
  }
  return out;
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

// Cluster the same-date Trainline emails into trips. The booking REFERENCE is the
// natural key: Trainline gives one reference per booking and repeats it across that
// booking's emails (confirmation + eticket). So:
//   • two DIFFERENT valid references are two DIFFERENT bookings and NEVER merge
//     (e.g. a cancelled-then-rebooked trip: MC287441 @07:13 vs 471218902520 @07:50,
//     same route + date — both must survive so the new 07:50 shows); and
//   • a reference-less member (an eticket whose ref didn't parse — often an unparsed
//     PDF that comes through as all-00:00) joins the SINGLE best-matching reference
//     cluster by shared station, so it can NEVER bridge two real bookings into one.
// The old union-find keyed purely on shared-station + departure-conflict; a 00:00
// eticket has no real departure so it "conflicted" with nothing and transitively
// merged every Derby booking into one (the 07:50 vanished into the 07:13).
function clusterBySharedStation(group: TransportBooking[]): TransportBooking[][] {
  const byRef = new Map<string, TransportBooking[]>();
  const noRef: TransportBooking[] = [];
  for (const b of group) {
    const ref = validBookingRef(b.booking_reference) ? b.booking_reference : null;
    if (ref) (byRef.get(ref) ?? byRef.set(ref, []).get(ref)!).push(b);
    else noRef.push(b);
  }
  const clusters = [...byRef.values()];
  for (const nb of noRef) {
    const nbStations = stationsOf(nb);
    let best = -1;
    let bestScore = 0;
    for (let i = 0; i < clusters.length; i++) {
      // Don't attach to a cluster it can't board with (real departure conflict).
      if (clusters[i].some((c) => departuresConflict(c, nb))) continue;
      const score = clusters[i].reduce(
        (acc, c) => acc + [...stationsOf(c)].filter((s) => nbStations.has(s)).length,
        0,
      );
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    if (best >= 0) clusters[best].push(nb);
    else clusters.push([nb]); // no home → its own trip (don't force-merge)
  }
  return clusters;
}

// A real booking reference (not null, not a mis-parsed "N"/"N/A" placeholder).
function validBookingRef(r: string | null): r is string {
  return !!r && r.length > 2 && !/^N\/?A?$/i.test(r);
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
