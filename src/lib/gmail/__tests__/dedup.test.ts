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
    // The scannable barcode + codes are grafted from the eticket.
    expect(merged.segments[0].barcode_ref).toBe("TTB5F6ZGTVQ");
    expect(merged.segments[0].from_station_code).toBe("WEL");
    expect(merged.segments[0].to_station_code).toBe("HAR");
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

  it("merges confirmation + eticket of the SAME ROUTE even when their parsed dates differ", () => {
    // The exact field regression: the anytime eticket parsed a fallback date
    // (today) while the confirmation read the real travel date. Route-grouping
    // pairs them regardless, so the trip isn't stranded at midnight.
    const confirmation = booking({
      raw_subject: "Your booking confirmation for Wellingborough to Harrogate",
      price: 84.5,
      segments: [seg({ departure_date: "2026-06-11", departure_time: "07:13", arrival_time: "09:42", from_station: "Wellingborough", to_station: "Harrogate" })],
    });
    const eticket = booking({
      raw_subject: "Your etickets to Harrogate",
      segments: [seg({ departure_date: "2026-06-10", departure_time: "00:00", from_station: "Wellingborough", to_station: "Harrogate", from_station_code: "WEL", to_station_code: "HAR", barcode_data: "RSP", barcode_ref: "TTB5F6ZGTVQ" })],
    });
    const out = deduplicateTrainlineBookings([eticket, confirmation]);
    expect(out).toHaveLength(1);
    const merged = out[0];
    if (merged.type !== "transport") throw new Error("expected transport");
    expect(merged.segments[0].departure_time).toBe("07:13");
    expect(merged.segments[0].barcode_data).toBe("RSP");
  });

  it("merges a multi-leg journey by its end-to-end route (WEL→...→HAR)", () => {
    // Confirmation with two legs (a change), eticket as a single end-to-end leg.
    // routeKey uses first.from → last.to, so both read WEL→HAR and pair up.
    const confirmation = booking({
      raw_subject: "Your booking confirmation",
      segments: [
        seg({ from_station: "Wellingborough", to_station: "Leicester", departure_time: "07:13", arrival_time: "07:48" }),
        seg({ from_station: "Leicester", to_station: "Harrogate", departure_time: "08:09", arrival_time: "09:42" }),
      ],
    });
    const eticket = booking({
      raw_subject: "Your etickets to Harrogate",
      segments: [seg({ from_station_code: "WEL", to_station_code: "HAR", barcode_ref: "TT1" })],
    });
    const out = deduplicateTrainlineBookings([confirmation, eticket]);
    expect(out).toHaveLength(1);
    const merged = out[0];
    if (merged.type !== "transport") throw new Error("expected transport");
    // The multi-leg structure (the richer confirmation) is the spine.
    expect(merged.segments).toHaveLength(2);
    expect(merged.segments[0].departure_time).toBe("07:13");
  });
});
