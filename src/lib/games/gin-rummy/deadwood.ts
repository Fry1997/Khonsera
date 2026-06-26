/* ════════════════════════════════════════════════════════════════════════
 * Gin Rummy · deadwood — the core algorithm.
 *
 * Given a hand, find the arrangement of melds (sets + runs) that MINIMISES the
 * point value of the leftover (deadwood) cards, where each card belongs to at
 * most one meld.
 *
 * Approach: enumerate every *candidate* meld (all valid sets and runs, of every
 * length, that the hand can form), then search over disjoint subsets of those
 * candidates for the combination that removes the most points. The candidate
 * count for a 10–11 card hand is tiny (a few dozen at most), and we prune with
 * a branch-and-bound DFS, so this is fast and provably optimal.
 *
 * A set = 3 or 4 cards of the same rank. A run = 3+ consecutive same-suit cards
 * (aces low, no wrap: A-2-3 ok, Q-K-A not).
 * ════════════════════════════════════════════════════════════════════════ */
import { type Card, cardId, cardValue } from "./cards";

export type Meld = Card[];

export interface MeldResult {
  /** The chosen meld arrangement (each card appears in at most one meld). */
  melds: Meld[];
  /** The leftover unmelded cards. */
  deadwood: Card[];
  /** Sum of point values of the deadwood. */
  deadwoodValue: number;
}

/** Index-based meld over a fixed hand array (internal). */
interface CandIdx {
  cards: number[]; // indices into the hand
  mask: number; // bitmask of those indices
}

function isSetMeld(cards: Card[]): boolean {
  if (cards.length < 3 || cards.length > 4) return false;
  const r = cards[0].rank;
  if (!cards.every((c) => c.rank === r)) return false;
  // distinct suits (a set can't repeat a suit)
  const suits = new Set(cards.map((c) => c.suit));
  return suits.size === cards.length;
}

function isRunMeld(cards: Card[]): boolean {
  if (cards.length < 3) return false;
  const suit = cards[0].suit;
  if (!cards.every((c) => c.suit === suit)) return false;
  const ranks = cards.map((c) => c.rank).sort((a, b) => a - b);
  for (let i = 1; i < ranks.length; i++) {
    if (ranks[i] !== ranks[i - 1] + 1) return false;
  }
  return true;
}

/** Is this set of cards a valid meld (set or run)? Order-independent. */
export function isMeld(cards: Card[]): boolean {
  return isSetMeld(cards) || isRunMeld(cards);
}

/**
 * Enumerate every valid candidate meld in the hand, as index bitmasks.
 * Includes 3- and 4-card sets and runs of every length ≥ 3.
 */
function enumerateCandidates(hand: Card[]): CandIdx[] {
  const cands: CandIdx[] = [];
  const n = hand.length;

  // ── sets: group indices by rank, take every 3- and 4-combination ──
  const byRank = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = hand[i].rank;
    const list = byRank.get(r) ?? [];
    list.push(i);
    byRank.set(r, list);
  }
  for (const idxs of byRank.values()) {
    // suits within a rank are unique in a real deck, but be defensive.
    const uniq = dedupeBySuit(idxs, hand);
    if (uniq.length >= 3) {
      // all 3-subsets
      for (const trio of combinations(uniq, 3)) cands.push(toCand(trio));
      // the full 4-set (and any 4-subset; only one when uniq.length===4)
      if (uniq.length >= 4) for (const quad of combinations(uniq, 4)) cands.push(toCand(quad));
    }
  }

  // ── runs: per suit, sort by rank, find maximal consecutive blocks, then
  //    every contiguous window of length ≥ 3 inside each block ──
  const bySuit = new Map<string, number[]>();
  for (let i = 0; i < n; i++) {
    const s = hand[i].suit;
    const list = bySuit.get(s) ?? [];
    list.push(i);
    bySuit.set(s, list);
  }
  for (const idxs of bySuit.values()) {
    // dedupe by rank within suit (defensive), sort ascending by rank
    const seen = new Set<number>();
    const sorted = idxs
      .filter((i) => {
        const r = hand[i].rank;
        if (seen.has(r)) return false;
        seen.add(r);
        return true;
      })
      .sort((a, b) => hand[a].rank - hand[b].rank);

    // split into consecutive blocks
    let block: number[] = [];
    const flush = () => {
      for (let len = 3; len <= block.length; len++) {
        for (let start = 0; start + len <= block.length; start++) {
          cands.push(toCand(block.slice(start, start + len)));
        }
      }
    };
    for (let k = 0; k < sorted.length; k++) {
      if (block.length === 0 || hand[sorted[k]].rank === hand[block[block.length - 1]].rank + 1) {
        block.push(sorted[k]);
      } else {
        flush();
        block = [sorted[k]];
      }
    }
    flush();
  }

  return cands;

  function toCand(cardsIdx: number[]): CandIdx {
    let mask = 0;
    for (const i of cardsIdx) mask |= 1 << i;
    return { cards: cardsIdx, mask };
  }
}

function dedupeBySuit(idxs: number[], hand: Card[]): number[] {
  const seen = new Set<string>();
  const out: number[] = [];
  for (const i of idxs) {
    const s = hand[i].suit;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(i);
  }
  return out;
}

function* combinations(arr: number[], k: number): Generator<number[]> {
  const n = arr.length;
  if (k > n) return;
  const idx = Array.from({ length: k }, (_, i) => i);
  while (true) {
    yield idx.map((i) => arr[i]);
    let i = k - 1;
    while (i >= 0 && idx[i] === n - k + i) i--;
    if (i < 0) return;
    idx[i]++;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
  }
}

/**
 * Find the min-deadwood meld arrangement for a hand.
 * Deterministic: ties broken by the chosen melds' card ids so the result is
 * stable across runs (important for tests + reproducible server state).
 */
export function meldsAndDeadwood(hand: Card[]): MeldResult {
  const n = hand.length;

  // value of each card by index, and a quick total
  const val: number[] = hand.map((c) => cardValue(c));
  const totalValue = val.reduce((a, b) => a + b, 0);

  const cands = enumerateCandidates(hand);

  // Precompute each candidate's removed value (for bound) — not strictly used
  // for correctness but helps ordering.
  const candValue = cands.map((c) => c.cards.reduce((a, i) => a + val[i], 0));

  // We search for the subset of disjoint candidates that maximises removed
  // value (== minimises deadwood). DFS with branch-and-bound.
  let bestRemoved = 0;
  let bestChosen: CandIdx[] = [];

  // Order candidates by value desc to find good solutions early (tighter bound).
  const order = cands
    .map((_, i) => i)
    .sort((a, b) => candValue[b] - candValue[a]);
  const orderedCands = order.map((i) => cands[i]);
  const orderedValue = order.map((i) => candValue[i]);

  // suffixMaxRemainder[i] = optimistic upper bound on value still obtainable
  // from candidates i..end (sum of their values; loose but valid bound).
  const suffix: number[] = new Array(orderedCands.length + 1).fill(0);
  for (let i = orderedCands.length - 1; i >= 0; i--) {
    suffix[i] = suffix[i + 1] + orderedValue[i];
  }

  const chosen: CandIdx[] = [];

  function dfs(start: number, usedMask: number, removed: number) {
    if (removed > bestRemoved || (removed === bestRemoved && better(chosen, bestChosen))) {
      bestRemoved = removed;
      bestChosen = chosen.slice();
    }
    // bound: even taking all remaining candidate value can't beat the best
    if (removed + suffix[start] < bestRemoved) return;

    for (let i = start; i < orderedCands.length; i++) {
      const c = orderedCands[i];
      if ((usedMask & c.mask) !== 0) continue;
      chosen.push(c);
      dfs(i + 1, usedMask | c.mask, removed + orderedValue[i]);
      chosen.pop();
    }
  }

  // tie-break: prefer the arrangement whose sorted card-id signature is smaller,
  // and prefer fewer melds for a stable, intuitive result.
  function better(a: CandIdx[], b: CandIdx[]): boolean {
    if (b.length === 0 && a.length > 0) return true;
    if (a.length === 0) return false;
    if (a.length !== b.length) return a.length < b.length;
    return sig(a) < sig(b);
  }
  function sig(ms: CandIdx[]): string {
    return ms
      .map((m) => m.cards.map((i) => cardId(hand[i])).sort().join(","))
      .sort()
      .join("|");
  }

  if (cands.length > 0) dfs(0, 0, 0);

  // Build the result from bestChosen.
  let usedMask = 0;
  const melds: Meld[] = bestChosen.map((c) => {
    usedMask |= c.mask;
    return c.cards.map((i) => hand[i]);
  });
  const deadwood: Card[] = [];
  for (let i = 0; i < n; i++) {
    if ((usedMask & (1 << i)) === 0) deadwood.push(hand[i]);
  }
  const deadwoodValue = totalValue - bestRemoved;

  return { melds, deadwood, deadwoodValue };
}

/** Convenience: just the minimal deadwood value of a hand. */
export function deadwoodValueOf(hand: Card[]): number {
  return meldsAndDeadwood(hand).deadwoodValue;
}
