import { describe, expect, it } from "vitest";
import { deriveTripNeeds, type TripNeedsInput } from "./trip-needs";

// Trip on Thu 4 Jun; "now" is Mon 1 Jun.
const base: TripNeedsInput = {
  now: "2026-06-01T09:00:00.000Z",
  tripDate: "2026-06-04T08:00:00.000Z",
  timezone: "Europe/London",
  appointments: [],
  taxiIntents: [],
  railLegs: [],
  accommodations: [],
  prerequisiteIntents: [],
};

describe("deriveTripNeeds", () => {
  it("flags appointments with no firm duration", () => {
    const needs = deriveTripNeeds({
      ...base,
      appointments: [
        { id: "a1", title: "Dancing Duck", durationKind: "unset" },
        { id: "a2", title: "Fixed", durationKind: "precise" },
        { id: "a3", title: "Fuzzy", durationKind: "fuzzy" },
        { id: "a4", title: "Null", durationKind: null },
      ],
    });
    const ids = needs.filter((n) => n.action_type === "set_duration").map((n) => n.target_id);
    expect(ids.sort()).toEqual(["a1", "a3", "a4"]);
  });

  it("flags proposed taxis but not booked ones", () => {
    const needs = deriveTripNeeds({
      ...base,
      taxiIntents: [
        { id: "t1", status: "not_started", summary: "home → station" },
        { id: "t2", status: "booked", summary: "done" },
      ],
    });
    const taxi = needs.filter((n) => n.action_type === "book_taxi");
    expect(taxi).toHaveLength(1);
    expect(taxi[0].target_id).toBe("t1");
  });

  it("flags unbooked rail legs and hotels", () => {
    const needs = deriveTripNeeds({
      ...base,
      railLegs: [
        { id: "r1", label: "outbound to Derby", booked: false },
        { id: "r2", label: "return", booked: true },
      ],
      accommodations: [{ id: "h1", title: "Premier Inn", booked: false }],
    });
    expect(needs.find((n) => n.action_type === "book_rail")?.target_id).toBe("r1");
    expect(needs.find((n) => n.action_type === "book_hotel")?.target_id).toBe("h1");
  });

  it("classifies email/confirm intents as email_contact, others as confirm_booking", () => {
    const needs = deriveTripNeeds({
      ...base,
      prerequisiteIntents: [
        { id: "i1", label: "Email Dancing Duck to confirm", surfaceAfter: null },
        { id: "i2", label: "Pack the demo kit", surfaceAfter: null },
      ],
    });
    expect(needs.find((n) => n.target_id === "i1")?.action_type).toBe("email_contact");
    expect(needs.find((n) => n.target_id === "i2")?.action_type).toBe("confirm_booking");
  });

  it("orders most-urgent first by deadline", () => {
    const needs = deriveTripNeeds({
      ...base,
      appointments: [{ id: "a1", title: "X", durationKind: "unset" }], // due today
      accommodations: [{ id: "h1", title: "Hotel", booked: false }], // 2 days before trip
    });
    // set_duration (lead 0 → trip day, but "today" label) vs hotel (lead 2).
    // Hotel deadline = tripDate - 2d = Tue 2 Jun; set_duration = Thu 4 Jun.
    // So hotel is more urgent.
    expect(needs[0].action_type).toBe("book_hotel");
  });

  it("labels a same-or-past deadline as today", () => {
    const needs = deriveTripNeeds({
      ...base,
      now: "2026-06-04T06:00:00.000Z", // trip day
      appointments: [{ id: "a1", title: "X", durationKind: "unset" }],
    });
    expect(needs[0].when).toBe("today");
  });

  it("labels a near deadline with the weekday", () => {
    const needs = deriveTripNeeds({
      ...base,
      now: "2026-05-29T09:00:00.000Z", // Fri 29 May
      accommodations: [{ id: "h1", title: "Hotel", booked: false }],
    });
    // tripDate Thu 4 Jun − 2 days = Tue 2 Jun, 4 days out → weekday label.
    expect(needs[0].when).toBe("Tue");
  });
});
