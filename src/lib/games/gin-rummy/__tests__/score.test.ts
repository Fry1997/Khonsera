import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "@/lib/games/gin-rummy/cards";
import { cardId } from "@/lib/games/gin-rummy/cards";
import { canKnock, canLayOff, isGin, layOff, scoreRound } from "@/lib/games/gin-rummy/score";

function c(label: string): Card {
  const suit = label.slice(-1) as Suit;
  const rs = label.slice(0, -1);
  const rank = (rs === "A" ? 1 : rs === "J" ? 11 : rs === "Q" ? 12 : rs === "K" ? 13 : Number(rs)) as Rank;
  return { rank, suit };
}
function hand(...labels: string[]): Card[] {
  return labels.map(c);
}

describe("canKnock / isGin", () => {
  it("knockable at deadwood ≤ 10", () => {
    // run J-Q-K S, set 4(SHD), run 6-7-8 H, deadwood 2C(2) → 2 ≤ 10
    const h = hand("JS", "QS", "KS", "4S", "4H", "4D", "6H", "7H", "8H", "2C");
    expect(canKnock(h)).toBe(true);
    expect(isGin(h)).toBe(false);
  });
  it("not knockable above 10", () => {
    const h = hand("AS", "3H", "5D", "7C", "9S", "JH", "KD", "2H", "4C", "6S");
    expect(canKnock(h)).toBe(false);
  });
  it("gin = fully melded", () => {
    const h = hand("4H", "5H", "6H", "7H", "9S", "9H", "9D", "JS", "QS", "KS");
    expect(isGin(h)).toBe(true);
    expect(canKnock(h)).toBe(true);
  });
});

describe("layOff", () => {
  it("opponent extends a knocker run and set", () => {
    const knockerMelds = [hand("5H", "6H", "7H"), hand("9S", "9H", "9D")];
    // opponent deadwood includes 8H (extends the run) and 9C (extends the set)
    const oppDead = hand("8H", "9C", "KD");
    const r = layOff(oppDead, knockerMelds);
    const laid = r.laidOff.map(cardId).sort();
    expect(laid).toContain("H8");
    expect(laid).toContain("C9");
    expect(r.remaining.map(cardId)).toEqual(["D13"]);
    expect(r.remainingValue).toBe(10);
  });

  it("cannot lay off when nothing fits", () => {
    const knockerMelds = [hand("5H", "6H", "7H")];
    const oppDead = hand("KD", "2C");
    const r = layOff(oppDead, knockerMelds);
    expect(r.laidOff).toHaveLength(0);
    expect(r.remainingValue).toBe(12);
  });

  it("canLayOff respects run continuity", () => {
    const run = hand("5H", "6H", "7H");
    expect(canLayOff(c("8H"), run)).toBe(true);
    expect(canLayOff(c("4H"), run)).toBe(true);
    expect(canLayOff(c("9H"), run)).toBe(false);
    expect(canLayOff(c("8S"), run)).toBe(false);
  });
});

describe("scoreRound", () => {
  it("plain knock: knocker scores the deadwood difference", () => {
    // knocker: deadwood 2 (2C lone). melds: JQK S, 4 set, 6-7-8 H.
    const knocker = hand("JS", "QS", "KS", "4S", "4H", "4D", "6H", "7H", "8H", "2C");
    // opponent: a run + lots of unmeldable high cards, no lay-off onto knocker.
    // melds: A-2-3 D (run). deadwood: KH(10) QC(10) 5S(5) 10S(10) = 35.
    const opponent = hand("AD", "2D", "3D", "KH", "QC", "5S", "10S", "9C", "7D", "8C");
    const out = scoreRound(knocker, opponent, false);
    expect(out.result).toBe("knock");
    expect(out.scorer).toBe("knocker");
    expect(out.knockerDeadwood).toBe(2);
    // opp deadwood: 9C,7D,8C cannot meld (mixed), nor lay off on knocker's melds.
    // KH(10)+QC(10)+5S(5)+10S(10)+9C(9)+7D(7)+8C(8) = 59; minus any melds.
    // 7D 8C 9C are mixed suits — no run. So opp melds only A-2-3 D.
    expect(out.points).toBe(out.opponentDeadwood - 2);
    expect(out.points).toBeGreaterThan(0);
  });

  it("gin: +25 bonus, no lay-offs", () => {
    const knocker = hand("4H", "5H", "6H", "7H", "9S", "9H", "9D", "JS", "QS", "KS");
    // opponent deadwood that COULD extend the run (8H) — but gin forbids lay-off.
    const opponent = hand("AD", "2D", "3D", "8H", "KC", "5S", "10D", "JC", "7S", "8D");
    const out = scoreRound(knocker, opponent, true);
    expect(out.result).toBe("gin");
    expect(out.scorer).toBe("knocker");
    expect(out.knockerDeadwood).toBe(0);
    expect(out.laidOff).toHaveLength(0);
    // opp melds A-2-3 D; deadwood = 8H+KC+5S+10D+JC+7S+8D
    //  = 8+10+5+10+10+7+8 = 58. points = 58 + 25.
    expect(out.points).toBe(out.opponentDeadwood + 25);
    expect(out.points).toBe(58 + 25);
  });

  it("undercut: opponent ≤ knocker → opponent scores diff + 25", () => {
    // knocker knocks with deadwood 10 (a lone KC).
    const knocker = hand("JS", "QS", "KS", "4S", "4H", "4D", "6H", "7H", "8H", "KC");
    expect(canKnock(knocker)).toBe(true);
    // opponent has LOWER deadwood: two melds + a lone AH(1) that can't extend
    // any of its own melds or the knocker's. melds: 2C-3C-4C, 9(SHD).
    const opponent = hand("2C", "3C", "4C", "9S", "9H", "9D", "5D", "6D", "7D", "AH");
    const out = scoreRound(knocker, opponent, false);
    expect(out.knockerDeadwood).toBe(10);
    expect(out.opponentDeadwood).toBe(1); // AH can't lay off knocker's melds
    expect(out.result).toBe("undercut");
    expect(out.scorer).toBe("opponent");
    // diff = 10 - 1 = 9; opponent scores 9 + 25 = 34.
    expect(out.points).toBe(9 + 25);
  });

  it("undercut on a tie (equal deadwood) still goes to opponent + 25", () => {
    // both deadwood 5; opponent's lone 5C can't lay off knocker's melds
    // (6-7-8 H is a different suit; nothing else accepts a 5).
    const knocker = hand("JS", "QS", "KS", "4S", "4H", "4D", "6H", "7H", "8H", "5D");
    const opponent = hand("2H", "3H", "4H", "9S", "9H", "9D", "10D", "JD", "QD", "5C");
    const out = scoreRound(knocker, opponent, false);
    expect(out.knockerDeadwood).toBe(5);
    expect(out.opponentDeadwood).toBe(5);
    expect(out.result).toBe("undercut");
    expect(out.points).toBe(0 + 25);
  });
});
