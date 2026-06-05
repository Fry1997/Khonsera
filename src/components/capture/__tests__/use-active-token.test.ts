import { describe, it, expect } from "vitest";
import { activeTokenAt, replaceRange } from "../use-active-token";

describe("activeTokenAt", () => {
  it("detects an origin station after 'from'", () => {
    const text = "train from Wel";
    const t = activeTokenAt(text, text.length)!;
    expect(t.role).toBe("origin_station");
    expect(t.search).toBe("station");
    expect(t.hubKind).toBe("rail_station");
    expect(t.fragment).toBe("Wel");
    expect(text.slice(t.range.start, t.range.end)).toBe("Wel");
  });

  it("detects a destination station after 'to'", () => {
    const text = "train to Liverp";
    const t = activeTokenAt(text, text.length)!;
    expect(t.role).toBe("destination_station");
    expect(t.fragment).toBe("Liverp");
  });

  it("uses airport kind when the clause mentions flying", () => {
    const text = "fly to Edinb";
    const t = activeTokenAt(text, text.length)!;
    expect(t.hubKind).toBe("airport");
  });

  it("detects a place after 'at'", () => {
    const text = "dinner at Nan";
    const t = activeTokenAt(text, text.length)!;
    expect(t.role).toBe("place");
    expect(t.search).toBe("place");
    expect(t.fragment).toBe("Nan");
  });

  it("detects a person after 'meet' and 'with'", () => {
    expect(activeTokenAt("meet Der", 8)!.role).toBe("person");
    expect(activeTokenAt("meeting with Sa", 15)!.role).toBe("person");
  });

  it("captures multi-word fragments", () => {
    const text = "train to Liverpool Lime";
    const t = activeTokenAt(text, text.length)!;
    expect(t.fragment).toBe("Liverpool Lime");
  });

  it("stops at commas / clause breaks", () => {
    const text = "Derby demo, train from Wel";
    const t = activeTokenAt(text, text.length)!;
    expect(t.fragment).toBe("Wel");
  });

  it("returns null after a trailing space (gap)", () => {
    expect(activeTokenAt("train from ", 11)).toBeNull();
  });

  it("returns null with no operator", () => {
    expect(activeTokenAt("just a thought", 14)).toBeNull();
  });
});

describe("replaceRange", () => {
  it("rewrites the fragment to the canonical name and returns the new caret", () => {
    const text = "train from Wel";
    const t = activeTokenAt(text, text.length)!;
    const { text: next, caret } = replaceRange(text, t.range, "Wellingborough");
    expect(next).toBe("train from Wellingborough");
    expect(caret).toBe(next.length);
  });

  it("preserves text after the range", () => {
    const out = replaceRange("a to Liv now", { start: 5, end: 8 }, "Liverpool Lime Street");
    expect(out.text).toBe("a to Liverpool Lime Street now");
  });
});
