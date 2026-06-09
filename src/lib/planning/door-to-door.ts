// The new planner's ranking brain (standing brief, Track A · engine gap 1).
//
// ONE criterion: door-to-door total time. Speed ranks; exclusions filter
// (an excluded mode removes an option entirely — it is NEVER just down-ranked).
// This deliberately replaces the legacy preference-weighted scorecard
// (`ranking.ts`, still used by the legacy screens) per the planner spec:
// "Must not read as a preference-weighted scorecard. There is one criterion."
//
// Door-to-door = sum of every sub-leg's minutes + the connection buffer to board
// each subsequent sub-leg (first-mile/last-mile included). Pure functions.

import type { TransitionMode } from "@/lib/types/domain";

export type SubLeg = {
  mode: TransitionMode;
  minutes: number;
  /** optional, for display/booking — not used in ranking */
  from?: string;
  to?: string;
};

export type DoorToDoorOption = {
  id: string;
  subLegs: SubLeg[];
  cost?: number | null; // minor units; tiebreak only
  departure?: string | null; // ISO; tiebreak only
  arrival?: string | null;
};

// Mode-specific connection buffer (minutes) — the time to *board/catch* the next
// sub-leg. Walking is the connective tissue and carries no extra buffer. These
// are sensible UK defaults; tune as live data lands.
const ACCESS_BUFFER: Record<TransitionMode, number> = {
  walk: 0,
  taxi: 5, // hail / wait
  drive: 5, // unpark / park
  bus: 7,
  tube: 6,
  train: 10, // platform / changeover
  flight: 75, // bag drop + security + boarding
  mixed: 5,
};

/** Buffer to transition from one mode to the next (the cost of catching `to`). */
export function connectionBufferMinutes(
  _from: TransitionMode,
  to: TransitionMode,
): number {
  return ACCESS_BUFFER[to] ?? 5;
}

/** Total door-to-door minutes: sub-leg time + inter-leg connection buffers. */
export function doorToDoorMinutes(option: DoorToDoorOption): number {
  return option.subLegs.reduce((total, leg, i) => {
    const buffer = i === 0 ? 0 : connectionBufferMinutes(option.subLegs[i - 1].mode, leg.mode);
    return total + leg.minutes + buffer;
  }, 0);
}

/** True if the option uses any excluded mode (→ it is removed, not down-ranked). */
export function isExcluded(
  option: DoorToDoorOption,
  excludedModes: ReadonlySet<TransitionMode>,
): boolean {
  return option.subLegs.some((l) => excludedModes.has(l.mode));
}

export type RankOpts = {
  /** Modes the user has ruled out — these options are filtered out entirely. */
  exclude?: Iterable<TransitionMode>;
};

/**
 * Rank viable options by door-to-door total (ascending). Exclusions filter first.
 * Ties broken by cost, then earliest arrival — never by a mode preference.
 */
export function rankByDoorToDoor<T extends DoorToDoorOption>(
  options: T[],
  opts: RankOpts = {},
): T[] {
  const excluded = new Set<TransitionMode>(opts.exclude ?? []);
  return options
    .filter((o) => !isExcluded(o, excluded))
    .map((o) => ({ o, d2d: doorToDoorMinutes(o) }))
    .sort((a, b) => {
      if (a.d2d !== b.d2d) return a.d2d - b.d2d;
      const ac = a.o.cost ?? Number.POSITIVE_INFINITY;
      const bc = b.o.cost ?? Number.POSITIVE_INFINITY;
      if (ac !== bc) return ac - bc;
      return (a.o.arrival ?? "").localeCompare(b.o.arrival ?? "");
    })
    .map((x) => x.o);
}

/** The top N fastest viable options for the ComparisonMatrix (default 4). */
export function topViable<T extends DoorToDoorOption>(
  options: T[],
  n = 4,
  opts: RankOpts = {},
): T[] {
  return rankByDoorToDoor(options, opts).slice(0, n);
}
