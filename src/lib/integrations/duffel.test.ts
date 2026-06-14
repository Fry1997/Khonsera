import { describe, it, expect } from "vitest";
import { mapDuffelOffer, mapDuffelOrder, mapDuffelStay, type DuffelOffer } from "./duffel";

// Fixtures mirror the real Duffel v2 shapes (research, June 2026).
const offer: DuffelOffer = {
  id: "off_123",
  total_amount: "243.50",
  total_currency: "GBP",
  owner: { iata_code: "BA", name: "British Airways" },
  expires_at: "2026-07-01T10:30:00Z",
  passengers: [{ id: "pas_1", type: "adult" }],
  slices: [
    {
      origin: { iata_code: "LHR" },
      destination: { iata_code: "JFK" },
      segments: [
        {
          origin: { iata_code: "LHR" },
          destination: { iata_code: "JFK" },
          departing_at: "2026-07-21T07:25:00",
          arriving_at: "2026-07-21T10:40:00",
          marketing_carrier: { iata_code: "BA", name: "British Airways" },
          marketing_carrier_flight_number: "115",
        },
      ],
    },
  ],
};

describe("Duffel flight mappers", () => {
  it("maps an offer to a comparable Offer", () => {
    const o = mapDuffelOffer(offer);
    expect(o).toMatchObject({ id: "off_123", kind: "flight", provider: "duffel", sample: false });
    expect(o.price).toEqual({ amount: "243.50", currency: "GBP" });
    expect(o.title).toContain("British Airways");
    expect(o.title).toContain("LHR → JFK");
    expect(o.summary).toContain("direct");
    expect(o.startIso).toBe("2026-07-21T07:25:00");
  });

  it("counts stops from segments", () => {
    const twoSeg: DuffelOffer = {
      ...offer,
      slices: [{ ...offer.slices![0], segments: [offer.slices![0].segments![0], offer.slices![0].segments![0]] }],
    };
    expect(mapDuffelOffer(twoSeg).summary).toContain("1 stop");
  });

  it("maps a created order to a Booking with the PNR + e-ticket", () => {
    const b = mapDuffelOrder({
      id: "ord_9",
      booking_reference: "RKM5TY",
      total_amount: "243.50",
      total_currency: "GBP",
      owner: { name: "British Airways" },
      slices: offer.slices,
      documents: [{ type: "electronic_ticket", unique_identifier: "125-1234567890" }],
    });
    expect(b.reference).toBe("RKM5TY");
    expect(b.documents).toEqual([{ type: "electronic_ticket", id: "125-1234567890" }]);
    expect(b.startIso).toBe("2026-07-21T07:25:00");
  });
});

describe("Duffel stay mapper", () => {
  it("maps a search result to a comparable Offer", () => {
    const o = mapDuffelStay({
      id: "ssr_1",
      accommodation: { name: "The Resident", rating: 4, review_score: 8.9, location: { address: { city_name: "London" } } },
      cheapest_rate_total_amount: "312.00",
      cheapest_rate_currency: "GBP",
    });
    expect(o).toMatchObject({ kind: "stay", provider: "duffel", title: "The Resident" });
    expect(o.price).toEqual({ amount: "312.00", currency: "GBP" });
    expect(o.summary).toContain("4★");
    expect(o.summary).toContain("London");
  });
});
