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
  // The outbound+return booking is ONE unit (P11). When a return is booked
  // downstream, a way-out that lands you after it has left strands you / wastes
  // the ticket — say so plainly. Silent (undefined) when the return is safe:
  // consequence in ink only when there's a consequence.
  returnNote?: string;
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

/** A booked return service the outbound shares a trip with. A way-out that
 *  arrives at the destination after this has departed leaves you stranded with
 *  a wasted ticket — the pair is one unit, so we surface that on every option. */
export type ReturnLeg = { label: string; departIso: string };

/** Evaluate each candidate against the commitment to protect; trade-off order
 *  (soonest arrival) by default — neutral until a protect-target is set. When a
 *  booked return is given, each option also carries the return's impact. */
export function buildRecoveryOptions(
  candidates: RecoveryCandidate[],
  commitment: Commitment | null,
  protectedReturn?: ReturnLeg | null,
): RecoveryOption[] {
  return candidates
    .map((c): RecoveryOption => {
      const returnNote = returnImpact(c.arriveIso, protectedReturn);
      if (!commitment) {
        return { ...c, intoLateMin: 0, makesIt: true, consequence: `Arrives ${clock(c.arriveIso)}`, returnNote };
      }
      const lateMin = minsBetween(commitment.byIso, c.arriveIso);
      const makesIt = lateMin <= 0;
      const consequence = makesIt
        ? `Makes your ${commitment.name}${lateMin < 0 ? `, ${-lateMin} min to spare` : " (just)"}`
        : `Reaches your ${commitment.name} ${lateMin} min late`;
      return { ...c, intoLateMin: lateMin, makesIt, consequence, returnNote };
    })
    .sort((a, b) => ms(a.arriveIso) - ms(b.arriveIso));
}

/** The return is only worth speaking about when it's threatened: a way-out that
 *  gets you in after the return has left wastes the trip. Otherwise stay quiet. */
function returnImpact(arriveIso: string, protectedReturn?: ReturnLeg | null): string | undefined {
  if (!protectedReturn) return undefined;
  const slack = minsBetween(arriveIso, protectedReturn.departIso); // +ve = return still ahead
  if (slack < 0) return `Lands after your ${protectedReturn.label} return — the trip's lost`;
  if (slack <= 20) return `Only ${slack} min to turn around for your ${protectedReturn.label} return`;
  return undefined;
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
