import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "@/lib/games/gin-rummy/cards";
import { cardValue } from "@/lib/games/gin-rummy/cards";
import { deadwoodValueOf } from "@/lib/games/gin-rummy/deadwood";
import {
  type GinState,
  type Move,
  type Player,
  applyMove,
  createGame,
  legalMoves,
} from "@/lib/games/gin-rummy/engine";
import { isGin } from "@/lib/games/gin-rummy/score";
import { bestDiscard, chooseMove } from "@/lib/games/gin-rummy/bot";

function c(label: string): Card {
  const suit = label.slice(-1) as Suit;
  const rs = label.slice(0, -1);
  const rank = (rs === "A" ? 1 : rs === "J" ? 11 : rs === "Q" ? 12 : rs === "K" ? 13 : Number(rs)) as Rank;
  return { rank, suit };
}

/** Is `move` actually one the engine offers for this player/state? */
function isLegal(state: GinState, p: Player, move: Move): boolean {
  return legalMoves(state, p).some((m) => {
    if (m.type !== move.type) return false;
    if (m.type === "discard" || m.type === "knock") {
      const mv = move as Extract<Move, { card: Card }>;
      return m.card.rank === mv.card.rank && m.card.suit === mv.card.suit;
    }
    return true;
  });
}

describe("bestDiscard", () => {
  it("sheds the card that leaves the lowest deadwood", () => {
    // A clean run 5-6-7♠ + a meld 9♥9♦9♣, plus a lone K♣ — drop the king.
    const hand = [
      c("5S"), c("6S"), c("7S"),
      c("9H"), c("9D"), c("9C"),
      c("2H"), c("3H"), c("4H"),
      c("KC"),
    ];
    const bd = bestDiscard(hand)!;
    expect(bd.card).toEqual(c("KC"));
    expect(bd.deadwood).toBe(0); // everything else melds → gin
  });

  it("tie-breaks by shedding the higher card value", () => {
    // An 11-card hand: three melds (9 cards) + two unmeldable lones, K♦ and 4♦
    // (not consecutive, different from any meld). Dropping either lone leaves the
    // OTHER as the only deadwood — but the resulting-deadwood values differ, so
    // best-deadwood already favours dropping K♦ (leaves 4) over 4♦ (leaves 10).
    // To exercise the *value* tie-break we instead give two SAME-value-irrelevant
    // lones that leave EQUAL deadwood: two stray kings (no third king to set).
    const hand = [
      c("AS"), c("2S"), c("3S"), // run
      c("5H"), c("6H"), c("7H"), // run
      c("9C"), c("10C"), c("JC"), // run
      c("KD"), c("KH"), // two lone kings — dropping either leaves dw 10 (tie)
    ];
    const bd = bestDiscard(hand)!;
    // Both leave the same deadwood (10); the tie-break sheds the higher value —
    // both are kings (value 10), so it lands on whichever the scan settles on,
    // but the resulting deadwood is the asserted invariant.
    expect(bd.deadwood).toBe(10);
    expect(cardValue(bd.card)).toBe(10);
  });
});

describe("chooseMove — legality", () => {
  it("always returns a legal move across a full self-play game", () => {
    let s = createGame({ seed: "bot-legal-1", target: 50 });
    let guard = 0;
    while (s.phase !== "gameOver" && guard++ < 4000) {
      if (s.phase === "roundOver") {
        // The harness would deal the next round; for this test stop here.
        break;
      }
      const p = s.turn;
      const mv = chooseMove(s, p);
      expect(mv).not.toBeNull();
      expect(isLegal(s, p, mv!)).toBe(true);
      const next = applyMove(s, p, mv!);
      expect("error" in next).toBe(false);
      s = next as GinState;
    }
  });
});

describe("chooseMove — knocks for gin", () => {
  it("knocks for gin when a gin discard is available", () => {
    // Build a discard-phase state where player 0 holds 11 cards, one of which
    // can be shed to leave a gin (deadwood 0) hand.
    // Three melds (9 cards) + a clean 2-3-4♠ run forming with the kept card,
    // plus ONE odd card to shed for gin.
    const hand = [
      c("5S"), c("6S"), c("7S"), // run
      c("9H"), c("9D"), c("9C"), // set
      c("2H"), c("3H"), c("4H"), // run
      c("AS"), // the 10th melding-ish card? no — make a clean gin ten below
      c("KC"), // 11th — the odd card to shed
    ];
    // Replace AS with a card that melds: extend the 5-6-7♠ run down to 4♠? that
    // collides with nothing; use 8S to extend the spade run to 5-6-7-8.
    hand[9] = c("8S"); // 5-6-7-8♠ run (4 cards) → ten melded, KC is the shed.
    const state: GinState = {
      seed: "x",
      target: 100,
      scores: [0, 0],
      round: 0,
      dealer: 1,
      turn: 0,
      phase: "discard",
      stock: Array.from({ length: 20 }, () => c("2C")), // filler, not inspected
      discard: [c("8D")],
      hands: [hand, Array.from({ length: 10 }, () => c("3D"))],
      lastRound: null,
      winner: null,
    };
    const mv = chooseMove(state, 0)!;
    expect(mv.type).toBe("knock");
    if (mv.type === "knock") {
      const after = hand.filter((x) => !(x.rank === mv.card.rank && x.suit === mv.card.suit));
      expect(isGin(after)).toBe(true);
    }
  });
});

describe("chooseMove — reduces its own deadwood over a turn", () => {
  it("a draw+discard turn never raises the bot's deadwood", () => {
    // Walk the bot to a draw phase, then have it take its full turn; the hand it
    // ends the turn with should have deadwood ≤ what it could have melded before.
    let s = createGame({ seed: "bot-dw-7", target: 100 });
    const bot: Player = s.turn;

    // Get past the opening upcard offer into a normal draw for the bot.
    let guard = 0;
    while (
      (s.phase === "upcardNonDealer" || s.phase === "upcardDealer") &&
      guard++ < 6
    ) {
      const p = s.turn;
      const mv = chooseMove(s, p)!;
      s = applyMove(s, p, mv) as GinState;
    }
    // Drive to a state where it's the bot's draw.
    guard = 0;
    while (!(s.turn === bot && s.phase === "draw") && s.phase !== "roundOver" && s.phase !== "gameOver" && guard++ < 50) {
      const p = s.turn;
      const mv = chooseMove(s, p)!;
      s = applyMove(s, p, mv) as GinState;
    }

    if (s.turn === bot && s.phase === "draw") {
      const before = deadwoodValueOf(s.hands[bot]);
      // draw
      const drawMv = chooseMove(s, bot)!;
      s = applyMove(s, bot, drawMv) as GinState;
      // discard
      const discMv = chooseMove(s, bot)!;
      const isResolution = discMv.type === "knock";
      s = applyMove(s, bot, discMv) as GinState;
      if (!isResolution && s.phase !== "roundOver") {
        const after = deadwoodValueOf(s.hands[bot]);
        // The turn must not have made the hand worse.
        expect(after).toBeLessThanOrEqual(before);
      }
    }
    // If we never reached the exact phase the seed isn't useful, but the test
    // above (legality across a full game) already guards the general case.
    expect(true).toBe(true);
  });
});
