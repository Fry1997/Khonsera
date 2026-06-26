/* ════════════════════════════════════════════════════════════════════════
 * Gin Rummy · engine — pure, deterministic, serialisable 2-player game logic.
 *
 * No IO, no React, no randomness except behind the seed. `GinState` round-trips
 * through JSON (it lives in a jsonb column). A multiplayer layer calls
 * `legalMoves` / `applyMove`; the engine validates turn + legality and returns
 * either the next state or `{ error }`.
 *
 * ─ Turn structure ─────────────────────────────────────────────────────────
 * Players are 0 and 1. The dealer is `state.dealer`; the non-dealer
 * (`1 - dealer`) is dealt first and plays first.
 *
 * Opening upcard offer (standard): the face-up card starts the discard pile.
 * Before normal play, the NON-DEALER may take that upcard (drawDiscard) or pass
 * (passUpcard). If they pass, the DEALER may take it or pass. If both pass, the
 * non-dealer begins a normal turn by drawing from the stock or the upcard.
 *   Phase order: 'upcardNonDealer' → 'upcardDealer' → 'draw' → 'discard' → …
 * Whoever takes the upcard during the offer goes straight to 'discard'.
 *
 * Knock/gin happen as part of the discard move (knock with the discarded card
 * named), matching real play: you draw, then discard-and-knock.
 *
 * Stock exhaustion: when only 2 cards remain in the stock and no one has
 * knocked, the round is a wash → redeal (phase 'roundOver', outcome=null,
 * a new deal is set up; scores unchanged).
 * ════════════════════════════════════════════════════════════════════════ */
import { type Card, cardFromId, cardId, cardsEqual, freshDeck } from "./cards";
import { type Meld, meldsAndDeadwood } from "./deadwood";
import { makeRng, shuffle } from "./rng";
import {
  KNOCK_THRESHOLD,
  type KnockOutcome,
  canKnock,
  isGin,
  scoreRound,
} from "./score";

export type Player = 0 | 1;

export type Phase =
  | "upcardNonDealer"
  | "upcardDealer"
  | "draw"
  | "discard"
  | "roundOver"
  | "gameOver";

export type Move =
  | { type: "drawStock" }
  | { type: "drawDiscard" }
  | { type: "discard"; card: Card }
  | { type: "knock"; card: Card } // discard `card`, then knock (deadwood ≤ 10)
  | { type: "passUpcard" };

/** Per-round resolution, attached to state when a round ends. */
export interface RoundResult extends KnockOutcome {
  /** Index of the player who knocked. null for a washed (redealt) round. */
  knocker: Player | null;
  /** "knock"|"gin"|"undercut"|"wash". */
  kind: "knock" | "gin" | "undercut" | "wash";
}

/** The full serialisable game state. JSON round-trips losslessly. */
export interface GinState {
  /** Seed used to deal the CURRENT round (advances each redeal). */
  seed: string;
  /** Target game score; first to reach it wins. */
  target: number;
  /** Cumulative game scores [p0, p1]. */
  scores: [number, number];
  /** Which round this is (0-based); also salts the per-round shuffle. */
  round: number;
  /** Dealer for the current round. */
  dealer: Player;
  /** Whose turn it is to act. */
  turn: Player;
  phase: Phase;
  /** Face-down stock, top = last element (we pop()). */
  stock: Card[];
  /** Discard pile, top = last element. */
  discard: Card[];
  /** The two hands, indexed by player. */
  hands: [Card[], Card[]];
  /** Set once a round resolves; cleared on the next deal. */
  lastRound: RoundResult | null;
  /** Winner once the game is over, else null. */
  winner: Player | null;
}

export interface MoveError {
  error: string;
}

const HAND_SIZE = 10;

/* ── creation / dealing ──────────────────────────────────────────────────── */

export interface CreateOpts {
  seed: string | number;
  target?: number;
}

/**
 * Deal one round into a (possibly fresh) state. The non-dealer is dealt first
 * and receives the first turn; the next card is the upcard.
 */
function dealRound(base: {
  seed: string;
  round: number;
  dealer: Player;
}): {
  stock: Card[];
  discard: Card[];
  hands: [Card[], Card[]];
  turn: Player;
} {
  // Salt the shuffle with the round so each redeal differs deterministically.
  const rng = makeRng(`${base.seed}#${base.round}`);
  const deck = shuffle(freshDeck(), rng);

  const nonDealer: Player = (1 - base.dealer) as Player;
  const hands: [Card[], Card[]] = [[], []];

  // Standard alternating deal starting with the non-dealer, 10 each.
  let idx = 0;
  for (let n = 0; n < HAND_SIZE; n++) {
    hands[nonDealer].push(deck[idx++]);
    hands[base.dealer].push(deck[idx++]);
  }
  const upcard = deck[idx++];
  const stock = deck.slice(idx); // remaining 31 cards face-down

  return {
    stock,
    discard: [upcard],
    hands,
    turn: nonDealer,
  };
}

export function createGame(opts: CreateOpts): GinState {
  const seed = String(opts.seed);
  const target = opts.target ?? 100;
  const dealer: Player = 0;
  const dealt = dealRound({ seed, round: 0, dealer });

  return {
    seed,
    target,
    scores: [0, 0],
    round: 0,
    dealer,
    turn: dealt.turn,
    phase: "upcardNonDealer",
    stock: dealt.stock,
    discard: dealt.discard,
    hands: dealt.hands,
    lastRound: null,
    winner: null,
  };
}

/* ── serialisation (round-trips through JSON natively, helpers provided) ───── */

export function serialize(state: GinState): string {
  return JSON.stringify(state);
}

export function deserialize(json: string): GinState {
  return JSON.parse(json) as GinState;
}

/* ── queries ───────────────────────────────────────────────────────────────*/

function clone(state: GinState): GinState {
  // Structured deep clone via JSON — state is JSON-able by contract.
  return JSON.parse(JSON.stringify(state)) as GinState;
}

function topDiscard(state: GinState): Card | undefined {
  return state.discard[state.discard.length - 1];
}

function handHas(hand: Card[], card: Card): boolean {
  return hand.some((c) => cardsEqual(c, card));
}

function removeFromHand(hand: Card[], card: Card): boolean {
  const i = hand.findIndex((c) => cardsEqual(c, card));
  if (i === -1) return false;
  hand.splice(i, 1);
  return true;
}

/** Optimal meld arrangement + deadwood for a player's current hand. */
export function handMelds(state: GinState, player: Player): {
  melds: Meld[];
  deadwood: Card[];
  deadwoodValue: number;
} {
  return meldsAndDeadwood(state.hands[player]);
}

/* ── legal moves ─────────────────────────────────────────────────────────── */

export function legalMoves(state: GinState, player: Player): Move[] {
  if (state.phase === "roundOver" || state.phase === "gameOver") return [];
  if (player !== state.turn) return [];

  const moves: Move[] = [];
  const up = topDiscard(state);

  switch (state.phase) {
    case "upcardNonDealer":
    case "upcardDealer": {
      // The player on offer may take the upcard or pass.
      if (up) moves.push({ type: "drawDiscard" });
      moves.push({ type: "passUpcard" });
      return moves;
    }
    case "draw": {
      moves.push({ type: "drawStock" });
      if (up) moves.push({ type: "drawDiscard" });
      return moves;
    }
    case "discard": {
      // Discard any held card; if discarding it leaves deadwood ≤ 10, may knock.
      const hand = state.hands[player];
      for (const card of hand) {
        moves.push({ type: "discard", card: { ...card } });
        const after = hand.filter((c) => !cardsEqual(c, card));
        if (meldsAndDeadwood(after).deadwoodValue <= KNOCK_THRESHOLD) {
          moves.push({ type: "knock", card: { ...card } });
        }
      }
      return moves;
    }
    default:
      return moves;
  }
}

/* ── apply ───────────────────────────────────────────────────────────────── */

export function applyMove(
  state: GinState,
  player: Player,
  move: Move,
): GinState | MoveError {
  if (state.phase === "gameOver") return { error: "game is over" };
  if (state.phase === "roundOver") return { error: "round is over; deal next round" };
  if (player !== state.turn) return { error: "not your turn" };

  switch (move.type) {
    case "passUpcard":
      return applyPassUpcard(state, player);
    case "drawDiscard":
      return applyDrawDiscard(state, player);
    case "drawStock":
      return applyDrawStock(state, player);
    case "discard":
      return applyDiscard(state, player, move.card, false);
    case "knock":
      return applyDiscard(state, player, move.card, true);
    default:
      return { error: "unknown move" };
  }
}

function applyPassUpcard(state: GinState, player: Player): GinState | MoveError {
  if (state.phase !== "upcardNonDealer" && state.phase !== "upcardDealer") {
    return { error: "no upcard to pass" };
  }
  const next = clone(state);
  if (next.phase === "upcardNonDealer") {
    // Offer passes to the dealer.
    next.phase = "upcardDealer";
    next.turn = next.dealer;
    return next;
  }
  // Dealer also passed → non-dealer begins a normal turn (draw).
  next.phase = "draw";
  next.turn = (1 - next.dealer) as Player;
  return next;
}

function applyDrawDiscard(state: GinState, player: Player): GinState | MoveError {
  if (
    state.phase !== "draw" &&
    state.phase !== "upcardNonDealer" &&
    state.phase !== "upcardDealer"
  ) {
    return { error: "cannot draw from discard now" };
  }
  const up = topDiscard(state);
  if (!up) return { error: "discard pile is empty" };

  const next = clone(state);
  const taken = next.discard.pop()!;
  next.hands[player].push(taken);
  next.phase = "discard";
  next.turn = player;
  return next;
}

function applyDrawStock(state: GinState, player: Player): GinState | MoveError {
  if (state.phase !== "draw") return { error: "cannot draw from stock now" };
  if (state.stock.length === 0) return { error: "stock is empty" };

  const next = clone(state);
  const drawn = next.stock.pop()!;
  next.hands[player].push(drawn);
  next.phase = "discard";
  next.turn = player;
  return next;
}

function applyDiscard(
  state: GinState,
  player: Player,
  card: Card,
  knock: boolean,
): GinState | MoveError {
  if (state.phase !== "discard") return { error: "not in discard phase" };
  const hand = state.hands[player];
  if (!handHas(hand, card)) return { error: "you do not hold that card" };
  if (hand.length !== HAND_SIZE + 1) {
    return { error: "must draw before discarding" };
  }

  const next = clone(state);
  const nextHand = next.hands[player];
  removeFromHand(nextHand, card);
  next.discard.push({ ...card });

  if (knock) {
    if (!canKnock(nextHand)) {
      return { error: "cannot knock: deadwood exceeds 10" };
    }
    return resolveKnock(next, player);
  }

  // Normal end of turn → opponent's draw, UNLESS the stock is exhausted.
  // Standard rule: if after the discard only 2 cards remain in the stock and
  // no knock, the round is a wash (redeal).
  if (next.stock.length <= 2) {
    return washRound(next);
  }

  next.turn = (1 - player) as Player;
  next.phase = "draw";
  return next;
}

/* ── round resolution ──────────────────────────────────────────────────────*/

function resolveKnock(state: GinState, knocker: Player): GinState {
  const opponent = (1 - knocker) as Player;
  const knockerHand = state.hands[knocker];
  const opponentHand = state.hands[opponent];
  const gin = isGin(knockerHand);

  const outcome = scoreRound(knockerHand, opponentHand, gin);

  const scorerPlayer: Player = outcome.scorer === "knocker" ? knocker : opponent;
  state.scores[scorerPlayer] += outcome.points;

  const kind: RoundResult["kind"] = outcome.result;
  state.lastRound = { ...outcome, knocker, kind };

  // Game over?
  if (state.scores[0] >= state.target || state.scores[1] >= state.target) {
    state.phase = "gameOver";
    state.winner =
      state.scores[0] === state.scores[1]
        ? null
        : state.scores[0] > state.scores[1]
          ? 0
          : 1;
    state.turn = scorerPlayer;
    return state;
  }

  state.phase = "roundOver";
  state.turn = scorerPlayer;
  return state;
}

function washRound(state: GinState): GinState {
  state.lastRound = {
    result: "knock",
    kind: "wash",
    points: 0,
    scorer: "knocker",
    knocker: null,
    knockerDeadwood: 0,
    opponentDeadwood: 0,
    laidOff: [],
  };
  state.phase = "roundOver";
  return state;
}

/**
 * Begin the next round after a `roundOver` state. The dealer alternates; the
 * round counter advances (re-salting the deterministic shuffle). Scores carry
 * over. No-op error if the game is over or the round isn't actually over.
 */
export function startNextRound(state: GinState): GinState | MoveError {
  if (state.phase === "gameOver") return { error: "game is over" };
  if (state.phase !== "roundOver") return { error: "round is still in progress" };

  const next = clone(state);
  next.round += 1;
  next.dealer = (1 - next.dealer) as Player;
  const dealt = dealRound({ seed: next.seed, round: next.round, dealer: next.dealer });
  next.stock = dealt.stock;
  next.discard = dealt.discard;
  next.hands = dealt.hands;
  next.turn = dealt.turn;
  next.phase = "upcardNonDealer";
  next.lastRound = null;
  return next;
}

/* ── re-exports for the multiplayer/UI consumers ───────────────────────────*/
export { cardId, cardFromId, canKnock, isGin, meldsAndDeadwood };
