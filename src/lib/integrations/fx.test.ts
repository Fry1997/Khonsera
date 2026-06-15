import { describe, it, expect } from "vitest";
import { applyRate } from "./fx";

describe("FX applyRate", () => {
  it("converts at the rate, rounded to pence", () => {
    expect(applyRate(100, 1.1732)).toBe(117.32);
    expect(applyRate(40, 1.25)).toBe(50);
  });
  it("is exact for whole amounts", () => {
    expect(applyRate(50, 2)).toBe(100);
  });
});
