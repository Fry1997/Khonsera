import { describe, it, expect } from "vitest";
import { foldStopsToLegTickets, type TransitStop } from "@/lib/tickets/from-stops";

// A WEL→Luton→Harpenden run: one through-ticket (single Aztec on the departure),
// a change at Luton. Per-leg folding must yield TWO rail cards, each carrying its
// own stations/times/CRS, with the through barcode reused on the onward hop.
const run: TransitStop[] = [
  {
    id: "wel",
    type: "transit_departure",
    title: "Wellingborough",
    start_time: "2026-06-11T06:25:00Z",
    end_time: "2026-06-11T06:25:00Z",
    code: "WEL",
    metadata: {
      transport_mode: "train",
      operator: "Thameslink",
      booking_reference: "ABC123",
      barcode_data: "AZTEC-THROUGH",
      ticket_type: "Anytime Day Return",
      price: "20.50",
    },
  },
  {
    id: "lut",
    type: "transit_changeover",
    title: "Luton",
    start_time: "2026-06-11T06:45:00Z", // arrival at the change
    end_time: "2026-06-11T06:50:00Z", // departure from the change
    code: "LUT",
    metadata: {},
  },
  {
    id: "hpd",
    type: "transit_arrival",
    title: "Harpenden",
    start_time: "2026-06-11T07:05:00Z",
    code: "HPD",
    metadata: {},
  },
];

describe("foldStopsToLegTickets", () => {
  it("emits one card per boarded hop with its own stations, times and CRS", () => {
    const legs = foldStopsToLegTickets(run);
    expect(legs).toHaveLength(2);

    const [out, onward] = legs;

    // Hop 1: WEL → Luton, departs at the origin start_time, arrives at the change.
    expect(out.originStopId).toBe("wel");
    expect(out.destStopId).toBe("lut");
    expect(out.isFirstLeg).toBe(true);
    expect(out.runDepartureStopId).toBe("wel");
    expect(out.ticket.legs[0].origin.code).toBe("WEL");
    expect(out.ticket.legs[0].destination.code).toBe("LUT");
    expect(out.ticket.legs[0].origin.time).toBe("2026-06-11T06:25:00Z");
    expect(out.ticket.legs[0].destination.time).toBe("2026-06-11T06:45:00Z");
    expect(out.ticket.legs[0].durationMinutes).toBe(20);

    // Hop 2: Luton → Harpenden, departs at the change's end_time (leave time).
    expect(onward.originStopId).toBe("lut");
    expect(onward.destStopId).toBe("hpd");
    expect(onward.isFirstLeg).toBe(false);
    expect(onward.runDepartureStopId).toBe("wel");
    expect(onward.ticket.legs[0].origin.code).toBe("LUT");
    expect(onward.ticket.legs[0].origin.time).toBe("2026-06-11T06:50:00Z");
    expect(onward.ticket.legs[0].destination.time).toBe("2026-06-11T07:05:00Z");
    expect(onward.ticket.legs[0].durationMinutes).toBe(15);
  });

  it("reuses the through-ticket barcode on the onward hop, prices only the first", () => {
    const [out, onward] = foldStopsToLegTickets(run);
    expect(out.ticket.legs[0].barcodes?.[0]?.value).toBe("AZTEC-THROUGH");
    expect(onward.ticket.legs[0].barcodes?.[0]?.value).toBe("AZTEC-THROUGH");
    expect(out.ticket.price).toBe(2050);
    expect(onward.ticket.price).toBeUndefined();
    // Booking-level facts carry onto every hop.
    expect(onward.ticket.operator).toBe("Thameslink");
    expect(onward.ticket.reference).toBe("ABC123");
  });

  it("prefers a per-hop barcode when the change station carries its own (split ticket)", () => {
    const split = run.map((st) =>
      st.id === "lut" ? { ...st, metadata: { barcode_data: "AZTEC-SECOND" } } : st,
    );
    const [, onward] = foldStopsToLegTickets(split);
    expect(onward.ticket.legs[0].barcodes?.[0]?.value).toBe("AZTEC-SECOND");
  });
});
