import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "@/lib/games/gin-rummy/cards";
import { cardId } from "@/lib/games/gin-rummy/cards";
import {
  type GinState,
  type Move,
  type Player,
  applyMove,
  createGame,
  deserialize,
  legalMoves,
  serialize,
  startNextRound,
} from "@/lib/games/gin-rummy/engine";

function c(label: string): Card {
  const suit = label.slice(-1) as Suit;
  const rs = label.slice(0, -1);
  const rank = (rs === "A" ? 1 : rs === "J" ? 11 : rs === "Q" ? 12 : rs === "K" ? 13 : Number(rs)) as Rank;
  return { rank, suit };
}

/** apply, asserting success (throws on error) — keeps tests terse. */
function ok(state: GinState, p: Player, move: Move): GinState {
  const r = applyMove(state, p, move);
  if ("error" in r) throw new Error(`unexpected error: ${r.error}`);
  return r;
}

function err(state: GinState, p: Player, move: Move): string {
  const r = applyMove(state, p, move);
  if (!("error" in r)) throw new Error("expected an error but move succeeded");
  return r.error;
}

describe("deal", () => {
  it("deals 10 to each, 1 upcard, 31 stock, totalling 52", () => {
    const s = createGame({ seed: "abc" });
    expect(s.hands[0]).toHaveLength(10);
    expect(s.hands[1]).toHaveLength(10);
    expect(s.discard).toHaveLength(1);
    expect(s.stock).toHaveLength(31);
    const all = [...s.hands[0], ...s.hands[1], ...s.discard, ...s.stock];
    expect(all).toHaveLength(52);
    expect(new Set(all.map(cardId)).size).toBe(52);
  });

  it("non-dealer plays first; opening phase is the upcard offer", () => {
    const s = createGame({ seed: "abc" });
    expect(s.dealer).toBe(0);
    expect(s.turn).toBe(1); // non-dealer
    expect(s.phase).toBe("upcardNonDealer");
  });
});

describe("determinism", () => {
  it("same seed → identical deal", () => {
    const a = createGame({ seed: "seed-42" });
    const b = createGame({ seed: "seed-42" });
    expect(serialize(a)).toBe(serialize(b));
  });
  it("different seeds → different deal", () => {
    const a = createGame({ seed: "seed-1" });
    const b = createGame({ seed: "seed-2" });
    expect(serialize(a)).not.toBe(serialize(b));
  });
  it("numeric and string seeds are equivalent forms", () => {
    const a = createGame({ seed: 7 });
    const b = createGame({ seed: "7" });
    expect(serialize(a)).toBe(serialize(b));
  });
});

describe("JSON round-trip", () => {
  it("a mid-game state survives serialize/deserialize", () => {
    let s = createGame({ seed: "rt" });
    s = ok(s, 1, { type: "passUpcard" }); // non-dealer passes
    s = ok(s, 0, { type: "passUpcard" }); // dealer passes
    s = ok(s, 1, { type: "drawStock" });
    const json = serialize(s);
    const back = deserialize(json);
    expect(back).toEqual(s);
    expect(serialize(back)).toBe(json);
    // and it's still playable
    const moves = legalMoves(back, 1);
    expect(moves.some((m) => m.type === "discard")).toBe(true);
  });
});

describe("upcard offer", () => {
  it("non-dealer can take the upcard and go straight to discard", () => {
    let s = createGame({ seed: "up1" });
    const upcard = s.discard[s.discard.length - 1];
    s = ok(s, 1, { type: "drawDiscard" });
    expect(s.phase).toBe("discard");
    expect(s.turn).toBe(1);
    expect(s.hands[1]).toHaveLength(11);
    expect(s.hands[1].some((x) => x.rank === upcard.rank && x.suit === upcard.suit)).toBe(true);
    expect(s.discard).toHaveLength(0);
  });

  it("both pass → non-dealer draws normally", () => {
    let s = createGame({ seed: "up2" });
    s = ok(s, 1, { type: "passUpcard" });
    expect(s.phase).toBe("upcardDealer");
    expect(s.turn).toBe(0);
    s = ok(s, 0, { type: "passUpcard" });
    expect(s.phase).toBe("draw");
    expect(s.turn).toBe(1);
  });
});

describe("turn + move validation", () => {
  it("rejects acting out of turn", () => {
    const s = createGame({ seed: "v1" });
    expect(err(s, 0, { type: "passUpcard" })).toMatch(/not your turn/);
  });

  it("rejects drawing from stock during the upcard offer", () => {
    const s = createGame({ seed: "v2" });
    expect(err(s, 1, { type: "drawStock" })).toMatch(/cannot draw from stock/);
  });

  it("rejects discarding a card you do not hold", () => {
    let s = createGame({ seed: "v3" });
    s = ok(s, 1, { type: "passUpcard" });
    s = ok(s, 0, { type: "passUpcard" });
    s = ok(s, 1, { type: "drawStock" });
    // find a card definitely NOT in hand 1
    const held = new Set(s.hands[1].map(cardId));
    let phantom: Card | null = null;
    for (const suit of ["S", "H", "D", "C"] as Suit[]) {
      for (let r = 1; r <= 13; r++) {
        const cc = { rank: r as Rank, suit };
        if (!held.has(cardId(cc))) {
          phantom = cc;
          break;
        }
      }
      if (phantom) break;
    }
    expect(err(s, 1, { type: "discard", card: phantom! })).toMatch(/do not hold/);
  });

  it("rejects discarding before drawing", () => {
    let s = createGame({ seed: "v4" });
    s = ok(s, 1, { type: "passUpcard" });
    s = ok(s, 0, { type: "passUpcard" });
    // still in 'draw' phase for player 1; a discard is not a legal move
    const card = s.hands[1][0];
    expect(err(s, 1, { type: "discard", card })).toMatch(/not in discard phase/);
  });

  it("legalMoves is empty for the player not on turn", () => {
    const s = createGame({ seed: "v5" });
    expect(legalMoves(s, 0)).toHaveLength(0);
    expect(legalMoves(s, 1).length).toBeGreaterThan(0);
  });

  it("a normal draw+discard hands the turn to the opponent", () => {
    let s = createGame({ seed: "v6" });
    s = ok(s, 1, { type: "passUpcard" });
    s = ok(s, 0, { type: "passUpcard" });
    s = ok(s, 1, { type: "drawStock" });
    const discardCard = s.hands[1][0];
    s = ok(s, 1, { type: "discard", card: discardCard });
    expect(s.turn).toBe(0);
    expect(s.phase).toBe("draw");
    expect(s.hands[1]).toHaveLength(10);
    expect(s.discard[s.discard.length - 1]).toEqual(discardCard);
  });
});

describe("knock rejection", () => {
  it("rejects a knock when post-discard deadwood > 10", () => {
    // Build a hand with no melds so any discard still leaves > 10 deadwood.
    const s = createGame({ seed: "k1" });
    // Force a known un-knockable 11-card hand into player 1, in discard phase.
    const rigged: GinState = {
      ...s,
      phase: "discard",
      turn: 1,
      hands: [
        s.hands[0],
        // 11 high mixed cards, no meld
        ["KS", "QH", "JD", "10C", "9S", "8H", "7D", "6C", "5S", "4H", "3D"].map(c),
      ],
    };
    const discardCard = c("KS");
    const e = applyMove(rigged, 1, { type: "knock", card: discardCard });
    expect("error" in e && e.error).toMatch(/deadwood exceeds 10/);
  });
});

describe("a full scored round — knock with a point difference", () => {
  it("knocker wins the deadwood difference and the round ends", () => {
    const base = createGame({ seed: "round1" });
    // Rig a deterministic discard-phase position for player 1 (the knocker):
    // 11 cards = JQK S + 4(SHD) + 6-7-8 H + lone 2C + lone AC → discard 2C,
    // leaving deadwood AC(1) ≤ 10 → knock.
    const knockerHand = ["JS", "QS", "KS", "4S", "4H", "4D", "6H", "7H", "8H", "AC", "2C"].map(c);
    // opponent: one run A-2-3 D + high junk that cannot lay off → big deadwood.
    const oppHand = ["AD", "2D", "3D", "KH", "QC", "10S", "9C", "7S", "5C", "8C"].map(c);
    const rigged: GinState = {
      ...base,
      phase: "discard",
      turn: 1,
      hands: [oppHand, knockerHand],
    };
    const after = ok(rigged, 1, { type: "knock", card: c("2C") });
    expect(after.phase === "roundOver" || after.phase === "gameOver").toBe(true);
    expect(after.lastRound).not.toBeNull();
    expect(after.lastRound!.kind).toBe("knock");
    expect(after.lastRound!.knocker).toBe(1);
    // knocker (player 1) scored the difference.
    expect(after.scores[1]).toBeGreaterThan(0);
    expect(after.scores[0]).toBe(0);
    expect(after.scores[1]).toBe(after.lastRound!.points);
  });
});

describe("a full scored round — gin", () => {
  it("gin awards opponent deadwood + 25", () => {
    const base = createGame({ seed: "round-gin" });
    // knocker 11 cards, discard a junk card to reach gin (deadwood 0).
    const knockerHand = ["4H", "5H", "6H", "7H", "9S", "9H", "9D", "JS", "QS", "KS", "2C"].map(c);
    const oppHand = ["AD", "2D", "3D", "KC", "5S", "10D", "JC", "7S", "8D", "QH"].map(c);
    const rigged: GinState = {
      ...base,
      phase: "discard",
      turn: 1,
      hands: [oppHand, knockerHand],
    };
    const after = ok(rigged, 1, { type: "knock", card: c("2C") });
    expect(after.lastRound!.kind).toBe("gin");
    expect(after.lastRound!.knockerDeadwood).toBe(0);
    expect(after.scores[1]).toBe(after.lastRound!.opponentDeadwood + 25);
  });
});

describe("a full scored round — undercut", () => {
  it("opponent with ≤ knocker deadwood scores diff + 25", () => {
    const base = createGame({ seed: "round-uc" });
    // knocker knocks with deadwood 10 (lone KC) after discarding 2C.
    const knockerHand = ["JS", "QS", "KS", "4S", "4H", "4D", "6H", "7H", "8H", "KC", "2C"].map(c);
    // opponent deadwood 1: lone AH that extends NEITHER its own melds (the
    // diamond/spade runs are a different suit) NOR the knocker's melds.
    const oppHand = ["2D", "3D", "4D", "9S", "9H", "9D", "5S", "6S", "7S", "AH"].map(c);
    const rigged: GinState = {
      ...base,
      phase: "discard",
      turn: 1,
      hands: [oppHand, knockerHand],
    };
    const after = ok(rigged, 1, { type: "knock", card: c("2C") });
    expect(after.lastRound!.kind).toBe("undercut");
    // opponent is player 0; they score (10-1)+25 = 34.
    expect(after.scores[0]).toBe(9 + 25);
    expect(after.scores[1]).toBe(0);
  });
});

describe("game target + next round", () => {
  it("reaching the target ends the game with a winner", () => {
    const base = createGame({ seed: "g1", target: 20 });
    const knockerHand = ["4H", "5H", "6H", "7H", "9S", "9H", "9D", "JS", "QS", "KS", "2C"].map(c);
    const oppHand = ["AD", "2D", "3D", "KC", "5S", "10D", "JC", "7S", "8D", "QH"].map(c);
    const rigged: GinState = { ...base, phase: "discard", turn: 1, hands: [oppHand, knockerHand] };
    const after = ok(rigged, 1, { type: "knock", card: c("2C") }); // big gin score
    expect(after.scores[1]).toBeGreaterThanOrEqual(20);
    expect(after.phase).toBe("gameOver");
    expect(after.winner).toBe(1);
    // no further moves accepted
    expect(err(after, 1, { type: "drawStock" })).toMatch(/game is over/);
  });

  it("startNextRound alternates the dealer and re-deals fresh", () => {
    const base = createGame({ seed: "g2", target: 1000 });
    const knockerHand = ["JS", "QS", "KS", "4S", "4H", "4D", "6H", "7H", "8H", "AC", "2C"].map(c);
    const oppHand = ["AD", "2D", "3D", "KH", "QC", "10S", "9C", "7S", "5C", "8C"].map(c);
    const rigged: GinState = { ...base, phase: "discard", turn: 1, hands: [oppHand, knockerHand] };
    const ended = ok(rigged, 1, { type: "knock", card: c("2C") });
    expect(ended.phase).toBe("roundOver");
    const next = startNextRound(ended);
    if ("error" in next) throw new Error(next.error);
    expect(next.round).toBe(1);
    expect(next.dealer).toBe(1); // alternated from 0
    expect(next.turn).toBe(0); // non-dealer
    expect(next.phase).toBe("upcardNonDealer");
    expect(next.hands[0]).toHaveLength(10);
    expect(next.hands[1]).toHaveLength(10);
    expect(next.stock).toHaveLength(31);
    // scores carried over
    expect(next.scores).toEqual(ended.scores);
    expect(next.lastRound).toBeNull();
  });
});

describe("stock exhaustion → wash", () => {
  it("redeals as a wash when the stock runs to 2 with no knock", () => {
    const base = createGame({ seed: "wash1" });
    // Put the state in discard phase with a near-empty stock and a non-knockable
    // hand so the discard triggers the wash.
    const hand1 = ["KS", "QH", "JD", "10C", "9S", "8H", "7D", "6C", "5S", "4H", "3D"].map(c);
    const rigged: GinState = {
      ...base,
      phase: "discard",
      turn: 1,
      stock: base.stock.slice(0, 2), // only 2 left → discard triggers a wash
      hands: [base.hands[0], hand1],
    };
    const after = ok(rigged, 1, { type: "discard", card: c("KS") });
    expect(after.phase).toBe("roundOver");
    expect(after.lastRound!.kind).toBe("wash");
    expect(after.scores).toEqual([0, 0]);
  });
});
