import { describe, expect, it } from "vitest";
import { evaluateNavDecision, type NavTrigger } from "./decision-loop";
import { projectDay, type CommitmentInput } from "./event-eta";
import { buildRecoveryOptions, type RecoveryCandidate } from "@/lib/recovery/engine";

const NOW = "2026-06-25T13:00:00.000Z";

const commitment = (over: Partial<CommitmentInput> = {}): CommitmentInput => ({
  id: "meeting",
  name: "the 14:00 meeting",
  place: "Dancing Duck",
  neededByIso: "2026-06-25T14:00:00.000Z",
  bufferMin: 15,
  minutesFromNow: 40, // on track
  ...over,
});

const pace: NavTrigger = { kind: "pace", behindMin: 12 };

describe("evaluateNavDecision", () => {
  it("stays SILENT when the day is still on track", () => {
    const day = projectDay(NOW, [commitment()]); // 20 spare ≥ 15 buffer
    expect(evaluateNavDecision({ day, trigger: pace })).toBeNull();
  });

  it("raises a CALM notice (no options) when a connection thins", () => {
    const day = projectDay(NOW, [commitment({ minutesFromNow: 52 })]); // spare 8 < buffer
    const d = evaluateNavDecision({ day, trigger: pace });
    expect(d).not.toBeNull();
    expect(d!.severity).toBe("calm");
    expect(d!.consequence).toContain("cushion into the 14:00 meeting");
    expect(d!.recommendation).toBeUndefined();
  });

  it("raises an ACT decision with the ranked recommendation when you'll miss it", () => {
    const day = projectDay(NOW, [commitment({ minutesFromNow: 75 })]); // 15 late
    const candidates: RecoveryCandidate[] = [
      { id: "bus38", label: "the 38 bus", mode: "bus", departIso: "2026-06-25T13:05:00.000Z", arriveIso: "2026-06-25T14:06:00.000Z" },
      { id: "taxi", label: "Taxi", mode: "taxi", departIso: "2026-06-25T13:02:00.000Z", arriveIso: "2026-06-25T13:58:00.000Z", note: "~£24" },
    ];
    const recovery = buildRecoveryOptions(candidates, { name: "the 14:00 meeting", byIso: "2026-06-25T14:00:00.000Z" });
    const d = evaluateNavDecision({ day, trigger: { kind: "disruption", mode: "tube", line: "Victoria line", delayMin: 0, cancelled: true }, recovery });
    expect(d!.severity).toBe("act");
    expect(d!.headline).toBe("Victoria line is cancelled ahead.");
    expect(d!.consequence).toBe("You'd reach the 14:00 meeting 15 min late.");
    // earliest-arrival default → the taxi (13:58) ranks above the bus (14:06).
    expect(d!.recommendation!.option.id).toBe("taxi");
    expect(d!.recommendation!.tradeoff).toContain("Makes your the 14:00 meeting");
  });

  it("does not re-raise a dismissed decision", () => {
    const day = projectDay(NOW, [commitment({ minutesFromNow: 75 })]);
    const first = evaluateNavDecision({ day, trigger: pace });
    expect(first).not.toBeNull();
    const again = evaluateNavDecision({ day, trigger: pace, dismissedKeys: [first!.key] });
    expect(again).toBeNull();
  });

  it("names the earliest break across a multi-commitment day", () => {
    const day = projectDay(NOW, [
      commitment({ id: "train", name: "the 13:50 train", neededByIso: "2026-06-25T13:50:00.000Z", minutesFromNow: 60 }), // miss
      commitment({ id: "dinner", name: "dinner", neededByIso: "2026-06-25T19:00:00.000Z", minutesFromNow: 60 }), // fine
    ]);
    const d = evaluateNavDecision({ day, trigger: pace });
    expect(d!.pinchName).toBe("the 13:50 train");
    expect(d!.key).toBe("pace:train");
  });
});
