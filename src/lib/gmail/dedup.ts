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

  // Group by travel date — bookings on the same date are likely duplicates
  // (or the two halves of one trip: outbound vs return live on different dates,
  // so they group separately and each reconciles its own confirmation+eticket).
  const byDate = new Map<string, ParsedBooking[]>();
  for (const b of trainline) {
    const date = getTravelDate(b) ?? "unknown";
    const group = byDate.get(date) ?? [];
    group.push(b);
    byDate.set(date, group);
  }

  const kept: ParsedBooking[] = [];
  for (const group of byDate.values()) {
    if (group.length === 1) {
      kept.push(group[0]);
      continue;
    }
    kept.push(mergeTrainlineGroup(group));
  }

  return [...rest, ...kept];
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

  // Index every barcode-bearing leg across the group by its station pair, so we
  // can graft it onto the matching base leg.
  const legKey = (s: {
    from_station: string;
    to_station: string;
    from_station_code: string | null;
    to_station_code: string | null;
  }) => {
    const f = (s.from_station_code ?? s.from_station ?? "").slice(0, 3).toUpperCase();
    const t = (s.to_station_code ?? s.to_station ?? "").slice(0, 3).toUpperCase();
    return `${f}->${t}`;
  };
  const barcodeByLeg = new Map<
    string,
    {
      barcode_ref: string | null;
      barcode_data: string | null;
      from_station_code: string | null;
      to_station_code: string | null;
      ticket_type: string | null;
      coach: string | null;
      seat: string | null;
    }
  >();
  for (const b of transport) {
    for (const s of b.segments) {
      if (!s.barcode_ref && !s.barcode_data) continue;
      const key = legKey(s);
      if (!barcodeByLeg.has(key)) {
        barcodeByLeg.set(key, {
          barcode_ref: s.barcode_ref,
          barcode_data: s.barcode_data,
          from_station_code: s.from_station_code,
          to_station_code: s.to_station_code,
          ticket_type: s.ticket_type,
          coach: s.coach,
          seat: s.seat,
        });
      }
    }
  }

  // Graft barcodes / codes / ticket detail onto base legs that lack them.
  const mergedSegments = base.segments.map((s) => {
    const donor = barcodeByLeg.get(legKey(s));
    if (!donor) return s;
    return {
      ...s,
      barcode_ref: s.barcode_ref ?? donor.barcode_ref,
      barcode_data: s.barcode_data ?? donor.barcode_data,
      from_station_code: s.from_station_code ?? donor.from_station_code,
      to_station_code: s.to_station_code ?? donor.to_station_code,
      ticket_type: s.ticket_type ?? donor.ticket_type,
      coach: s.coach ?? donor.coach,
      seat: s.seat ?? donor.seat,
    };
  });

  // Best price + booking ref across the group.
  const price = transport.map((b) => b.price).find((p) => p != null) ?? base.price;
  const booking_reference =
    transport.map((b) => b.booking_reference).find((r) => r) ?? base.booking_reference;

  return { ...base, segments: mergedSegments, price, booking_reference };
}
