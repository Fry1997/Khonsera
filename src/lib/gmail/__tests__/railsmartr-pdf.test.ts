import { describe, expect, it } from "vitest";
import {
  parseRailsmartrPdfText,
  railsmartrTicketsToSegments,
} from "@/lib/gmail/railsmartr-pdf";

// Verbatim text as unpdf extracts it from the real RailSmartr eTickets
// (booking AABTSKFL9ZB, Wellingborough⇄Harpenden, 18 Jun 2026). The "ß" is how
// the directional arrow glyph decodes — kept faithful so the test guards reality.
const OUTBOUND =
  "AABTSKFL9ZB 18 Jun 2026 Out: WEL - HPD WELLINGBOROUGH WEL ß HARPENDEN HPD " +
  "TICKET TYPE Anytime Day Return ROUTE ANY PERMITTED ADULT VALID UNTIL 26-30 Railcard " +
  "18 Jun 2026 Itinerary - Suggested 18 June: " +
  "07:25 East Midlands Railway From Wellingborough To Luton " +
  "08:13 Thameslink From Luton To Harpenden " +
  "Ticket Details: Issued subject to the National Rail Conditions of Travel and CIV " +
  "Ticket Number AABTSKFL9ZB Price £24.60 Purchased on 17 June 2026 " +
  "Thank you for buying from Railsmartr quote your Order ID WEB000181489 Powered by TCPDF";

const RETURN =
  "AABTSKFL9ZB 18 Jun 2026 Ret: HPD - WEL HARPENDEN HPD ß WELLINGBOROUGH WEL " +
  "TICKET TYPE Anytime Day Return ROUTE ANY PERMITTED ADULT VALID UNTIL 26-30 Railcard " +
  "18 Jun 2026 Itinerary - Suggested 18 June: " +
  "17:22 Thameslink From Harpenden To Luton " +
  "17:42 East Midlands Railway From Luton To Wellingborough " +
  "Ticket Details: Ticket Number AABTSKFL9ZB Price £24.60 Order ID WEB000181489 Powered by TCPDF";

describe("parseRailsmartrPdfText", () => {
  it("parses the outbound eTicket end to end", () => {
    const t = parseRailsmartrPdfText(OUTBOUND);
    expect(t).not.toBeNull();
    expect(t?.direction).toBe("out");
    expect(t?.from_code).toBe("WEL");
    expect(t?.to_code).toBe("HPD");
    expect(t?.date).toBe("2026-06-18");
    expect(t?.ticket_type).toBe("Anytime Day Return");
    expect(t?.route_restriction).toBe("ANY PERMITTED");
    expect(t?.railcard).toBe("26-30");
    expect(t?.price).toBe(24.6);
    expect(t?.ticket_number).toBe("AABTSKFL9ZB");
    expect(t?.order_id).toBe("WEB000181489");
  });

  it("parses the suggested itinerary into legs with the Luton change", () => {
    const t = parseRailsmartrPdfText(OUTBOUND);
    expect(t?.legs).toHaveLength(2);
    expect(t?.legs[0]).toMatchObject({
      departure_time: "07:25",
      operator: "East Midlands Railway",
      from_name: "Wellingborough",
      to_name: "Luton",
    });
    expect(t?.legs[1]).toMatchObject({
      departure_time: "08:13",
      operator: "Thameslink",
      from_name: "Luton",
      to_name: "Harpenden",
    });
  });

  it("parses the return half and its direction", () => {
    const t = parseRailsmartrPdfText(RETURN);
    expect(t?.direction).toBe("ret");
    expect(t?.from_code).toBe("HPD");
    expect(t?.to_code).toBe("WEL");
    expect(t?.legs.map((l) => l.departure_time)).toEqual(["17:22", "17:42"]);
    expect(t?.legs[1].to_name).toBe("Wellingborough");
  });

  it("returns null for unrelated PDF text", () => {
    expect(parseRailsmartrPdfText("Powered by TCPDF some random receipt")).toBeNull();
  });
});

describe("railsmartrTicketsToSegments", () => {
  it("combines outbound + return into four chronological segments", () => {
    const out = parseRailsmartrPdfText(OUTBOUND)!;
    const ret = parseRailsmartrPdfText(RETURN)!;
    out.barcode_data = "OUT_AZTEC";
    ret.barcode_data = "RET_AZTEC";

    const segs = railsmartrTicketsToSegments([out, ret], "2026-06-18").sort((a, b) =>
      (a.departure_date + a.departure_time).localeCompare(b.departure_date + b.departure_time),
    );

    expect(segs).toHaveLength(4);
    expect(segs.map((s) => s.departure_time)).toEqual(["07:25", "08:13", "17:22", "17:42"]);
    // Fare endpoints carry CRS codes; the Luton interchange does not.
    expect(segs[0].from_station_code).toBe("WEL");
    expect(segs[0].to_station_code).toBeNull();
    expect(segs[1].to_station_code).toBe("HPD");
    // Ticket-level facts + the Aztec attach to the first leg the passenger boards.
    expect(segs[0].barcode_ref).toBe("AABTSKFL9ZB");
    expect(segs[0].barcode_data).toBe("OUT_AZTEC");
    expect(segs[0].ticket_type).toBe("Anytime Day Return");
    expect(segs[2].barcode_data).toBe("RET_AZTEC"); // first leg of the return
    expect(segs[1].barcode_data).toBeNull(); // second leg of a ticket carries no barcode
    expect(segs[0].operator).toBe("East Midlands Railway");
  });

  it("derives arrival times so the importer can split & sequence", () => {
    const out = parseRailsmartrPdfText(OUTBOUND)!;
    const ret = parseRailsmartrPdfText(RETURN)!;
    const segs = railsmartrTicketsToSegments([out, ret], "2026-06-18").sort((a, b) =>
      (a.departure_date + a.departure_time).localeCompare(b.departure_date + b.departure_time),
    );

    // First leg arrives by the onward (Luton) departure; never empty.
    expect(segs[0].arrival_time).toBe("08:13"); // WEL→Luton arrives by the 08:13 onward
    expect(segs[2].arrival_time).toBe("17:42"); // HPD→Luton arrives by the 17:42 onward
    // Final leg of each direction is estimated (+30), not left blank.
    expect(segs[1].arrival_time).toBe("08:43");
    expect(segs[3].arrival_time).toBe("18:12");
    expect(segs.every((s) => s.arrival_time !== "")).toBe(true);
  });

  it("splits into TWO journeys (outbound + return) the way importBookingAsRun does", () => {
    const out = parseRailsmartrPdfText(OUTBOUND)!;
    const ret = parseRailsmartrPdfText(RETURN)!;
    const segs = railsmartrTicketsToSegments([out, ret], "2026-06-18").sort((a, b) =>
      (a.departure_date + a.departure_time).localeCompare(b.departure_date + b.departure_time),
    );

    // Mirror of the importer's gap-based split (gap > 180 min starts a new Pass).
    const toMin = (t: string) => parseInt(t.slice(0, 2), 10) * 60 + parseInt(t.slice(3), 10);
    const journeys: (typeof segs)[] = [];
    let cur: typeof segs = [];
    segs.forEach((s, k) => {
      if (k > 0) {
        const gap = toMin(s.departure_time) - toMin(segs[k - 1].arrival_time);
        if (gap > 180) {
          journeys.push(cur);
          cur = [];
        }
      }
      cur.push(s);
    });
    if (cur.length) journeys.push(cur);

    expect(journeys).toHaveLength(2);
    // Outbound: WEL → (change at Luton) → HPD
    expect(journeys[0].map((s) => s.from_station)).toEqual(["Wellingborough", "Luton"]);
    expect(journeys[0][journeys[0].length - 1].to_station).toBe("Harpenden");
    // Return: HPD → (change at Luton) → WEL
    expect(journeys[1].map((s) => s.from_station)).toEqual(["Harpenden", "Luton"]);
    expect(journeys[1][journeys[1].length - 1].to_station).toBe("Wellingborough");
  });
});
