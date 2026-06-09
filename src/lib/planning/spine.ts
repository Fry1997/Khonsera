// Spine ordering for the planner (standing brief, Track A · engine gap 3).
//
// A fact lands on the spine at the RIGHT time — insert-by-time, not append — so
// typing facts in any order still yields a chronological plan. Pure functions.
//
// Timeless facts (no time yet — a fuzzy "afternoon", an unscheduled intention)
// keep their relative order and sink below timed facts, ready to harden later.

export type TimedFact = {
  id: string;
  /** ISO timestamp, or null/undefined if not yet timed. */
  time?: string | null;
};

function ms(t?: string | null): number | null {
  if (!t) return null;
  const v = new Date(t).getTime();
  return Number.isNaN(v) ? null : v;
}

/** Compare two facts chronologically; timeless facts sort after timed ones, stably. */
export function compareByTime(a: TimedFact, b: TimedFact): number {
  const at = ms(a.time);
  const bt = ms(b.time);
  if (at === null && bt === null) return 0; // preserve relative order (stable sort)
  if (at === null) return 1; // a timeless → after
  if (bt === null) return -1; // b timeless → after
  return at - bt;
}

/** Order a spine chronologically (stable). Does not mutate the input. */
export function orderByTime<T extends TimedFact>(facts: T[]): T[] {
  return [...facts].sort(compareByTime);
}

/**
 * Insert a fact at its chronological position (not appended). Returns a new
 * array. If the fact is timeless it goes to the end of the timed run, before
 * other timeless facts? No — it appends among timeless (stable), which is the
 * desired "drop below, ready to harden" behaviour.
 */
export function insertByTime<T extends TimedFact>(spine: T[], fact: T): T[] {
  const ft = ms(fact.time);
  if (ft === null) return [...spine, fact]; // timeless → end
  const out = [...spine];
  // first index whose time is strictly later than the new fact (timeless = later)
  const idx = out.findIndex((f) => {
    const t = ms(f.time);
    return t === null || t > ft;
  });
  if (idx === -1) {
    // no later fact → place after the last timed fact but before trailing timeless
    const lastTimed = findLastTimedIndex(out);
    out.splice(lastTimed + 1, 0, fact);
  } else {
    out.splice(idx, 0, fact);
  }
  return out;
}

function findLastTimedIndex(facts: TimedFact[]): number {
  for (let i = facts.length - 1; i >= 0; i--) {
    if (ms(facts[i].time) !== null) return i;
  }
  return -1;
}
