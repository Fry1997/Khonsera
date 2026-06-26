/* ════════════════════════════════════════════════════════════════════════
 * Gin Rummy · public API — the contract a multiplayer layer + UI consume.
 * ════════════════════════════════════════════════════════════════════════ */
export type { Card, Rank, Suit } from "./cards";
export {
  cardId,
  cardFromId,
  cardValue,
  cardsEqual,
  cardLabel,
  freshDeck,
  SUITS,
  RANKS,
} from "./cards";

export { makeRng, shuffle } from "./rng";
export type { Rng } from "./rng";

export {
  meldsAndDeadwood,
  deadwoodValueOf,
  isMeld,
} from "./deadwood";
export type { Meld, MeldResult } from "./deadwood";

export {
  canKnock,
  isGin,
  canLayOff,
  layOff,
  scoreRound,
  meldSignature,
  KNOCK_THRESHOLD,
  GIN_BONUS,
  UNDERCUT_BONUS,
} from "./score";
export type { KnockOutcome } from "./score";

export {
  createGame,
  legalMoves,
  applyMove,
  startNextRound,
  serialize,
  deserialize,
  handMelds,
} from "./engine";
export type {
  GinState,
  Move,
  MoveError,
  Phase,
  Player,
  RoundResult,
  CreateOpts,
} from "./engine";
