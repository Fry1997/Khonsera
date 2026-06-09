import { describe, it, expect } from "vitest";
import { orderByTime, insertByTime, compareByTime, type TimedFact } from "./spine";

const f = (id: string, time?: string | null): TimedFact => ({ id, time });
const T = (hhmm: string) => `2026-06-18T${hhmm}:00`;

describe("orderByTime", () => {
  it("orders timed facts chronologically", () => {
    const out = orderByTime([f("c", T("13:00")), f("a", T("07:00")), f("b", T("09:30"))]);
    expect(out.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("sinks timeless facts below timed ones, preserving their order", () => {
    const out = orderByTime([f("late", T("18:00")), f("fuzzy1"), f("early", T("06:00")), f("fuzzy2")]);
    expect(out.map((x) => x.id)).toEqual(["early", "late", "fuzzy1", "fuzzy2"]);
  });
});

describe("insertByTime — lands at the right time, not appended", () => {
  it("inserts mid-spine by time", () => {
    const spine = [f("a", T("07:00")), f("c", T("13:00")), f("d", T("17:00"))];
    const out = insertByTime(spine, f("b", T("09:30")));
    expect(out.map((x) => x.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("inserts at the front when earliest", () => {
    const out = insertByTime([f("b", T("09:00"))], f("a", T("06:00")));
    expect(out.map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("places a new timed fact after the last timed but before trailing timeless", () => {
    const spine = [f("a", T("07:00")), f("fuzzy")];
    const out = insertByTime(spine, f("b", T("12:00")));
    expect(out.map((x) => x.id)).toEqual(["a", "b", "fuzzy"]);
  });

  it("appends timeless facts to the end", () => {
    const out = insertByTime([f("a", T("07:00"))], f("someday"));
    expect(out.map((x) => x.id)).toEqual(["a", "someday"]);
  });
});

describe("compareByTime", () => {
  it("is stable for two timeless facts", () => {
    expect(compareByTime(f("x"), f("y"))).toBe(0);
  });
});
