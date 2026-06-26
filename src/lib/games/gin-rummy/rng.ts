/* ════════════════════════════════════════════════════════════════════════
 * Gin Rummy · rng — a small, seedable PRNG so shuffles are reproducible.
 *
 * NOT Math.random: the seed makes a game replayable and lets a server be the
 * authoritative dealer. Uses xmur3 to hash a string/number seed into a 32-bit
 * state, then mulberry32 to generate. Both are tiny, well-known, and stable.
 * ════════════════════════════════════════════════════════════════════════ */

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A deterministic random source returning floats in [0, 1). */
export interface Rng {
  next(): number;
}

export function makeRng(seed: string | number): Rng {
  const seedFn = xmur3(String(seed));
  const gen = mulberry32(seedFn());
  return { next: gen };
}

/** Pure Fisher–Yates shuffle. Returns a NEW array; input untouched. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}
