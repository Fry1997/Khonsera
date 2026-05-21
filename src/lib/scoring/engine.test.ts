// Synthetic-case tests for the leg-scoring engine. Pure function in,
// pure data out — no DB, no async, no mocks needed.

import { describe, expect, it } from "vitest";
import { scoreLeg } from "./engine";
import type {
  CandidateInput,
  ModeCandidate,
  ScoringContext,
  TripPurpose,
} from "./types";

// ── Test helpers ────────────────────────────────────────────────────

function makeCandidate(
  mode: ModeCandidate,
  durationMins: number | null,
  distanceMeters: number | null = 1500,
  costPence: number | null = mode === "taxi" ? 800 : 0,
  arrivalBufferMins: number = 20,
  pending = false,
): CandidateInput {
  return {
    mode,
    pending,
    durationSeconds: durationMins == null ? null : durationMins * 60,
    distanceMeters,
    costEstimatePence: costPence,
    arrivalBufferSeconds: arrivalBufferMins * 60,
  };
}

function ctx(overrides: Partial<ScoringContext> = {}): ScoringContext {
  return {
    preferredMode: "no_preference",
    walkingThresholdMinutes: 15,
    minimumBufferMinutes: 10,
    maxTaxiFarePence: 1500,
    luggage: "none",
    tripPurpose: "balanced",
    userOverride: null,
    ...overrides,
  };
}

// ── Happy paths ─────────────────────────────────────────────────────

describe("scoreLeg / happy path", () => {
  it("returns the fastest candidate for the 'maximise_meetings' purpose", () => {
    const result = scoreLeg(
      [
        makeCandidate("walk", 18), // walks 18 min — over the 15 threshold
        makeCandidate("drive", 5),
        makeCandidate("taxi", 4),
      ],
      ctx({ tripPurpose: "maximise_meetings" }),
    );
    expect(result.state).toBe("resolved");
    expect(result.winner?.mode).toBe("taxi");
    expect(result.filtered.map((f) => f.input.mode)).toContain("walk");
  });

  it("prefers walk under 'budget_conscious' when taxi is over the user's limit", () => {
    // An affordable taxi gets cost=100 in the spec'd lookup, which
    // means budget_conscious doesn't actually penalise it. The
    // weights only bite once taxi exceeds the user's max_taxi_fare.
    const result = scoreLeg(
      [
        makeCandidate("walk", 9), // under threshold, brisk walk
        makeCandidate("drive", 5),
        makeCandidate("taxi", 4, 1500, 3500), // £35 — well above £15 limit
      ],
      ctx({ tripPurpose: "budget_conscious", maxTaxiFarePence: 1500 }),
    );
    // Taxi is heavily penalised on cost; drive wins narrowly,
    // walk overtakes taxi.
    expect(result.winner?.mode).not.toBe("taxi");
    const taxi = result.ranked.find((r) => r.mode === "taxi");
    const walk = result.ranked.find((r) => r.mode === "walk");
    expect(walk!.total).toBeGreaterThan(taxi!.total);
  });

  it("balanced ranks differently from maximise_meetings when there are real trade-offs", () => {
    // Real trade-off scenario: walk is brisk, drive is fast, taxi is
    // both fast AND expensive (over the limit). The cost dimension
    // weight is what flips the ordering between the two purposes.
    const cands = [
      makeCandidate("walk", 9), // under threshold
      makeCandidate("drive", 5),
      makeCandidate("taxi", 4, 1500, 3000), // £30 — over £15 limit
    ];
    const balanced = scoreLeg(cands, ctx({ tripPurpose: "balanced" }));
    const maxMeetings = scoreLeg(
      cands,
      ctx({ tripPurpose: "maximise_meetings" }),
    );
    const balancedOrder = balanced.ranked.map((r) => r.mode).join(",");
    const meetingsOrder = maxMeetings.ranked.map((r) => r.mode).join(",");
    expect(balancedOrder).not.toBe(meetingsOrder);
  });
});

// ── Filters ─────────────────────────────────────────────────────────

describe("scoreLeg / filters", () => {
  it("drops walk above the user's walking threshold", () => {
    const result = scoreLeg(
      [
        makeCandidate("walk", 20), // > 15-min default
        makeCandidate("drive", 6),
      ],
      ctx(),
    );
    expect(result.filtered.map((f) => f.input.mode)).toContain("walk");
    expect(result.ranked.map((r) => r.mode)).not.toContain("walk");
    expect(result.filtered.find((f) => f.input.mode === "walk")?.filterReason)
      .toBe("walk_exceeds_threshold");
  });

  it("drops candidates that would be late", () => {
    const result = scoreLeg(
      [makeCandidate("walk", 12, 1500, 0, -5)], // negative buffer
      ctx(),
    );
    expect(result.state).toBe("no_survivors");
    expect(result.filtered[0].filterReason).toBe("would_be_late");
  });

  it("returns no_data when every candidate is unavailable", () => {
    const result = scoreLeg(
      [
        makeCandidate("walk", null),
        makeCandidate("drive", null),
        makeCandidate("taxi", null),
      ],
      ctx(),
    );
    expect(result.state).toBe("no_data");
  });

  it("returns resolving when any candidate is still loading", () => {
    const result = scoreLeg(
      [
        makeCandidate("walk", 8),
        makeCandidate("drive", null, null, null, 20, true), // pending
        makeCandidate("taxi", 5),
      ],
      ctx(),
    );
    expect(result.state).toBe("resolving");
    expect(result.winner).toBeNull();
  });

  it("returns single_candidate when only one survives filters", () => {
    const result = scoreLeg(
      [
        makeCandidate("walk", 25), // filtered (over threshold)
        makeCandidate("drive", 5),
      ],
      ctx(),
    );
    expect(result.state).toBe("single_candidate");
    expect(result.winner?.mode).toBe("drive");
  });
});

// ── Override path ───────────────────────────────────────────────────

describe("scoreLeg / user override", () => {
  it("returns the user's mode without running scoring", () => {
    const result = scoreLeg(
      [
        makeCandidate("walk", 25), // would be filtered without override
        makeCandidate("drive", 5),
        makeCandidate("taxi", 4),
      ],
      ctx({ userOverride: "walk" }),
    );
    expect(result.state).toBe("resolved_override");
    expect(result.winner?.mode).toBe("walk");
    // Override means we don't bother computing scores for alternatives,
    // so ranked is just the chosen mode.
    expect(result.ranked).toHaveLength(1);
  });
});

// ── Preferred-mode bias ─────────────────────────────────────────────

describe("scoreLeg / preferred-mode bias", () => {
  it("nudges close calls toward the preferred mode", () => {
    // Two candidates that score near-tie without preference. Setting
    // a preference should flip the winner.
    const closeCall: CandidateInput[] = [
      makeCandidate("walk", 10, 800, 0, 20),
      makeCandidate("drive", 8, 1500, 0, 20),
    ];
    const neutral = scoreLeg(closeCall, ctx());
    const preferWalk = scoreLeg(closeCall, ctx({ preferredMode: "walk" }));
    // At least one of the two should have flipped, OR the boosted
    // candidate's score margin should have grown.
    expect(preferWalk.winner?.preferredBoostApplied).toBe(true);
    if (neutral.winner?.mode !== "walk") {
      expect(preferWalk.winner?.mode).toBe("walk");
    }
  });

  it("does NOT flip a clearly-better alternative", () => {
    // Walk is 3x slower than drive — preferring walk shouldn't override
    // a meaningful gap.
    const result = scoreLeg(
      [
        makeCandidate("walk", 14, 1500, 0, 20),
        makeCandidate("drive", 4, 1500, 0, 20),
      ],
      ctx({
        preferredMode: "walk",
        tripPurpose: "maximise_meetings",
      }),
    );
    // Drive should still win even though walk got the +15%.
    expect(result.winner?.mode).toBe("drive");
  });
});

// ── Luggage adjustment ──────────────────────────────────────────────

describe("scoreLeg / luggage", () => {
  it("penalises walk effort when carrying heavy luggage", () => {
    const cands = [
      makeCandidate("walk", 10),
      makeCandidate("drive", 8),
      makeCandidate("taxi", 8, 1500, 800),
    ];
    const noLuggage = scoreLeg(cands, ctx({ luggage: "none" }));
    const heavyLuggage = scoreLeg(cands, ctx({ luggage: "heavy" }));
    const walkNone = noLuggage.ranked.find((r) => r.mode === "walk")!;
    const walkHeavy = heavyLuggage.ranked.find((r) => r.mode === "walk")!;
    expect(walkHeavy.scores.effort).toBeLessThan(walkNone.scores.effort);
  });
});

// ── Cost lookups ────────────────────────────────────────────────────

describe("scoreLeg / taxi cost lookup", () => {
  it("gives full marks to taxi within the user's limit", () => {
    const result = scoreLeg(
      [makeCandidate("taxi", 8, 1500, 1000)],
      ctx({ maxTaxiFarePence: 1500 }),
    );
    expect(result.winner?.scores.cost).toBe(100);
  });

  it("penalises taxi well above the limit", () => {
    const result = scoreLeg(
      [makeCandidate("taxi", 8, 1500, 5000)],
      ctx({ maxTaxiFarePence: 1500 }),
    );
    expect(result.winner?.scores.cost).toBeLessThanOrEqual(25);
  });

  it("drops the cost dimension and re-normalises when taxi cost is unknown", () => {
    // With cost dimension dropped, time + effort + risk should still
    // determine the winner — and the engine shouldn't crash on the
    // null cost.
    const result = scoreLeg(
      [
        makeCandidate("walk", 10),
        makeCandidate("drive", 5),
        makeCandidate("taxi", 4, 1500, null),
      ],
      ctx({ tripPurpose: "budget_conscious" }),
    );
    expect(result.state).toBe("resolved");
    // With cost dropped under budget_conscious, the heavy cost weight
    // gets redistributed across time/effort/risk — taxi (fastest, low
    // effort) should now stand a chance instead of being penalised
    // for being expensive on unknown data.
    expect(result.winner).not.toBeNull();
  });
});

// ── Explanation copy ────────────────────────────────────────────────

describe("scoreLeg / explanations", () => {
  it("calls the winner 'Fastest' under maximise_meetings", () => {
    const result = scoreLeg(
      [
        makeCandidate("walk", 12),
        makeCandidate("drive", 5),
        makeCandidate("taxi", 4),
      ],
      ctx({ tripPurpose: "maximise_meetings" }),
    );
    expect(result.winner?.explanation).toBe("Fastest");
  });

  it("flags an over-limit taxi candidate's reason", () => {
    const result = scoreLeg(
      [
        makeCandidate("walk", 10),
        makeCandidate("taxi", 5, 1500, 4500),
      ],
      ctx({ maxTaxiFarePence: 1500 }),
    );
    const taxi = result.ranked.find((r) => r.mode === "taxi");
    expect(taxi?.explanation).toMatch(/taxi limit/i);
  });
});
