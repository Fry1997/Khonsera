// Live spine engine (Phase 9) — pure, signal-agnostic. The day-of arithmetic the
// concierge does so you don't: the decision-clock ("act by HH:MM"), and
// consequence translation ("delayed 12 min → you'll miss the 09:40 → act by 09:12").
// No I/O — fed normalized connections by the server reader, which sources the
// live perturbation from Darwin (rail) or TfL (line status). Unit-tested.

export type ConnectionKind = "connection" | "commitment";

export type Connection = {
  id: string;
  // What you're heading into: "the 09:40 to Derby" (a hard onward service) or
  // "your 10:00 meeting" (a commitment that can run late but shouldn't).
  intoName: string;
  arriveIso: string; // planned arrival into the connection/commitment point
  deadlineIso: string; // the onward departs / you must be there by
  kind: ConnectionKind;
};

function ms(iso: string): number {
  return new Date(iso).getTime();
}
function addMin(iso: string, min: number): string {
  return new Date(ms(iso) + min * 60_000).toISOString();
}
function minsBetween(fromIso: string, toIso: string): number {
  return Math.round((ms(toIso) - ms(fromIso)) / 60_000);
}
function clock(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date(iso));
}

// Slack into a connection: how many minutes spare between planned arrival and the
// deadline. Negative = you don't make it as planned.
export function slackMinutes(c: Connection): number {
  return minsBetween(c.arriveIso, c.deadlineIso);
}

export type DecisionClock = { actByIso: string; actByLabel: string; for: string; tight: boolean } | null;

// The day's decision-clock: the soonest deadline you're still in front of — the
// single "act by" that matters most right now. `tight` when slack is thin.
export function decisionClock(connections: Connection[], nowIso: string, tightThreshold = 15): DecisionClock {
  const now = ms(nowIso);
  const upcoming = connections
    .filter((c) => ms(c.deadlineIso) > now)
    .sort((a, b) => ms(a.deadlineIso) - ms(b.deadlineIso));
  if (upcoming.length === 0) return null;
  // The most pressing: the one whose deadline is nearest *and* slack is thinnest.
  const c = upcoming.reduce((worst, x) => (slackMinutes(x) < slackMinutes(worst) ? x : worst), upcoming[0]);
  return {
    actByIso: c.deadlineIso,
    actByLabel: clock(c.deadlineIso),
    for: c.intoName,
    tight: slackMinutes(c) <= tightThreshold,
  };
}

export type Consequence = {
  lateMin: number; // projected minus deadline (positive = late/missed)
  broken: boolean;
  text: string;
  actByIso?: string; // the latest you can still decide before the option is lost
  actByLabel?: string;
};

// Translate a live delay on a connection into its consequence — the sentence the
// app says so you don't do the arithmetic under pressure.
export function delayConsequence(c: Connection, delayMin: number): Consequence {
  const projected = addMin(c.arriveIso, delayMin);
  const lateMin = minsBetween(c.deadlineIso, projected); // projected - deadline
  const broken = lateMin > 0;
  if (!broken) {
    const spare = -lateMin;
    return {
      lateMin,
      broken: false,
      text: delayMin > 0
        ? `Delayed ${delayMin} min — still fine for ${c.intoName}, ${spare} min spare.`
        : `On time for ${c.intoName}, ${spare} min spare.`,
    };
  }
  // Broken: the act-by is the deadline itself — the moment the option is lost.
  const text = c.kind === "connection"
    ? `Delayed ${delayMin} min — you'll miss ${c.intoName} (by ${lateMin} min). Act by ${clock(c.deadlineIso)}.`
    : `Delayed ${delayMin} min — you'll be ${lateMin} min late for ${c.intoName}. Decide by ${clock(c.deadlineIso)}.`;
  return { lateMin, broken: true, text, actByIso: c.deadlineIso, actByLabel: clock(c.deadlineIso) };
}

// Cascade a delay across an ordered chain of connections: each broken hard
// connection cascades its lateness onward (a missed train delays everything after
// it). Returns the per-connection consequence, worst-first.
export function cascade(connections: Connection[], firstLegDelayMin: number): Consequence[] {
  let carried = firstLegDelayMin;
  const out: Consequence[] = [];
  for (const c of connections) {
    const con = delayConsequence(c, carried);
    out.push(con);
    // A missed hard connection carries its lateness on; a late-but-soft commitment
    // doesn't compound (you arrive late, the rest of the day is unaffected in time).
    carried = con.broken && c.kind === "connection" ? con.lateMin : Math.max(0, carried);
  }
  return out.sort((a, b) => b.lateMin - a.lateMin);
}

// Fragility (Phase 10): is the day one delay from collapse? A plan is fragile when
// its thinnest connection has little or no slack to absorb a delay. Surfaced as a
// calm "add a buffer while you can", not an alarm.
export type Fragility = { fragile: boolean; weakestSlackMin: number | null };

export function fragility(slacksMin: number[], threshold = 10): Fragility {
  if (slacksMin.length === 0) return { fragile: false, weakestSlackMin: null };
  const weakest = Math.min(...slacksMin);
  return { fragile: weakest <= threshold, weakestSlackMin: weakest };
}
