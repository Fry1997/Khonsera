import { describe, expect, it } from "vitest";
import { parseTrainlinePdfText } from "@/lib/gmail/trainline-pdf";

describe("parseTrainlinePdfText header layouts", () => {
  it("parses the seated-ticket layout (DATE FROM - TO)", () => {
    const t = parseTrainlinePdfText("TTBQEBVV49M\n25 Jun 2026 WEL - LEI\nWELLINGBOROUGH LEICESTER");
    expect(t?.from_code).toBe("WEL");
    expect(t?.to_code).toBe("LEI");
    expect(t?.date).toBe("2026-06-25");
  });

  it("parses the Anytime Day Return outbound layout (Out: FROM - TO)", () => {
    const t = parseTrainlinePdfText(
      "TTBSF6ZGTVQ\n11 Jun 2026 Out: WEL - HPD\nWELLINGBOROUGH HARPENDEN\nTICKET TYPE ROUTE\nAnytime Day Return ANY PERMITTED\nTicket Number TTBSF6ZGTVQ",
    );
    expect(t?.from_code).toBe("WEL");
    expect(t?.to_code).toBe("HPD");
    expect(t?.from_name).toBe("Wellingborough");
    expect(t?.to_name).toBe("Harpenden");
    expect(t?.date).toBe("2026-06-11");
    expect(t?.ticket_type).toBe("Anytime Day Return");
    expect(t?.barcode_ref).toBe("TTBSF6ZGTVQ");
  });

  it("parses the return layout (Ret: FROM - TO) without mismatching ANY PERMITTED", () => {
    const t = parseTrainlinePdfText(
      "TTBSF6ZGTVQ\n11 Jun 2026 Ret: HPD - WEL\nHARPENDEN WELLINGBOROUGH\nTICKET TYPE ROUTE\nAnytime Day Return ANY PERMITTED",
    );
    expect(t?.from_code).toBe("HPD");
    expect(t?.to_code).toBe("WEL");
  });

  it("falls back to the itinerary's first time when no DEPART header (flexible ticket)", () => {
    // The 07:50 eticket layout: no "DEPART\n07:50" header, but the Itinerary
    // section carries the times. Without the fallback this came through at 00:00
    // and the leg couldn't attach to its booking.
    const t = parseTrainlinePdfText(
      "25 Jun 2026 WEL - LEI\nWELLINGBOROUGH LEICESTER\nItinerary\n07:50\nWellingborough\n08:24\nLeicester\nTicket Details\nNRS Booking Reference N/A",
    );
    expect(t?.departure_time).toBe("07:50");
    expect(t?.arrival_time).toBe("08:24");
    // "N/A" must not leak through as the ref "N".
    expect(t?.nrs_ref).toBeNull();
  });

  it("still prefers the explicit DEPART header when present", () => {
    const t = parseTrainlinePdfText(
      "25 Jun 2026 WEL - LEI\nWELLINGBOROUGH LEICESTER\nDEPART\n07:13\nItinerary\n07:13\nWellingborough\n07:48\nLeicester\nTicket Details\nNRS Booking Reference MC287441",
    );
    expect(t?.departure_time).toBe("07:13");
    expect(t?.nrs_ref).toBe("MC287441");
  });
});
