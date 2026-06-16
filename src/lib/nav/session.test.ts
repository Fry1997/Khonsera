import { describe, expect, it } from "vitest";
import { projectSession, type SessionSnapshot, type NavCommitment } from "./session";
import { buildRecoveryOptions, type RecoveryCandidate } from "@/lib/recovery/engine";

const NOW = "2026-06-25T13:00:00.000Z";

const commitment = (over: Partial<NavCommitment> = {}): NavCommitment => ({
  id: "meeting",
  name: "the 14:00 meeting",
  place: "Dancing Duck",
  neededByIso: "2026-06-25T14:00:00.000Z",
  bufferMin: 15,
  downstreamMin: 0,
  ...over,
});

const base = (over: Partial<SessionSnapshot> = {}): SessionSnapshot => ({
  nowIso: NOW,
  activeLegRemainingMin: 40,
  activeLegScheduledRemainingMin: 40,
  commitments: [commitment()],
  ...over,
});

describe("projectSession", () => {
  it("projects the ETA and stays silent on a healthy on-pace leg", () => {
    const v = projectSession(base());
    expect(v.etas[0].state).toBe("on_track");
    expect(v.etas[0].spareMin).toBe(20);
    expect(v.behindMin).toBe(0);
    expect(v.decision).toBeNull();
  });

  it("adds downstream scheduled time + live delay into the ETA", () => {
    const v = projectSession(
      base({
        activeLegRemainingMin: 20,
        activeLegScheduledRemainingMin: 20,
        downstreamDelayMin: 6,
        commitments: [commitment({ downstreamMin: 20 })], // 20 active + 20 downstream + 6 delay = 46
      }),
    );
    // arrive 13:46 → 14 min spare < 15 buffer → thinning
    expect(v.etas[0].spareMin).toBe(14);
    expect(v.etas[0].state).toBe("thinning");
  });

  it("raises a pace decision only once you're behind AND the day thins", () => {
    // 10 min behind, but still 30 spare → on_track → stay silent.
    const healthy = projectSession(base({ activeLegRemainingMin: 30, activeLegScheduledRemainingMin: 40 }));
    expect(healthy.behindMin).toBe(0); // remaining < scheduled = ahead, not behind
    expect(healthy.decision).toBeNull();

    // genuinely behind and it pushes the meeting tight
    const behind = projectSession(base({ activeLegRemainingMin: 52, activeLegScheduledRemainingMin: 40 }));
    expect(behind.behindMin).toBe(12);
    expect(behind.decision).not.toBeNull();
    expect(behind.decision!.severity).toBe("calm"); // no ways-out supplied → calm
  });

  it("a disruption with ways-out becomes an ACT decision", () => {
    const candidates: RecoveryCandidate[] = [
      { id: "taxi", label: "Taxi", mode: "taxi", departIso: "2026-06-25T13:02:00.000Z", arriveIso: "2026-06-25T13:58:00.000Z" },
    ];
    const recovery = buildRecoveryOptions(candidates, { name: "the 14:00 meeting", byIso: "2026-06-25T14:00:00.000Z" });
    const v = projectSession(
      base({
        activeLegRemainingMin: 75, // will miss
        activeLegScheduledRemainingMin: 40,
        disruption: { kind: "disruption", mode: "tube", line: "Victoria line", delayMin: 0, cancelled: true },
        recovery,
      }),
    );
    expect(v.decision!.severity).toBe("act");
    expect(v.decision!.headline).toBe("Victoria line is cancelled ahead.");
    expect(v.decision!.recommendation!.option.id).toBe("taxi");
  });

  it("respects dismissals", () => {
    const snap = base({ activeLegRemainingMin: 52, activeLegScheduledRemainingMin: 40 });
    const first = projectSession(snap);
    const again = projectSession({ ...snap, dismissedKeys: [first.decision!.key] });
    expect(again.decision).toBeNull();
  });
});
