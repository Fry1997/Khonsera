import type { PatternMatch } from "./types";
import { recogniseDates } from "./dates";
import { recogniseTimes } from "./times";
import { recogniseMoney } from "./money";
import { recogniseDurations } from "./duration";
import { recogniseParty } from "./party";
import { recognisePeople } from "./people";

export type { PatternMatch } from "./types";

export interface PatternBundle {
  dates: PatternMatch[];
  times: PatternMatch[];
  money: PatternMatch[];
  durations: PatternMatch[];
  party: PatternMatch[];
  people: PatternMatch[];
  all: PatternMatch[];
}

// Runs every Layer-5 recogniser. `ref` is the reference instant for relative
// dates (the user's local "now"). Each recogniser is isolated so one failure
// degrades that pattern type without crashing the rest (brief §17).
export function recognisePatterns(input: string, ref: Date): PatternBundle {
  const safe = <T>(fn: () => T[]): T[] => {
    try {
      return fn();
    } catch {
      return [];
    }
  };
  const dates = safe(() => recogniseDates(input, ref));
  const times = safe(() => recogniseTimes(input, ref));
  const money = safe(() => recogniseMoney(input));
  const durations = safe(() => recogniseDurations(input));
  const party = safe(() => recogniseParty(input));
  const people = safe(() => recognisePeople(input));
  return {
    dates,
    times,
    money,
    durations,
    party,
    people,
    all: [...dates, ...times, ...money, ...durations, ...party, ...people],
  };
}
