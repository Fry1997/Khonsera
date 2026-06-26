import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "@/lib/games/gin-rummy/cards";
import { cardId } from "@/lib/games/gin-rummy/cards";
import { isMeld, meldsAndDeadwood } from "@/lib/games/gin-rummy/deadwood";
import { meldSignature } from "@/lib/games/gin-rummy/score";

/** Build a card from a short label like "AS", "10H", "KD", "7C". */
function c(label: string): Card {
  const suit = label.slice(-1) as Suit;
  const rs = label.slice(0, -1);
  const rank = (rs === "A" ? 1 : rs === "J" ? 11 : rs === "Q" ? 12 : rs === "K" ? 13 : Number(rs)) as Rank;
  return { rank, suit };
}
function hand(...labels: string[]): Card[] {
  return labels.map(c);
}

describe("isMeld", () => {
  it("recognises a 3-set", () => {
    expect(isMeld(hand("7S", "7H", "7D"))).toBe(true);
  });
  it("recognises a 4-set", () => {
    expect(isMeld(hand("7S", "7H", "7D", "7C"))).toBe(true);
  });
  it("rejects a 2-set", () => {
    expect(isMeld(hand("7S", "7H"))).toBe(false);
  });
  it("recognises a run regardless of order", () => {
    expect(isMeld(hand("6H", "4H", "5H"))).toBe(true);
  });
  it("rejects a mixed-suit 'run'", () => {
    expect(isMeld(hand("4H", "5S", "6H"))).toBe(false);
  });
  it("rejects a wrap-around Q-K-A", () => {
    expect(isMeld(hand("QS", "KS", "AS"))).toBe(false);
  });
  it("accepts low-ace A-2-3", () => {
    expect(isMeld(hand("AS", "2S", "3S"))).toBe(true);
  });
});

describe("meldsAndDeadwood — basic", () => {
  it("empty hand has 0 deadwood", () => {
    const r = meldsAndDeadwood([]);
    expect(r.deadwoodValue).toBe(0);
    expect(r.melds).toHaveLength(0);
  });

  it("all-melded gin hand: deadwood 0", () => {
    // Two runs + one set + a pair... build a true gin 10-card hand:
    // run 4-5-6-7 H, set 9 (S,H,D), run J-Q-K S
    const h = hand("4H", "5H", "6H", "7H", "9S", "9H", "9D", "JS", "QS", "KS");
    const r = meldsAndDeadwood(h);
    expect(r.deadwoodValue).toBe(0);
    expect(r.deadwood).toHaveLength(0);
  });

  it("counts deadwood of a no-meld hand", () => {
    // Ace(1)+3(3)+5(5)+7(7) of mixed suits, no possible meld → 1+3+5+7=16
    const h = hand("AS", "3H", "5D", "7C");
    const r = meldsAndDeadwood(h);
    expect(r.deadwoodValue).toBe(16);
    expect(r.melds).toHaveLength(0);
  });
});

describe("meldsAndDeadwood — the two-ways card (overlap)", () => {
  it("a card usable in either a set or a run goes where it minimises deadwood", () => {
    // 7S can complete EITHER the set {7S,7H,7D} OR the run {7S,8S,9S}.
    // Hand also has loose high cards. Whichever way 7S goes, the OTHER group
    // loses a card. Here both groups are otherwise complete-able:
    //   set:  7H 7D (+7S)         run: 8S 9S (+7S)
    // We give the run a 4th extension (6S,10S) so taking 7S into the run lets
    // the run be 6-7-8-9-10 (5 cards) while the set falls to a pair → choose run.
    const h = hand("7S", "7H", "7D", "6S", "8S", "9S", "10S", "KC", "QD", "2H");
    const r = meldsAndDeadwood(h);
    // Optimal: run 6-7-8-9-10 S (uses 7S) + ... 7H,7D can't form a set alone.
    // Deadwood = 7H(7)+7D(7)+KC(10)+QD(10)+2H(2) = 36.
    // Alternative (7S in set): set 7S7H7D + run 8-9-10 S → deadwood
    //   6S(6)+KC+QD+2H = 28. So actually the SET arrangement is better!
    expect(r.deadwoodValue).toBe(28);
    // 7S must be in the set, leaving run 8-9-10.
    const setMeld = r.melds.find((m) => m.length === 3 && m.every((x) => x.rank === 7));
    expect(setMeld).toBeDefined();
  });

  it("classic overlap: shares optimally between set and run", () => {
    // 8H can go in set {8H,8S,8D} or run {7H,8H,9H}. Both fully present.
    // Only one can claim 8H. Run 7-8-9 H removes 7+8+9=24; set removes 8*3=24
    // (8H+8S+8D = value 24). Tie on removed value — but the LEFTOVERS differ:
    //   take 8H into run → leftover 8S,8D (pair, deadwood 16)
    //   take 8H into set → leftover 7H,9H (deadwood 16)
    // Equal deadwood; engine must just pick a valid 24-removal. Add a 10H so the
    // run could extend: 7-8-9-10 H removes 34 > set's 24 → run wins.
    const h = hand("8H", "8S", "8D", "7H", "9H", "10H", "2C", "3D", "4S", "5C");
    const r = meldsAndDeadwood(h);
    // run 7-8-9-10 H removes 34; 8S,8D left as deadwood (16).
    // plus 2C+3D+4S+5C are no meld (mixed suits) = 14. total deadwood 30.
    expect(r.deadwoodValue).toBe(8 + 8 + 2 + 3 + 4 + 5); // 8S+8D+2+3+4+5 = 30
    const runH = r.melds.find((m) => m.length === 4 && m.every((x) => x.suit === "H"));
    expect(runH).toBeDefined();
  });
});

describe("meldsAndDeadwood — tricky minimisation", () => {
  it("prefers the global minimum over a greedy local choice", () => {
    // A greedy 'take the biggest meld first' could grab the wrong overlapping
    // group. Construct: two overlapping runs sharing a pivot.
    // 5H,6H,7H,8H is a run(4). 8H,8S,8D a set. 8H is the pivot.
    // Best: run 5-6-7-8 H (removes 26) + nothing else for the 8s pair.
    // vs set 8s (removes 24) + run 5-6-7 H (removes 18) = 42 removed!  ← better
    const h = hand("5H", "6H", "7H", "8H", "8S", "8D", "AC", "KD", "QS", "JH");
    const r = meldsAndDeadwood(h);
    // Optimal: set 8H8S8D (24) + run 5-6-7 H (18) = 42 removed.
    // leftover AC(1)+KD(10)+QS(10)+JH(10) = 31 deadwood.
    expect(r.deadwoodValue).toBe(1 + 10 + 10 + 10);
    expect(r.melds).toHaveLength(2);
  });

  it("result is deterministic across calls (stable tie-break)", () => {
    const h = hand("8H", "8S", "8D", "7H", "9H", "10H", "2C", "3D", "4S", "5C");
    const a = meldSignature(meldsAndDeadwood(h).melds);
    const b = meldSignature(meldsAndDeadwood([...h].reverse()).melds);
    expect(a).toBe(b);
  });

  it("knockable 11-card hand (post-draw) finds deadwood ≤ 10", () => {
    // 11 cards: run J-Q-K S, set 4 (S,H,D), run 6-7-8 H, plus a lone 2C.
    const h = hand("JS", "QS", "KS", "4S", "4H", "4D", "6H", "7H", "8H", "2C", "AC");
    const r = meldsAndDeadwood(h);
    // Three melds use 9 cards; 2C(2)+AC(1) deadwood = 3.
    expect(r.deadwoodValue).toBe(3);
  });
});

describe("each card in at most one meld", () => {
  it("never double-counts a shared card", () => {
    const h = hand("8H", "8S", "8D", "7H", "9H", "10H", "2C", "3D", "4S", "5C");
    const r = meldsAndDeadwood(h);
    const used = r.melds.flat().map(cardId);
    expect(new Set(used).size).toBe(used.length);
    // used + deadwood partition the whole hand exactly
    const all = [...used, ...r.deadwood.map(cardId)].sort();
    expect(all.length).toBe(10);
    expect(new Set(all).size).toBe(10);
  });
});
