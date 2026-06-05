import { describe, expect, it } from "vitest";
import {
  boardingBufferMinutes,
  interchangeBufferMinutes,
  connectionBufferMinutes,
  isScheduledMode,
} from "./buffers";

describe("mode-specific buffers", () => {
  it("knows which modes run to a timetable", () => {
    expect(isScheduledMode("train")).toBe(true);
    expect(isScheduledMode("flight")).toBe(true);
    expect(isScheduledMode("drive")).toBe(false);
    expect(isScheduledMode("walk")).toBe(false);
  });

  it("pads a flight far more than a train", () => {
    expect(boardingBufferMinutes("flight")).toBeGreaterThan(
      boardingBufferMinutes("train"),
    );
    expect(boardingBufferMinutes("train")).toBeGreaterThan(0);
  });

  it("flexible modes have no boarding buffer", () => {
    expect(boardingBufferMinutes("walk")).toBe(0);
    expect(boardingBufferMinutes("drive")).toBe(0);
  });

  it("interchange is no worse than boarding except, by design, never larger for rail", () => {
    expect(interchangeBufferMinutes("train")).toBeLessThanOrEqual(
      boardingBufferMinutes("train"),
    );
  });
});

describe("connectionBufferMinutes", () => {
  it("is zero arriving into a flexible mode (you leave when you like)", () => {
    expect(connectionBufferMinutes("train", "drive")).toBe(0);
    expect(connectionBufferMinutes("walk", "walk")).toBe(0);
  });

  it("uses the boarding buffer off a flexible leg into a scheduled service", () => {
    expect(connectionBufferMinutes("taxi", "train")).toBe(
      boardingBufferMinutes("train"),
    );
    expect(connectionBufferMinutes("walk", "flight")).toBe(
      boardingBufferMinutes("flight"),
    );
  });

  it("uses the interchange buffer between two scheduled services", () => {
    expect(connectionBufferMinutes("train", "train")).toBe(
      interchangeBufferMinutes("train"),
    );
    expect(connectionBufferMinutes("flight", "flight")).toBe(
      interchangeBufferMinutes("flight"),
    );
  });
});
