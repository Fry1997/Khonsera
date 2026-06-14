import { describe, it, expect } from "vitest";
import { buildRecoveryOptions, rankFor, type RecoveryCandidate } from "./engine";

const cand = (id: string, arriveIso: string, over: Partial<RecoveryCandidate> = {}): RecoveryCandidate => ({
  id,
  label: id,
  mode: "rail",
  departIso: "2026-07-01T10:50:00Z",
  arriveIso,
  ...over,
});

describe("recovery engine", () => {
  const commitment = { name: "your 2pm", byIso: "2026-07-01T13:00:00Z" };

  it("evaluates each candidate against the commitment, soonest-first (trade-off order)", () => {
    const opts = buildRecoveryOptions(
      [cand("late", "2026-07-01T13:20:00Z"), cand("early", "2026-07-01T12:40:00Z")],
      commitment,
    );
    expect(opts[0].id).toBe("early"); // soonest arrival leads (neutral order)
    expect(opts[0].makesIt).toBe(true);
    expect(opts[0].intoLateMin).toBe(-20);
    expect(opts[0].consequence).toContain("20 min to spare");
    expect(opts[1].makesIt).toBe(false);
    expect(opts[1].consequence).toContain("20 min late");
  });

  it("with no commitment just states arrival", () => {
    const opts = buildRecoveryOptions([cand("a", "2026-07-01T12:40:00Z")], null);
    expect(opts[0].makesIt).toBe(true);
    expect(opts[0].consequence).toMatch(/Arrives/);
  });

  it("rankFor(least-disruption) puts makes-it + fewest changes first", () => {
    const opts = buildRecoveryOptions(
      [
        cand("misses", "2026-07-01T13:20:00Z", { changes: 0 }),
        cand("makes-2changes", "2026-07-01T12:55:00Z", { changes: 2 }),
        cand("makes-0changes", "2026-07-01T12:58:00Z", { changes: 0 }),
      ],
      commitment,
    );
    const ranked = rankFor(opts, "least-disruption");
    expect(ranked[0].id).toBe("makes-0changes"); // makes it, no changes
    expect(ranked[ranked.length - 1].id).toBe("misses"); // doesn't make it → last
  });
});
