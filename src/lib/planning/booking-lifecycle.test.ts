import { describe, expect, it } from "vitest";
import {
  lifecycleState,
  essentialsRemaining,
  uberDeeplink,
  trainlineDeeplink,
} from "./booking-lifecycle";

describe("lifecycleState", () => {
  it("maps the status enum onto planning-side states", () => {
    expect(lifecycleState("not_started")).toBe("Proposed");
    expect(lifecycleState("opened_partner")).toBe("Proposed"); // Stage 0 can't confirm
    expect(lifecycleState("booked")).toBe("Booked");
    expect(lifecycleState("failed")).toBe("Failed");
    expect(lifecycleState("abandoned")).toBe("Cancelled");
  });
});

describe("essentialsRemaining", () => {
  it("counts everything not yet booked", () => {
    expect(
      essentialsRemaining([
        { status: "booked" },
        { status: "not_started" },
        { status: "opened_partner" },
      ]),
    ).toBe(2);
  });
  it("is zero when everything is booked", () => {
    expect(essentialsRemaining([{ status: "booked" }])).toBe(0);
  });
});

describe("uberDeeplink", () => {
  it("builds a universal link with pickup and dropoff", () => {
    const url = uberDeeplink({
      pickup: { lat: 52.3, lng: -0.69 },
      pickupName: "20 Wilce Ave",
      dropoff: { lat: 52.31, lng: -0.7 },
      dropoffName: "Wellingborough Station",
    });
    expect(url).toContain("https://m.uber.com/ul/?action=setPickup");
    expect(url).toContain("pickup[latitude]=52.3");
    expect(url).toContain("dropoff[longitude]=-0.7");
    expect(url).toContain("pickup[formatted_address]=20%20Wilce%20Ave");
  });

  it("omits dropoff when not provided", () => {
    const url = uberDeeplink({ pickup: { lat: 1, lng: 2 } });
    expect(url).not.toContain("dropoff");
  });
});

describe("trainlineDeeplink", () => {
  it("builds a return search when a return date is given", () => {
    const url = trainlineDeeplink({
      originCode: "WEL",
      destinationCode: "DBY",
      outwardDate: "2026-06-03",
      returnDate: "2026-06-03",
    });
    expect(url).toContain("origin=WEL");
    expect(url).toContain("destination=DBY");
    expect(url).toContain("journeySearchType=return");
    expect(url).toContain("returnDate=2026-06-03");
  });

  it("builds a single search without a return date", () => {
    const url = trainlineDeeplink({
      originCode: "WEL",
      destinationCode: "DBY",
      outwardDate: "2026-06-03",
    });
    expect(url).toContain("journeySearchType=single");
    expect(url).not.toContain("returnDate");
  });
});
