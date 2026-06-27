/* ════════════════════════════════════════════════════════════════════════
 * Khonsera · Gin Rummy engine — plain-JS port of src/lib/games/gin-rummy/.
 * Faithful to the TS contract in the design pack (cards / deadwood / score /
 * engine). Pure + deterministic; the UI renders state and sends moves. A small
 * AI opponent drives player 1 so the table is actually playable.
 *   const G = window.GinEngine;
 * ════════════════════════════════════════════════════════════════════════ */
(function () {
  /* ── cards ─────────────────────────────────────────────────────────────── */
  const SUITS = ["S", "H", "D", "C"];
  const RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
  const cardId = (c) => c.suit + c.rank;
  const cardsEqual = (a, b) => a.rank === b.rank && a.suit === b.suit;
  const cardValue = (c) => (c.rank > 10 ? 10 : c.rank);
  function freshDeck() {
    const d = [];
    for (const s of SUITS) for (const r of RANKS) d.push({ rank: r, suit: s });
    return d;
  }
  const RLAB = { 1: "A", 11: "J", 12: "Q", 13: "K" };
  const rankLabel = (r) => RLAB[r] || String(r);

  /* ── rng (mulberry32 over a hashed seed) ───────────────────────────────── */
  function makeRng(seed) {
    let h = 1779033703 ^ String(seed).length;
    for (let i = 0; i < String(seed).length; i++) {
      h = Math.imul(h ^ String(seed).charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    let a = h >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ── deadwood — minimal-deadwood meld arrangement (branch & bound) ─────── */
  function isSetMeld(cards) {
    if (cards.length < 3 || cards.length > 4) return false;
    const r = cards[0].rank;
    if (!cards.every((c) => c.rank === r)) return false;
    return new Set(cards.map((c) => c.suit)).size === cards.length;
  }
  function isRunMeld(cards) {
    if (cards.length < 3) return false;
    const suit = cards[0].suit;
    if (!cards.every((c) => c.suit === suit)) return false;
    const ranks = cards.map((c) => c.rank).sort((a, b) => a - b);
    for (let i = 1; i < ranks.length; i++) if (ranks[i] !== ranks[i - 1] + 1) return false;
    return true;
  }
  const isMeld = (cards) => isSetMeld(cards) || isRunMeld(cards);

  function combinations(arr, k) {
    const out = [];
    const n = arr.length;
    if (k > n) return out;
    const idx = Array.from({ length: k }, (_, i) => i);
    while (true) {
      out.push(idx.map((i) => arr[i]));
      let i = k - 1;
      while (i >= 0 && idx[i] === n - k + i) i--;
      if (i < 0) return out;
      idx[i]++;
      for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
    }
  }

  function enumerateCandidates(hand) {
    const cands = [];
    const n = hand.length;
    const toCand = (ci) => { let mask = 0; for (const i of ci) mask |= 1 << i; return { cards: ci, mask }; };

    const byRank = new Map();
    for (let i = 0; i < n; i++) {
      const r = hand[i].rank; const l = byRank.get(r) || []; l.push(i); byRank.set(r, l);
    }
    for (const idxs of byRank.values()) {
      const seen = new Set(); const uniq = [];
      for (const i of idxs) { if (!seen.has(hand[i].suit)) { seen.add(hand[i].suit); uniq.push(i); } }
      if (uniq.length >= 3) {
        for (const trio of combinations(uniq, 3)) cands.push(toCand(trio));
        if (uniq.length >= 4) for (const quad of combinations(uniq, 4)) cands.push(toCand(quad));
      }
    }
    const bySuit = new Map();
    for (let i = 0; i < n; i++) {
      const s = hand[i].suit; const l = bySuit.get(s) || []; l.push(i); bySuit.set(s, l);
    }
    for (const idxs of bySuit.values()) {
      const seen = new Set();
      const sorted = idxs.filter((i) => { const r = hand[i].rank; if (seen.has(r)) return false; seen.add(r); return true; })
        .sort((a, b) => hand[a].rank - hand[b].rank);
      let block = [];
      const flush = () => {
        for (let len = 3; len <= block.length; len++)
          for (let start = 0; start + len <= block.length; start++)
            cands.push(toCand(block.slice(start, start + len)));
      };
      for (let k = 0; k < sorted.length; k++) {
        if (block.length === 0 || hand[sorted[k]].rank === hand[block[block.length - 1]].rank + 1) block.push(sorted[k]);
        else { flush(); block = [sorted[k]]; }
      }
      flush();
    }
    return cands;
  }

  function meldsAndDeadwood(hand) {
    const n = hand.length;
    const val = hand.map(cardValue);
    const totalValue = val.reduce((a, b) => a + b, 0);
    const cands = enumerateCandidates(hand);
    const candValue = cands.map((c) => c.cards.reduce((a, i) => a + val[i], 0));
    const order = cands.map((_, i) => i).sort((a, b) => candValue[b] - candValue[a]);
    const oc = order.map((i) => cands[i]);
    const ov = order.map((i) => candValue[i]);
    const suffix = new Array(oc.length + 1).fill(0);
    for (let i = oc.length - 1; i >= 0; i--) suffix[i] = suffix[i + 1] + ov[i];

    let bestRemoved = 0, bestChosen = [];
    const chosen = [];
    const sig = (ms) => ms.map((m) => m.cards.map((i) => cardId(hand[i])).sort().join(",")).sort().join("|");
    const better = (a, b) => {
      if (b.length === 0 && a.length > 0) return true;
      if (a.length === 0) return false;
      if (a.length !== b.length) return a.length < b.length;
      return sig(a) < sig(b);
    };
    function dfs(start, used, removed) {
      if (removed > bestRemoved || (removed === bestRemoved && better(chosen, bestChosen))) {
        bestRemoved = removed; bestChosen = chosen.slice();
      }
      if (removed + suffix[start] < bestRemoved) return;
      for (let i = start; i < oc.length; i++) {
        const c = oc[i];
        if ((used & c.mask) !== 0) continue;
        chosen.push(c); dfs(i + 1, used | c.mask, removed + ov[i]); chosen.pop();
      }
    }
    if (cands.length > 0) dfs(0, 0, 0);

    let usedMask = 0;
    const melds = bestChosen.map((c) => { usedMask |= c.mask; return c.cards.map((i) => hand[i]); });
    const deadwood = [];
    for (let i = 0; i < n; i++) if ((usedMask & (1 << i)) === 0) deadwood.push(hand[i]);
    return { melds, deadwood, deadwoodValue: totalValue - bestRemoved };
  }
  const deadwoodValueOf = (hand) => meldsAndDeadwood(hand).deadwoodValue;

  /* ── score — lay-offs, round scoring, knock validity ───────────────────── */
  const KNOCK_THRESHOLD = 10, GIN_BONUS = 25, UNDERCUT_BONUS = 25;
  const canKnock = (hand) => meldsAndDeadwood(hand).deadwoodValue <= KNOCK_THRESHOLD;
  const isGin = (hand) => meldsAndDeadwood(hand).deadwoodValue === 0;
  const canLayOff = (card, meld) => isMeld([...meld, card]);

  function layOff(opponentDeadwood, knockerMelds) {
    const melds = knockerMelds.map((m) => m.slice());
    let pool = opponentDeadwood.slice();
    const laidOff = [];
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < pool.length; i++) {
        const card = pool[i];
        for (const meld of melds) {
          if (canLayOff(card, meld)) { meld.push(card); laidOff.push(card); pool.splice(i, 1); changed = true; break; }
        }
        if (changed) break;
      }
    }
    const remainingValue = pool.reduce((a, c) => a + cardValue(c), 0);
    return { laidOff, remaining: pool, remainingValue };
  }

  function scoreRound(knockerHand, opponentHand, gin) {
    const kResult = meldsAndDeadwood(knockerHand);
    const knockerDeadwood = kResult.deadwoodValue;
    const oResult = meldsAndDeadwood(opponentHand);
    if (gin) {
      const oppDeadwood = oResult.deadwoodValue;
      return { result: "gin", points: oppDeadwood + GIN_BONUS, scorer: "knocker", knockerDeadwood: 0, opponentDeadwood: oppDeadwood, laidOff: [] };
    }
    const { laidOff, remainingValue } = layOff(oResult.deadwood, kResult.melds);
    const oppDeadwood = remainingValue;
    const diff = oppDeadwood - knockerDeadwood;
    if (diff > 0) return { result: "knock", points: diff, scorer: "knocker", knockerDeadwood, opponentDeadwood: oppDeadwood, laidOff };
    return { result: "undercut", points: -diff + UNDERCUT_BONUS, scorer: "opponent", knockerDeadwood, opponentDeadwood: oppDeadwood, laidOff };
  }

  /* ── engine ────────────────────────────────────────────────────────────── */
  const HAND_SIZE = 10;
  const clone = (s) => JSON.parse(JSON.stringify(s));
  const topDiscard = (s) => s.discard[s.discard.length - 1];
  const handHas = (hand, card) => hand.some((c) => cardsEqual(c, card));
  function removeFromHand(hand, card) { const i = hand.findIndex((c) => cardsEqual(c, card)); if (i === -1) return false; hand.splice(i, 1); return true; }

  function dealRound(base) {
    const rng = makeRng(`${base.seed}#${base.round}`);
    const deck = shuffle(freshDeck(), rng);
    const nonDealer = 1 - base.dealer;
    const hands = [[], []];
    let idx = 0;
    for (let n = 0; n < HAND_SIZE; n++) { hands[nonDealer].push(deck[idx++]); hands[base.dealer].push(deck[idx++]); }
    const upcard = deck[idx++];
    const stock = deck.slice(idx);
    return { stock, discard: [upcard], hands, turn: nonDealer };
  }

  function createGame(opts) {
    const seed = String(opts.seed);
    const target = opts.target ?? 100;
    const dealer = 0;
    const dealt = dealRound({ seed, round: 0, dealer });
    return {
      seed, target, scores: [0, 0], round: 0, dealer, turn: dealt.turn,
      phase: "upcardNonDealer", stock: dealt.stock, discard: dealt.discard,
      hands: dealt.hands, lastRound: null, winner: null,
    };
  }

  function handMelds(state, player) { return meldsAndDeadwood(state.hands[player]); }

  function legalMoves(state, player) {
    if (state.phase === "roundOver" || state.phase === "gameOver") return [];
    if (player !== state.turn) return [];
    const moves = [];
    const up = topDiscard(state);
    switch (state.phase) {
      case "upcardNonDealer":
      case "upcardDealer":
        if (up) moves.push({ type: "drawDiscard" });
        moves.push({ type: "passUpcard" });
        return moves;
      case "draw":
        moves.push({ type: "drawStock" });
        if (up) moves.push({ type: "drawDiscard" });
        return moves;
      case "discard": {
        const hand = state.hands[player];
        for (const card of hand) {
          moves.push({ type: "discard", card: { ...card } });
          const after = hand.filter((c) => !cardsEqual(c, card));
          if (meldsAndDeadwood(after).deadwoodValue <= KNOCK_THRESHOLD) moves.push({ type: "knock", card: { ...card } });
        }
        return moves;
      }
      default: return moves;
    }
  }

  function applyMove(state, player, move) {
    if (state.phase === "gameOver") return { error: "game is over" };
    if (state.phase === "roundOver") return { error: "round is over; deal next round" };
    if (player !== state.turn) return { error: "not your turn" };
    switch (move.type) {
      case "passUpcard": return applyPassUpcard(state, player);
      case "drawDiscard": return applyDrawDiscard(state, player);
      case "drawStock": return applyDrawStock(state, player);
      case "discard": return applyDiscard(state, player, move.card, false);
      case "knock": return applyDiscard(state, player, move.card, true);
      default: return { error: "unknown move" };
    }
  }

  function applyPassUpcard(state, player) {
    if (state.phase !== "upcardNonDealer" && state.phase !== "upcardDealer") return { error: "no upcard to pass" };
    const next = clone(state);
    if (next.phase === "upcardNonDealer") { next.phase = "upcardDealer"; next.turn = next.dealer; return next; }
    next.phase = "draw"; next.turn = 1 - next.dealer; return next;
  }
  function applyDrawDiscard(state, player) {
    if (state.phase !== "draw" && state.phase !== "upcardNonDealer" && state.phase !== "upcardDealer") return { error: "cannot draw from discard now" };
    const up = topDiscard(state);
    if (!up) return { error: "discard pile is empty" };
    const next = clone(state);
    const taken = next.discard.pop();
    next.hands[player].push(taken);
    next.phase = "discard"; next.turn = player; return next;
  }
  function applyDrawStock(state, player) {
    if (state.phase !== "draw") return { error: "cannot draw from stock now" };
    if (state.stock.length === 0) return { error: "stock is empty" };
    const next = clone(state);
    const drawn = next.stock.pop();
    next.hands[player].push(drawn);
    next.phase = "discard"; next.turn = player; return next;
  }
  function applyDiscard(state, player, card, knock) {
    if (state.phase !== "discard") return { error: "not in discard phase" };
    const hand = state.hands[player];
    if (!handHas(hand, card)) return { error: "you do not hold that card" };
    if (hand.length !== HAND_SIZE + 1) return { error: "must draw before discarding" };
    const next = clone(state);
    removeFromHand(next.hands[player], card);
    next.discard.push({ ...card });
    if (knock) {
      if (!canKnock(next.hands[player])) return { error: "cannot knock: deadwood exceeds 10" };
      return resolveKnock(next, player);
    }
    if (next.stock.length <= 2) return washRound(next);
    next.turn = 1 - player; next.phase = "draw"; return next;
  }
  function resolveKnock(state, knocker) {
    const opponent = 1 - knocker;
    const gin = isGin(state.hands[knocker]);
    const outcome = scoreRound(state.hands[knocker], state.hands[opponent], gin);
    const scorerPlayer = outcome.scorer === "knocker" ? knocker : opponent;
    state.scores[scorerPlayer] += outcome.points;
    state.lastRound = { ...outcome, knocker, kind: outcome.result };
    if (state.scores[0] >= state.target || state.scores[1] >= state.target) {
      state.phase = "gameOver";
      state.winner = state.scores[0] === state.scores[1] ? null : state.scores[0] > state.scores[1] ? 0 : 1;
      state.turn = scorerPlayer; return state;
    }
    state.phase = "roundOver"; state.turn = scorerPlayer; return state;
  }
  function washRound(state) {
    state.lastRound = { result: "knock", kind: "wash", points: 0, scorer: "knocker", knocker: null, knockerDeadwood: 0, opponentDeadwood: 0, laidOff: [] };
    state.phase = "roundOver"; return state;
  }
  function startNextRound(state) {
    if (state.phase === "gameOver") return { error: "game is over" };
    if (state.phase !== "roundOver") return { error: "round is still in progress" };
    const next = clone(state);
    next.round += 1; next.dealer = 1 - next.dealer;
    const dealt = dealRound({ seed: next.seed, round: next.round, dealer: next.dealer });
    next.stock = dealt.stock; next.discard = dealt.discard; next.hands = dealt.hands; next.turn = dealt.turn;
    next.phase = "upcardNonDealer"; next.lastRound = null; return next;
  }

  /* ── AI opponent (player 1) — returns ONE legal move at a time ─────────── */
  function bestDiscard(hand) {
    // discard the card that leaves the lowest deadwood; tie → highest value gone
    let best = null;
    for (const card of hand) {
      const after = hand.filter((c) => !cardsEqual(c, card));
      const dw = meldsAndDeadwood(after).deadwoodValue;
      if (!best || dw < best.dw || (dw === best.dw && cardValue(card) > cardValue(best.card)))
        best = { card, dw };
    }
    return best;
  }
  function aiMove(state, player) {
    const up = topDiscard(state);
    if (state.phase === "upcardNonDealer" || state.phase === "upcardDealer") {
      // take the upcard only if it strictly improves the hand
      const cur = deadwoodValueOf(state.hands[player]);
      const withUp = state.hands[player].concat([up]);
      const bd = bestDiscard(withUp);
      if (bd && bd.dw < cur - 4) return { type: "drawDiscard" };
      return { type: "passUpcard" };
    }
    if (state.phase === "draw") {
      const cur = deadwoodValueOf(state.hands[player]);
      const withUp = state.hands[player].concat([up]);
      const bd = bestDiscard(withUp);
      if (bd && bd.dw < cur) return { type: "drawDiscard" };
      return { type: "drawStock" };
    }
    if (state.phase === "discard") {
      const hand = state.hands[player];
      const bd = bestDiscard(hand);
      const after = hand.filter((c) => !cardsEqual(c, bd.card));
      const dw = meldsAndDeadwood(after).deadwoodValue;
      // knock when gin always; otherwise knock once deadwood is comfortably low
      if (dw === 0) return { type: "knock", card: { ...bd.card } };
      if (dw <= KNOCK_THRESHOLD && dw <= 7 && state.stock.length < 28) return { type: "knock", card: { ...bd.card } };
      return { type: "discard", card: { ...bd.card } };
    }
    return null;
  }

  window.GinEngine = {
    SUITS, RANKS, cardId, cardsEqual, cardValue, freshDeck, rankLabel,
    meldsAndDeadwood, deadwoodValueOf, isMeld,
    canKnock, isGin, canLayOff, layOff, scoreRound, KNOCK_THRESHOLD, GIN_BONUS, UNDERCUT_BONUS,
    createGame, legalMoves, applyMove, startNextRound, handMelds,
    aiMove, bestDiscard,
  };
})();
