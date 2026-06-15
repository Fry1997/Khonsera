// FX adapter (Phase 19) — home-currency view of foreign spend. FREE + KEYLESS
// (Frankfurter, ECB reference rates: https://frankfurter.dev). No procurement; runs
// live in prod with no key. Degrades gracefully — a failed fetch returns null and
// the surface just shows the original currency. The arithmetic (`applyRate`) is
// pure + unit-tested; the fetch is a thin, cached wrapper.

const BASE = process.env.FX_URL ?? "https://api.frankfurter.app";

export function applyRate(amount: number, rate: number): number {
  return Math.round(amount * rate * 100) / 100;
}

// Latest rates for a base currency → { CODE: rate }. Cached an hour (ECB publishes
// once a working day, so an hour is plenty fresh and kind to the free service).
export async function ratesFor(base: string): Promise<Record<string, number> | null> {
  try {
    const res = await fetch(`${BASE}/latest?base=${encodeURIComponent(base.toUpperCase())}`, { signal: AbortSignal.timeout(6000), next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const json = (await res.json()) as { rates?: Record<string, number> };
    return json.rates ?? null;
  } catch {
    return null;
  }
}

// Convert `amount` `from` → `to`. Same currency = identity; unknown rate = null
// (caller shows the original). One rates fetch per `from` is shared via the cache.
export async function convert(amount: number, from: string, to: string): Promise<number | null> {
  const f = from.toUpperCase();
  const t = to.toUpperCase();
  if (f === t) return Math.round(amount * 100) / 100;
  const rates = await ratesFor(f);
  const rate = rates?.[t];
  return rate ? applyRate(amount, rate) : null;
}

// Convert many same-source amounts in one fetch (the budget's foreign lines).
export async function convertEach(items: { amount: number; from: string }[], to: string): Promise<(number | null)[]> {
  const t = to.toUpperCase();
  const cache = new Map<string, Record<string, number> | null>();
  const out: (number | null)[] = [];
  for (const it of items) {
    const f = it.from.toUpperCase();
    if (f === t) { out.push(Math.round(it.amount * 100) / 100); continue; }
    if (!cache.has(f)) cache.set(f, await ratesFor(f));
    const rate = cache.get(f)?.[t];
    out.push(rate ? applyRate(it.amount, rate) : null);
  }
  return out;
}
