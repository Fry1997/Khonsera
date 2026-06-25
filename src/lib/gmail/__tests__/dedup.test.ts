import { describe, expect, it } from "vitest";
import { deduplicateTrainlineBookings, mergeTrainlineGroup } from "@/lib/gmail/dedup";
import type { ParsedBooking, ParsedTransportSegment } from "@/lib/gmail/types";

function seg(p: Partial<ParsedTransportSegment>): ParsedTransportSegment {
  return {
    from_station: "Wellingborough",
    to_station: "Harrogate",
    from_station_code: null,
    to_station_code: null,
    departure_date: "2026-06-11",
    departure_time: "00:00",
    arrival_date: "2026-06-11",
    arrival_time: "00:00",
    service_number: null,
    operator: null,
    route_restriction: null,
    ticket_type: null,
    platform_dep: null,
    platform_arr: null,
    coach: null,
    seat: null,
    barcode_ref: null,
    barcode_data: null,
    ...p,
  };
}

function booking(p: Partial<Extract<ParsedBooking, { type: "transport" }>>): ParsedBooking {
  return {
    type: "transport",
    mode: "train",
    provider: "Trainline",
    booking_reference: null,
    price: null,
    currency: "GBP",
    segments: [seg({})],
    is_amendment: false,
    raw_subject: "",
    gmail_message_id: "m",
    email_date: "2026-06-09",
    ...p,
  };
}

describe("Trainline confirmation + eticket merge (anytime day return)", () => {
  it("keeps the confirmation's intended times and grafts the eticket's barcode", () => {
    const confirmation = booking({
      raw_subject: "Your booking confirmation for Wellingborough to Harrogate (11 Jun)",
      price: 84.5,
      segments: [seg({ departure_time: "07:13", arrival_time: "09:42", from_station: "Wellingborough", to_station: "Harrogate" })],
    });
    const eticket = booking({
      raw_subject: "Your etickets to Harrogate Thursday 11 June",
      booking_reference: "837531154592",
      segments: [
        seg({
          from_station: "Wellingborough",
          to_station: "Harrogate",
          from_station_code: "WEL",
          to_station_code: "HAR",
          barcode_ref: "TTB5F6ZGTVQ",
          ticket_type: "Anytime Day Return",
        }),
      ],
    });

    const out = deduplicateTrainlineBookings([confirmation, eticket]);
    expect(out).toHaveLength(1);
    const merged = out[0];
    if (merged.type !== "transport") throw new Error("expected transport");

    // The intended times survive — NOT stranded at midnight.
    expect(merged.segments[0].departure_time).toBe("07:13");
    expect(merged.segments[0].arrival_time).toBe("09:42");
    // The scannable barcode is grafted from the eticket onto the boarding leg.
    expect(merged.segments[0].barcode_ref).toBe("TTB5F6ZGTVQ");
    expect(merged.segments[0].from_station_code).toBe("WEL");
    expect(merged.segments[0].ticket_type).toBe("Anytime Day Return");
    // Price + ref filled from whichever member carried them.
    expect(merged.price).toBe(84.5);
    expect(merged.booking_reference).toBe("837531154592");
  });

  it("leaves an untwinned eticket untouched (genuine open ticket, no confirmation present)", () => {
    const eticket = booking({
      raw_subject: "Your etickets to Harrogate Thursday 11 June",
      segments: [seg({ from_station_code: "WEL", to_station_code: "HAR", barcode_ref: "TTB5F6ZGTVQ" })],
    });
    const out = deduplicateTrainlineBookings([eticket]);
    expect(out).toHaveLength(1);
    expect(out[0]).toBe(eticket);
  });

  it("merges by station pair even when the spine uses full names and the donor uses codes", () => {
    const confirmation = booking({
      raw_subject: "Your booking confirmation",
      segments: [seg({ departure_time: "07:13", from_station: "Wellingborough", to_station: "Harrogate" })],
    });
    const eticket = booking({
      raw_subject: "Your etickets to Harrogate",
      segments: [seg({ from_station: "WEL", to_station: "HAR", from_station_code: "WEL", to_station_code: "HAR", barcode_data: "RSP-PAYLOAD" })],
    });
    const merged = mergeTrainlineGroup([confirmation, eticket]);
    if (merged.type !== "transport") throw new Error("expected transport");
    expect(merged.segments[0].departure_time).toBe("07:13");
    expect(merged.segments[0].barcode_data).toBe("RSP-PAYLOAD");
  });

  it("keeps outbound and return (opposite routes) as two separate bookings", () => {
    const outbound = booking({ segments: [seg({ departure_date: "2026-06-11", departure_time: "07:13", from_station: "Wellingborough", to_station: "Harrogate" })] });
    const ret = booking({
      segments: [seg({ departure_date: "2026-06-12", departure_time: "18:20", from_station: "Harrogate", to_station: "Wellingborough" })],
    });
    const out = deduplicateTrainlineBookings([outbound, ret]);
    expect(out).toHaveLength(2);
  });

  it("reconciles a ROUND-TRIP confirmation with an outbound eticket (the real 11 Jun case)", () => {
    // The confirmation lists out+return in one booking (WEL→…→WEL); the eticket is
    // just the outbound (WEL→HAR). They share stations on the same date, so they
    // cluster and the confirmation's real times win — no midnight.
    const confirmation = booking({
      raw_subject: "Your booking confirmation for return trip Wellingborough to Harpenden",
      gmail_message_id: "conf-1",
      price: 24.5,
      segments: [
        seg({ from_station: "Wellingborough", to_station: "Luton", departure_time: "07:25", arrival_time: "07:55" }),
        seg({ from_station: "Luton", to_station: "Harpenden", departure_time: "08:13", arrival_time: "08:21" }),
        seg({ from_station: "Harpenden", to_station: "Luton", departure_time: "17:22", arrival_time: "17:32" }),
        seg({ from_station: "Luton", to_station: "Wellingborough", departure_time: "17:42", arrival_time: "18:08" }),
      ],
    });
    const eticket = booking({
      raw_subject: "Your etickets to Harpenden Thursday 11 June",
      gmail_message_id: "etk-1",
      segments: [seg({ from_station: "Wellingborough", to_station: "HAR", from_station_code: "WEL", to_station_code: "HAR", departure_time: "00:00", barcode_ref: "TTBSF6ZGTVQ" })],
    });
    const out = deduplicateTrainlineBookings([eticket, confirmation]);
    expect(out).toHaveLength(1);
    const merged = out[0];
    if (merged.type !== "transport") throw new Error("expected transport");
    // The full round trip with real times survives.
    expect(merged.segments).toHaveLength(4);
    expect(merged.segments[0].departure_time).toBe("07:25");
    expect(merged.segments[3].arrival_time).toBe("18:08");
    expect(merged.price).toBe(24.5);
    // The outbound eticket's through-ticket barcode grafts onto the WEL boarding
    // leg (origin match), even though the confirmation splits WEL→Luton→Harpenden.
    expect(merged.segments[0].barcode_ref).toBe("TTBSF6ZGTVQ");
    // BOTH source emails are recorded, so importing marks them both (otherwise the
    // un-marked eticket reappears alone next scan).
    if (merged.type !== "transport") throw new Error("expected transport");
    expect(new Set(merged.source_message_ids)).toEqual(new Set(["conf-1", "etk-1"]));
  });

  it("does NOT merge two unrelated trips on the same date (no shared station)", () => {
    const toDerby = booking({ segments: [seg({ from_station: "Wellingborough", to_station: "Derby", departure_time: "07:13" })] });
    const londonToManchester = booking({
      segments: [seg({ from_station: "London Euston", to_station: "Manchester", departure_time: "09:00", from_station_code: "EUS", to_station_code: "MAN" })],
    });
    const out = deduplicateTrainlineBookings([toDerby, londonToManchester]);
    expect(out).toHaveLength(2);
  });

  it("does NOT merge a REBOOKING with the cancelled trip (same route+date, different departure)", () => {
    // Real case: the 07:13 Wellingborough→Harpenden was cancelled and rebooked as
    // the 07:50. Same route, same day, but a departure-time CONFLICT at WEL → two
    // different bookings that must both survive (so the new 07:50 shows).
    const cancelled = booking({
      booking_reference: "AAA111",
      raw_subject: "Your booking confirmation for Wellingborough to Harpenden (18 Jun)",
      segments: [seg({ from_station: "Wellingborough", to_station: "Harpenden", departure_time: "07:13", departure_date: "2026-06-18" })],
    });
    const rebooked = booking({
      booking_reference: "BBB222",
      raw_subject: "Your booking confirmation for Wellingborough to Harpenden (18 Jun)",
      segments: [seg({ from_station: "Wellingborough", to_station: "Harpenden", departure_time: "07:50", departure_date: "2026-06-18" })],
    });
    const out = deduplicateTrainlineBookings([cancelled, rebooked]);
    expect(out).toHaveLength(2);
    const times = out.flatMap((b) => (b.type === "transport" ? b.segments.map((s) => s.departure_time) : []));
    expect(new Set(times)).toEqual(new Set(["07:13", "07:50"]));
  });

  it("STILL merges a confirmation with its anytime eticket (00:00 placeholder ≠ conflict)", () => {
    // Guard the fix: the legit two-email-one-trip case must keep merging. The
    // eticket's 00:00 placeholder is not a real departure, so it is not a conflict.
    const confirmation = booking({
      gmail_message_id: "c",
      raw_subject: "Your booking confirmation for Wellingborough to Harpenden (18 Jun)",
      segments: [seg({ from_station: "Wellingborough", to_station: "Harpenden", departure_time: "07:13", departure_date: "2026-06-18" })],
    });
    const eticket = booking({
      gmail_message_id: "e",
      raw_subject: "Your etickets to Harpenden",
      segments: [seg({ from_station: "Wellingborough", to_station: "Harpenden", departure_time: "00:00", departure_date: "2026-06-18", barcode_ref: "AZTEC1" })],
    });
    const out = deduplicateTrainlineBookings([confirmation, eticket]);
    expect(out).toHaveLength(1);
  });

  it("FLAGS a likely rebooking (not silently drop) — keeps both, marks the older (the real Derby case)", () => {
    // Same route + travel date, different departure, booked a month apart: the
    // 07:13 (booked 24 May) was scrapped by an EMR incident and rebooked as the
    // 07:50. No cancellation email exists, so we don't guess — we KEEP both and
    // flag the older so the import surface asks, recommending the newer.
    const old0713 = booking({
      gmail_message_id: "old",
      email_date: "2026-05-24T17:22:00Z",
      raw_subject: "Wellingborough to Derby (07:13 - 15:08)",
      segments: [seg({ from_station: "Wellingborough", to_station: "Derby", departure_time: "07:13", departure_date: "2026-06-25" })],
    });
    const new0750 = booking({
      gmail_message_id: "new",
      email_date: "2026-06-20T09:00:00Z",
      raw_subject: "Wellingborough to Derby (07:50 - 15:09)",
      segments: [seg({ from_station: "Wellingborough", to_station: "Derby", departure_time: "07:50", departure_date: "2026-06-25" })],
    });
    const out = deduplicateTrainlineBookings([old0713, new0750]);
    expect(out).toHaveLength(2); // both kept — the user decides
    const byDep = Object.fromEntries(
      out.flatMap((b) => (b.type === "transport" ? [[b.segments[0].departure_time, b]] : [])),
    );
    // The older 07:13 is flagged as superseded by the newer 07:50; the 07:50 is not.
    expect((byDep["07:13"] as { superseded_by?: string }).superseded_by).toBe("07:50");
    expect((byDep["07:50"] as { superseded_by?: string }).superseded_by).toBeUndefined();
  });
});
