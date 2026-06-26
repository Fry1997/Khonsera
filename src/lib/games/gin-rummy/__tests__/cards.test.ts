import { describe, expect, it } from "vitest";
import {
  type Card,
  cardFromId,
  cardId,
  cardLabel,
  cardValue,
  cardsEqual,
  freshDeck,
} from "@/lib/games/gin-rummy/cards";

describe("card values", () => {
  it("Ace = 1", () => {
    expect(cardValue({ rank: 1, suit: "S" })).toBe(1);
  });
  it("face value 2..10", () => {
    expect(cardValue({ rank: 2, suit: "H" })).toBe(2);
    expect(cardValue({ rank: 7, suit: "D" })).toBe(7);
    expect(cardValue({ rank: 10, suit: "C" })).toBe(10);
  });
  it("J/Q/K = 10", () => {
    expect(cardValue({ rank: 11, suit: "S" })).toBe(10);
    expect(cardValue({ rank: 12, suit: "S" })).toBe(10);
    expect(cardValue({ rank: 13, suit: "S" })).toBe(10);
  });
});

describe("deck + ids", () => {
  it("fresh deck is 52 unique cards", () => {
    const deck = freshDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map(cardId)).size).toBe(52);
  });
  it("id round-trips and is UI-compatible (suit+rank)", () => {
    const c: Card = { rank: 13, suit: "D" };
    expect(cardId(c)).toBe("D13");
    expect(cardsEqual(cardFromId("D13"), c)).toBe(true);
  });
  it("labels read naturally", () => {
    expect(cardLabel({ rank: 1, suit: "S" })).toBe("AS");
    expect(cardLabel({ rank: 11, suit: "H" })).toBe("JH");
    expect(cardLabel({ rank: 10, suit: "C" })).toBe("10C");
  });
});
