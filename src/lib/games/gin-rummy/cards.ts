/* ════════════════════════════════════════════════════════════════════════
 * Gin Rummy · cards — the card vocabulary, shared with the UI.
 *
 * The `Card` type is COMPATIBLE with the playing-card asset module
 * (`src/components/solitaire/playing-card.tsx`): same `Suit` ('S'|'H'|'D'|'C')
 * and `Rank` (1..13, 1=Ace). A `Card` is `{ rank, suit }`; map it straight to
 * `<PlayingCard rank suit />`. A stable string `id` (e.g. "S1") is derived via
 * `cardId` for keys/serialisation — identical to `DeckCard.id`.
 * ════════════════════════════════════════════════════════════════════════ */
import type { Rank, Suit } from "@/components/solitaire/playing-card";

export type { Rank, Suit };

/** A single playing card. JSON-able. Map directly onto <PlayingCard>. */
export interface Card {
  rank: Rank;
  suit: Suit;
}

export const SUITS: readonly Suit[] = ["S", "H", "D", "C"] as const;
export const RANKS: readonly Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] as const;

/** Stable id for a card — matches DeckCard.id in playing-card.tsx (suit+rank). */
export function cardId(c: Card): string {
  return c.suit + c.rank;
}

/** Parse an id like "S1" / "H13" back into a Card. */
export function cardFromId(id: string): Card {
  const suit = id[0] as Suit;
  const rank = Number(id.slice(1)) as Rank;
  return { rank, suit };
}

export function cardsEqual(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}

/**
 * Deadwood point value. Ace = 1, 2..10 = face value, J/Q/K = 10.
 * (Aces are low; there is no wrap-around, so the value mirrors the rank
 * capped at 10.)
 */
export function cardValue(c: Card): number {
  return c.rank > 10 ? 10 : c.rank;
}

/** Fresh, ordered 52-card deck (suit-major, ace..king). */
export function freshDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) deck.push({ rank, suit });
  }
  return deck;
}

/** Human label for logging/tests, e.g. "AS", "10H", "KD". */
export function cardLabel(c: Card): string {
  const r =
    c.rank === 1 ? "A" : c.rank === 11 ? "J" : c.rank === 12 ? "Q" : c.rank === 13 ? "K" : String(c.rank);
  return r + c.suit;
}
