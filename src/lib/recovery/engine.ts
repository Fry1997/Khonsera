// Recovery engine (Phase 11) — when the day breaks, compute the way out. Pure
// and signal-agnostic: fed candidate ways-out (replacement services, a taxi…)
// by the providers, it evaluates each against the commitment you're trying to
// protect and produces the consequence band — what each option does to your day.
//
// PROTECT-TARGET (open founder decision): until it's set we present the
// TRADE-OFF, not a ranking — options soonest-arrival-first (a neutral order),
// each with its honest impact. When a protect-target is chosen, `rankFor`
// reorders by it. We never silently pick for the user.

export type RecoveryMode = "rail" | "tube" | "bus" | "taxi" | "walk" | "mixed";

export type RecoveryCandidate = {
  id: string;
  label: string; // "11:10 to Derby" · "Taxi"
  mode: RecoveryMode;
  departIso: string;
  arriveIso: string; // when this gets you to the commitment point
  changes?: number;
  note?: string; // "via Leicester" · "~£42"
};

export type RecoveryOption = RecoveryCandidate & {
  intoLateMin: number; // arrival minus the deadline (negative = time to spare)
  makesIt: boolean;
  consequence: string;
};

function ms(iso: string): number {
  return new Date(iso).getTime();
}
function minsBetween(fromIso: string, toIso: string): number {
  return Math.round((ms(toIso) - ms(fromIso)) / 60_000);
}
function clock(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date(iso));
}

export type ProtectTarget = "earliest-arrival" | "protect-return" | "least-disruption";

export type Commitment = { name: string; byIso: string };

/** Evaluate each candidate against the commitment to protect; trade-off order
 *  (soonest arrival) by default — neutral until a protect-target is set. */
export function buildRecoveryOptions(
  candidates: RecoveryCandidate[],
  commitment: Commitment | null,
): RecoveryOption[] {
  return candidates
    .map((c): RecoveryOption => {
      if (!commitment) {
        return { ...c, intoLateMin: 0, makesIt: true, consequence: `Arrives ${clock(c.arriveIso)}` };
      }
      const lateMin = minsBetween(commitment.byIso, c.arriveIso);
      const makesIt = lateMin <= 0;
      const consequence = makesIt
        ? `Makes your ${commitment.name}${lateMin < 0 ? `, ${-lateMin} min to spare` : " (just)"}`
        : `Reaches your ${commitment.name} ${lateMin} min late`;
      return { ...c, intoLateMin: lateMin, makesIt, consequence };
    })
    .sort((a, b) => ms(a.arriveIso) - ms(b.arriveIso));
}

/** Reorder once a protect-target is chosen. Until then, callers show the
 *  trade-off (buildRecoveryOptions order) and DON'T call this. */
export function rankFor(options: RecoveryOption[], target: ProtectTarget): RecoveryOption[] {
  const sorted = [...options];
  if (target === "earliest-arrival") {
    sorted.sort((a, b) => ms(a.arriveIso) - ms(b.arriveIso));
  } else if (target === "least-disruption") {
    // The one that gets you there on time with the least fuss (makes-it first,
    // then fewest changes, then soonest).
    sorted.sort((a, b) =>
      Number(b.makesIt) - Number(a.makesIt) || (a.changes ?? 0) - (b.changes ?? 0) || ms(a.arriveIso) - ms(b.arriveIso),
    );
  } else {
    // protect-return: prefer options that make the commitment, then earliest —
    // the return-pairing weight is applied by the caller that knows the return.
    sorted.sort((a, b) => Number(b.makesIt) - Number(a.makesIt) || ms(a.arriveIso) - ms(b.arriveIso));
  }
  return sorted;
}
