/* ════════════════════════════════════════════════════════════════════════
 * Gin Rummy · heuristic bot — a pure opponent for the single-player table.
 *
 * `chooseMove(state, player)` returns ONE legal `Move` for `player` (the bot is
 * conventionally player 1). It is a re-implementation of the design pack's AI
 * heuristic on OUR engine's public API (legalMoves / meldsAndDeadwood / isGin /
 * canKnock) — no shared code with the prototype `gin-engine.js`.
 *
 * Pure + deterministic given the state: it inspects the hand, never mutates,
 * and reads only `meldsAndDeadwood` to score arrangements. Fast enough to call
 * synchronously between turns (a 10–11 card deadwood solve is a few dozen
 * candidates).
 *
 * Heuristic, by phase:
 *   • Opening upcard (upcardNonDealer/upcardDealer): take it only if it would
 *     strictly and meaningfully lower achievable deadwood (a 4+ point swing) —
 *     i.e. it completes/extends a meld worth committing to; else pass.
 *   • Draw: take the discard top if drawing it lets the best discard leave LESS
 *     deadwood than drawing blind from the stock would guarantee; else stock.
 *   • Discard: pick the discard that leaves the LOWEST deadwood (tie-break:
 *     shed the highest card value — least meld potential / most points saved).
 *   • Knock: gin → always knock for gin; else knock only when deadwood is
 *     comfortably low (≤ 7) and the round isn't still in its opening (stock not
 *     near-full), so the bot doesn't knock thin into a likely undercut early.
 * ════════════════════════════════════════════════════════════════════════ */
import { type Card, cardValue } from "./cards";
import { meldsAndDeadwood } from "./deadwood";
import { type Move, type Player, type GinState, legalMoves } from "./engine";
import { KNOCK_THRESHOLD, isGin } from "./score";

/** Conservative-early knock ceiling (≤ this deadwood → knock). */
const BOT_KNOCK_CEILING = 7;
/** Stock count below which the bot is willing to knock (avoid thin early knocks). */
const BOT_KNOCK_STOCK_GATE = 28;
/** Opening upcard is taken only if it improves achievable deadwood by ≥ this. */
const UPCARD_IMPROVE = 4;

function deadwoodValueOf(hand: Card[]): number {
  return meldsAndDeadwood(hand).deadwoodValue;
}

/**
 * The best card to discard from an (11-card) hand: the one whose removal leaves
 * the lowest deadwood. Tie-break: prefer shedding the higher-value card.
 * Returns the card plus the resulting deadwood value.
 */
export function bestDiscard(hand: Card[]): { card: Card; deadwood: number } | null {
  let best: { card: Card; deadwood: number } | null = null;
  for (const card of hand) {
    const after = hand.filter(
      (c) => !(c.rank === card.rank && c.suit === card.suit),
    );
    const dw = deadwoodValueOf(after);
    if (
      !best ||
      dw < best.deadwood ||
      (dw === best.deadwood && cardValue(card) > cardValue(best.card))
    ) {
      best = { card, deadwood: dw };
    }
  }
  return best;
}

/**
 * Choose one legal move for `player`. Falls back to the first legal move if the
 * heuristic somehow names an illegal one (defensive — keeps the bot unstuck).
 */
export function chooseMove(state: GinState, player: Player): Move | null {
  const legal = legalMoves(state, player);
  if (legal.length === 0) return null;

  const hand = state.hands[player];
  const up = state.discard[state.discard.length - 1];

  switch (state.phase) {
    case "upcardNonDealer":
    case "upcardDealer": {
      // Take the opening upcard only when it meaningfully improves the hand.
      if (up) {
        const cur = deadwoodValueOf(hand);
        const bd = bestDiscard([...hand, up]);
        if (bd && bd.deadwood <= cur - UPCARD_IMPROVE) {
          return pick(legal, { type: "drawDiscard" });
        }
      }
      return pick(legal, { type: "passUpcard" });
    }

    case "draw": {
      // Take the discard if it lets us end the turn on strictly less deadwood
      // than we hold now (it completes/extends a meld or sheds a high card).
      if (up) {
        const cur = deadwoodValueOf(hand);
        const bd = bestDiscard([...hand, up]);
        if (bd && bd.deadwood < cur) {
          return pick(legal, { type: "drawDiscard" });
        }
      }
      return pick(legal, { type: "drawStock" });
    }

    case "discard": {
      const bd = bestDiscard(hand);
      if (!bd) return legal[0];
      const after = hand.filter(
        (c) => !(c.rank === bd.card.rank && c.suit === bd.card.suit),
      );
      // Gin → knock for gin, always.
      if (isGin(after)) {
        return pick(legal, { type: "knock", card: { ...bd.card } }) ??
          pick(legal, { type: "discard", card: { ...bd.card } }) ??
          legal[0];
      }
      // Otherwise knock only when comfortably low and not too early.
      if (
        bd.deadwood <= KNOCK_THRESHOLD &&
        bd.deadwood <= BOT_KNOCK_CEILING &&
        state.stock.length < BOT_KNOCK_STOCK_GATE
      ) {
        const knock = pick(legal, { type: "knock", card: { ...bd.card } });
        if (knock) return knock;
      }
      return (
        pick(legal, { type: "discard", card: { ...bd.card } }) ?? legal[0]
      );
    }

    default:
      return legal[0];
  }
}

/** Find the matching legal move (so we never return one the engine rejects). */
function pick(legal: Move[], want: Move): Move | null {
  for (const m of legal) {
    if (m.type !== want.type) continue;
    if (m.type === "discard" || m.type === "knock") {
      const w = want as Extract<Move, { card: Card }>;
      if (m.card.rank === w.card.rank && m.card.suit === w.card.suit) return m;
    } else {
      return m;
    }
  }
  return null;
}
