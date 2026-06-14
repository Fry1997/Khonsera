// Contextual engine (Phase 12) — the care layer's brain. A live signal meets a
// fixed-threshold condition and, if it matters, produces a PROPOSED action the
// traveller can confirm. Never auto-inserted, never learned: thresholds are
// sensible defaults (overridable per-plan, not adapted behind your back). Pure
// and signal-agnostic — the server reader feeds it weather + buffer facts; this
// just decides. Unit-tested.
//
// Each rule is a small pure function returning a Nudge or null. `evaluateContext`
// runs them and returns the surfaced set (most-urgent first). Adding a rule =
// adding a function + a line in evaluateContext — the framework the later L4/L5
// rules (lounge, parking, gate-change) slot straight into.

export type NudgeUrgency = "info" | "soon" | "now";

// The proposed action carried by a nudge — a discriminated union so the confirm
// handler + the later booking framework (P14) can act on it precisely.
export type NudgeAction =
  | { kind: "leave-earlier"; minutes: number; reason: string }
  | { kind: "expedite-security"; airport: string; provider: "dragonpass" };

export type Nudge = {
  key: string; // stable per (rule, subject) so a verdict persists across reloads
  rule: string;
  message: string; // Khonsera voice, no emoji
  actionLabel?: string;
  action?: NudgeAction;
  urgency: NudgeUrgency;
};

// ───────────────────────── shared time helpers ─────────────────────────
function ms(iso: string): number {
  return new Date(iso).getTime();
}
function clock(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date(iso));
}
// How urgent is a prompt about something happening at `whenIso`, seen `nowIso`?
function urgencyFor(whenIso: string, nowIso: string): NudgeUrgency {
  const mins = (ms(whenIso) - ms(nowIso)) / 60_000;
  if (mins <= 45) return "now";
  if (mins <= 180) return "soon";
  return "info";
}

// ───────────────────────── weather → leave earlier ─────────────────────────

// The corridor weather summary the Open-Meteo adapter produces for a leg's
// travel window. `severity` is the worst condition crossed.
export type CorridorWeather = {
  severity: "none" | "moderate" | "severe";
  headline: string; // "Heavy rain", "Snow", "Strong gusts" — already human
  maxPrecipMm: number;
  maxGustKmh: number;
  snow: boolean;
};

export type WeatherLegInput = {
  legId: string;
  mode: string; // drive | walk | taxi | …
  toLabel: string;
  departIso: string;
  weather: CorridorWeather;
};

// Defaults: how much earlier to leave for a given severity + mode. Roads slow
// most in bad weather, so driving gets the bigger margin; a walk a smaller one.
const LEAVE_EARLIER_MIN: Record<"moderate" | "severe", Record<"road" | "foot", number>> = {
  moderate: { road: 10, foot: 5 },
  severe: { road: 20, foot: 10 },
};
const ROAD_MODES = new Set(["drive", "taxi", "bus"]);

export function weatherLeaveEarlier(input: WeatherLegInput, nowIso: string): Nudge | null {
  const { weather } = input;
  if (weather.severity === "none") return null; // only speak when there's weather
  const surface = ROAD_MODES.has(input.mode) ? "road" : "foot";
  const minutes = LEAVE_EARLIER_MIN[weather.severity][surface];
  const reason = `${weather.headline.toLowerCase()} on your way to ${input.toLabel}`;
  return {
    key: `weather:${input.legId}`,
    rule: "weather-leave-earlier",
    message:
      `${weather.headline} forecast on your ${ROAD_MODES.has(input.mode) ? "drive" : "way"} to ${input.toLabel} around ${clock(input.departIso)}. ` +
      `It slows the going — leaving ${minutes} minutes earlier keeps your arrival comfortable.`,
    actionLabel: `Leave ${minutes} min earlier`,
    action: { kind: "leave-earlier", minutes, reason },
    urgency: urgencyFor(input.departIso, nowIso),
  };
}

// ───────────────────────── running late → expedite security ─────────────────────────

// The buffer baseline: time in hand at the airport before the flight, and the
// safe minimum below which security is a real risk. No live-queue feed yet — the
// thinness of the buffer IS the signal (capability map: buffer-baseline day one).
export type FlightBufferInput = {
  flightStopId: string;
  airport: string; // "Gatwick (LGW)"
  flightDepartIso: string;
  arriveAirportIso: string; // when the plan gets you to the airport
};

// Default safe buffer before a (domestic/short-haul) departure. Below this,
// security is the pinch-point the flagship rule protects.
const SAFE_AIRPORT_BUFFER_MIN = 75;

export function runningLateExpedite(input: FlightBufferInput, nowIso: string): Nudge | null {
  const bufferMin = Math.round((ms(input.flightDepartIso) - ms(input.arriveAirportIso)) / 60_000);
  if (bufferMin >= SAFE_AIRPORT_BUFFER_MIN) return null; // enough time — stay quiet
  if (bufferMin < 0) return null; // already past departure — recovery's job, not a nudge
  return {
    key: `expedite:${input.flightStopId}`,
    rule: "running-late-expedite",
    message:
      `Your buffer at ${input.airport} is thin — about ${bufferMin} min on the ground before your ${clock(input.flightDepartIso)} flight. ` +
      `A fast-track slot through security protects it.`,
    actionLabel: "Get fast-track",
    action: { kind: "expedite-security", airport: input.airport, provider: "dragonpass" },
    urgency: urgencyFor(input.flightDepartIso, nowIso),
  };
}

// ───────────────────────── the framework ─────────────────────────

export type ContextInputs = {
  nowIso: string;
  weatherLegs: WeatherLegInput[];
  flightBuffers: FlightBufferInput[];
};

const URGENCY_RANK: Record<NudgeUrgency, number> = { now: 0, soon: 1, info: 2 };

/** Run every rule over its signals; return the surfaced nudges, most-urgent
 *  first. Pure — persistence/filtering of accepted/dismissed verdicts happens in
 *  the action layer that calls this. */
export function evaluateContext(inputs: ContextInputs): Nudge[] {
  const out: Nudge[] = [];
  for (const leg of inputs.weatherLegs) {
    const n = weatherLeaveEarlier(leg, inputs.nowIso);
    if (n) out.push(n);
  }
  for (const fb of inputs.flightBuffers) {
    const n = runningLateExpedite(fb, inputs.nowIso);
    if (n) out.push(n);
  }
  return out.sort((a, b) => URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency]);
}
