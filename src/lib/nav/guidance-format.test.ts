import { describe, expect, it } from "vitest";
import { spareLabel, etaForLabel, defaultEtaSub, glyphForMode } from "./guidance-format";

describe("spareLabel", () => {
  it("phrases by state — early / spare / late", () => {
    expect(spareLabel({ state: "on_track", spareMin: 13 })).toBe("13 MIN EARLY");
    expect(spareLabel({ state: "thinning", spareMin: 4 })).toBe("4 MIN SPARE");
    expect(spareLabel({ state: "will_miss", spareMin: -3 })).toBe("3 MIN LATE");
  });
});

describe("etaForLabel / defaultEtaSub", () => {
  it("builds the eyebrow", () => {
    expect(etaForLabel("the 14:00 meeting")).toBe("For the 14:00 meeting");
  });
  it("gives a calm world-fact sub per state", () => {
    expect(defaultEtaSub({ state: "on_track" })).toMatch(/room/i);
    expect(defaultEtaSub({ state: "thinning" })).toMatch(/thin/i);
    expect(defaultEtaSub({ state: "will_miss" })).toMatch(/past the hour/i);
  });
});

describe("glyphForMode", () => {
  it("maps recovery modes to glyph keys, mixed → drive", () => {
    expect(glyphForMode("tube")).toBe("tube");
    expect(glyphForMode("taxi")).toBe("taxi");
    expect(glyphForMode("bus")).toBe("bus");
    expect(glyphForMode("walk")).toBe("walk");
    expect(glyphForMode("rail")).toBe("rail");
    expect(glyphForMode("mixed")).toBe("drive");
  });
});
