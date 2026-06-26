/* ════════════════════════════════════════════════════════════════════════
 * Gin Rummy · score — lay-offs, round scoring, knock validity.
 * ════════════════════════════════════════════════════════════════════════ */
import { type Card, cardId, cardValue } from "./cards";
import { type Meld, type MeldResult, isMeld, meldsAndDeadwood } from "./deadwood";

export const KNOCK_THRESHOLD = 10;
export const GIN_BONUS = 25;
export const UNDERCUT_BONUS = 25;

export interface KnockOutcome {
  /** "knock" | "gin" | "undercut" — how the round resolved. */
  result: "knock" | "gin" | "undercut";
  /** Points awarded this round (always non-negative). */
  points: number;
  /** Who scored the points: "knocker" | "opponent". */
  scorer: "knocker" | "opponent";
  knockerDeadwood: number;
  /** Opponent deadwood AFTER laying off (0 if gin). */
  opponentDeadwood: number;
  /** Cards the opponent laid off onto the knocker's melds. */
  laidOff: Card[];
}

/** True when the hand's optimal deadwood ≤ 10 (knock allowed). */
export function canKnock(hand: Card[]): boolean {
  return meldsAndDeadwood(hand).deadwoodValue <= KNOCK_THRESHOLD;
}

/** True when the hand is gin (all melded, deadwood 0). */
export function isGin(hand: Card[]): boolean {
  return meldsAndDeadwood(hand).deadwoodValue === 0;
}

/** Can this single card legally extend the given meld (set or run)? */
export function canLayOff(card: Card, meld: Meld): boolean {
  return isMeld([...meld, card]);
}

/**
 * Greedily lay off as many of the opponent's deadwood cards as possible onto
 * the knocker's melds, minimising remaining opponent deadwood.
 *
 * Returns the laid-off cards and the reduced opponent-deadwood arrangement.
 * We iterate to a fixed point because laying one card off (e.g. extending a
 * run) can open a slot for another.
 */
export function layOff(
  opponentDeadwood: Card[],
  knockerMelds: Meld[],
): { laidOff: Card[]; remaining: Card[]; remainingValue: number } {
  // Work on mutable copies of the melds.
  const melds = knockerMelds.map((m) => m.slice());
  let pool = opponentDeadwood.slice();
  const laidOff: Card[] = [];

  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < pool.length; i++) {
      const card = pool[i];
      for (const meld of melds) {
        if (canLayOff(card, meld)) {
          meld.push(card);
          laidOff.push(card);
          pool.splice(i, 1);
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }

  const remainingValue = pool.reduce((a, c) => a + cardValue(c), 0);
  return { laidOff, remaining: pool, remainingValue };
}

/**
 * Score a completed round.
 *
 * @param knockerHand  the knocker's 10-card hand (after discard).
 * @param opponentHand the opponent's 10-card hand.
 * @param gin          whether the knocker went gin (no lay-offs allowed).
 */
export function scoreRound(
  knockerHand: Card[],
  opponentHand: Card[],
  gin: boolean,
): KnockOutcome {
  const kResult: MeldResult = meldsAndDeadwood(knockerHand);
  const knockerDeadwood = kResult.deadwoodValue;

  const oResult = meldsAndDeadwood(opponentHand);

  if (gin) {
    // Gin: opponent cannot lay off. Knocker scores opp deadwood + 25.
    const oppDeadwood = oResult.deadwoodValue;
    return {
      result: "gin",
      points: oppDeadwood + GIN_BONUS,
      scorer: "knocker",
      knockerDeadwood: 0,
      opponentDeadwood: oppDeadwood,
      laidOff: [],
    };
  }

  // Non-gin knock: opponent lays off onto knocker's melds.
  const { laidOff, remainingValue } = layOff(oResult.deadwood, kResult.melds);
  const oppDeadwood = remainingValue;

  const diff = oppDeadwood - knockerDeadwood;

  if (diff > 0) {
    // Knocker has less deadwood — knocker scores the difference.
    return {
      result: "knock",
      points: diff,
      scorer: "knocker",
      knockerDeadwood,
      opponentDeadwood: oppDeadwood,
      laidOff,
    };
  }

  // Undercut (opponent ≤ knocker): opponent scores |diff| + 25.
  return {
    result: "undercut",
    points: -diff + UNDERCUT_BONUS,
    scorer: "opponent",
    knockerDeadwood,
    opponentDeadwood: oppDeadwood,
    laidOff,
  };
}

/** Stable id-sorted signature of a meld set (for tests/debug). */
export function meldSignature(melds: Meld[]): string {
  return melds
    .map((m) => m.map(cardId).sort().join(","))
    .sort()
    .join("|");
}
