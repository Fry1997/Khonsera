import { describe, it, expect } from "vitest";
import { checkLegFeasibility } from "./check";

const t = (iso: string) => new Date(iso);

describe("checkLegFeasibility", () => {
  it("returns unknown when any input is missing", () => {
    expect(
      checkLegFeasibility({
        fromEnd: null,
        toStart: t("2026-01-01T10:00"),
        travelMinutes: 20,
      }).state,
    ).toBe("unknown");
    expect(
      checkLegFeasibility({
        fromEnd: t("2026-01-01T09:00"),
        toStart: null,
        travelMinutes: 20,
      }).state,
    ).toBe("unknown");
    expect(
      checkLegFeasibility({
        fromEnd: t("2026-01-01T09:00"),
        toStart: t("2026-01-01T10:00"),
        travelMinutes: null,
      }).state,
    ).toBe("unknown");
  });

  it("returns ok with comfortable slack", () => {
    const res = checkLegFeasibility({
      fromEnd: t("2026-01-01T09:00"),
      toStart: t("2026-01-01T10:00"),
      travelMinutes: 20,
    });
    expect(res.state).toBe("ok");
  });

  it("returns tight when slack is under the buffer", () => {
    const res = checkLegFeasibility({
      fromEnd: t("2026-01-01T09:00"),
      toStart: t("2026-01-01T09:25"),
      travelMinutes: 20,
    });
    expect(res.state).toBe("tight");
    if (res.state === "tight") {
      expect(res.slackMinutes).toBe(5);
    }
  });

  it("returns late when travel exceeds the gap", () => {
    const res = checkLegFeasibility({
      fromEnd: t("2026-01-01T09:00"),
      toStart: t("2026-01-01T09:15"),
      travelMinutes: 30,
    });
    expect(res.state).toBe("late");
    if (res.state === "late") {
      expect(res.shortMinutes).toBe(15);
    }
  });

  it("returns late when there's no gap at all", () => {
    const res = checkLegFeasibility({
      fromEnd: t("2026-01-01T10:00"),
      toStart: t("2026-01-01T10:00"),
      travelMinutes: 20,
    });
    expect(res.state).toBe("late");
  });

  it("respects a custom buffer", () => {
    // 20 min travel, 25 min gap → 5 min slack. Default buffer 10 →
    // tight. Custom buffer 3 → ok.
    const tight = checkLegFeasibility({
      fromEnd: t("2026-01-01T09:00"),
      toStart: t("2026-01-01T09:25"),
      travelMinutes: 20,
    });
    expect(tight.state).toBe("tight");
    const ok = checkLegFeasibility({
      fromEnd: t("2026-01-01T09:00"),
      toStart: t("2026-01-01T09:25"),
      travelMinutes: 20,
      bufferMinutes: 3,
    });
    expect(ok.state).toBe("ok");
  });

  it("derives the buffer from the mode being caught (P1.2)", () => {
    // 60 min travel into a 75 min gap → 15 min slack. Catching a train
    // (boarding buffer ~8) is comfortable; catching a flight (~90) is late.
    const base = {
      fromEnd: t("2026-01-01T09:00"),
      toStart: t("2026-01-01T10:15"),
      travelMinutes: 60,
    } as const;
    expect(checkLegFeasibility({ ...base, boardingMode: "train" }).state).toBe(
      "ok",
    );
    expect(checkLegFeasibility({ ...base, boardingMode: "flight" }).state).toBe(
      "tight",
    );
  });

  it("an explicit bufferMinutes still wins over boardingMode", () => {
    const res = checkLegFeasibility({
      fromEnd: t("2026-01-01T09:00"),
      toStart: t("2026-01-01T10:15"),
      travelMinutes: 60,
      boardingMode: "flight",
      bufferMinutes: 5,
    });
    expect(res.state).toBe("ok");
  });
});
