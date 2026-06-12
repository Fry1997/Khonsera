"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ActiveTile, Pass } from "@/components/concierge";
import type { ActiveUrgency } from "@/components/concierge/active-tile";
import type { AnchorVM, BoardingVM, TicketVM } from "@/components/concierge";
import { TodaySpine } from "@/components/today/today-spine";
import { NextLegMap } from "@/components/today/next-leg-map";
import { navModeForTransition, type SpineAnchor } from "@/components/today/spine-model";

// Staff-only day-of PREVIEW (demo mode, or /today?demo=1). Renders the real
// day-of components against a representative fixture — home (a base, no clock) →
// Luton → Wellingborough on the Corby train → a review.
//
// Feasibility model: leave-by is predicted forward from where you ACTUALLY are
// (the live route from your position to the next fixed point) for your preferred
// mode, and escalates through notification bands as the slack shrinks — never
// "you deviated", just "from here, leave in X". Two simulators stand in for
// sensors: a TIME slider (synthetic NOW) and a POSITION picker (sample places).
// NEVER on the product path.

// Neutral sample positions — no judgement, just "where you happen to be".
const POSITIONS = {
  home: { lat: 51.8176, lng: -0.354, name: "Home, Harpenden", label: "Home" },
  town: { lat: 51.7505, lng: -0.336, name: "In town, St Albans", label: "In town" },
  near: { lat: 51.879, lng: -0.41, name: "Near Luton station", label: "By the station" },
} as const;
type PosKey = keyof typeof POSITIONS;

const LUTON = { lat: 51.8821, lng: -0.4147 };
const WELLINGBOROUGH = { lat: 52.2962, lng: -0.6896 };

const DEP = 35; // train departs Luton (minutes from base)
const ARR = 60;
const REVIEW = 85;
const STATION_BUFFER = 8;

// Preferred-mode options for the inter-point leg, in intention order.
const MODES = [
  { key: "walk", label: "Walk", verb: "walk it" },
  { key: "cycle", label: "Cycle", verb: "cycle it" },
  { key: "taxi", label: "Taxi", verb: "taxi it" },
  { key: "drive", label: "Drive", verb: "drive it" },
] as const;
type ModeKey = (typeof MODES)[number]["key"];

const londonClock = (ms: number) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ms));

export function TodayDemo() {
  const [base] = useState(() => Date.now());
  const [offset, setOffset] = useState(0); // minutes added to NOW by the time slider
  const [mode, setMode] = useState<ModeKey>("taxi");
  const [pos, setPos] = useState<PosKey>("home");
  const [routeSeconds, setRouteSeconds] = useState<number | null>(null); // live route from actual position

  const now = base + offset * 60_000;
  const at = useMemo(() => (min: number) => new Date(base + min * 60_000).toISOString(), [base]);

  const depMs = base + DEP * 60_000;
  const arrMs = base + ARR * 60_000;
  const reviewMs = base + REVIEW * 60_000;

  const origin = POSITIONS[pos];

  // Leave-by is predicted from where you ACTUALLY are: the live route duration
  // for the preferred mode → latest-leave → slack.
  const liveMin = routeSeconds != null ? Math.max(1, Math.round(routeSeconds / 60)) : null;
  const leaveByMs = liveMin != null ? depMs - (liveMin + STATION_BUFFER) * 60_000 : null;
  const slackMin = leaveByMs != null ? Math.round((leaveByMs - now) / 60_000) : null;

  const ticket: TicketVM = useMemo(
    () => ({
      id: "demo-luton",
      kind: "rail",
      operator: "East Midlands Railway",
      reference: "AB12CD34",
      source: "forwarded",
      consequence: "The Corby train is the one that drops you a short walk from the review.",
      legs: [
        {
          id: "demo-luton-leg",
          origin: { place: "Luton", code: "LUT", time: at(DEP), platform: "2" },
          destination: { place: "Wellingborough", code: "WEL", time: at(ARR) },
          durationMinutes: 25,
          travelClass: "Standard",
          ticketType: "Off-Peak Day Single",
          coach: "B",
          seat: "24 (table)",
          barcodes: [{ format: "aztec", value: "RSP-DEMO-AZTEC-PAYLOAD", passengerLabel: "Adult 1" }],
          status: { status: "on_time" },
        },
      ],
    }),
    [at],
  );

  const boarding: BoardingVM = {
    platform: "2",
    toward: "Corby",
    earlier: "Platform 2 also has the 16:58 to Bedford before yours — let that one go.",
  };

  const walk = navModeForTransition("walk");
  const spineAnchors: SpineAnchor[] = useMemo(
    () => [
      { id: "demo-luton", type: "transport_arrival", title: "Luton Station", arriveByIso: at(DEP), endIso: at(DEP), coord: LUTON, plannedTravelMinutes: liveMin ?? 16, navMode: navModeForTransition(mode), station: { name: "Luton", code: "LUT", kind: "rail_station" }, role: "departure" },
      { id: "demo-welly", type: "transport_arrival", title: "Wellingborough Station", arriveByIso: at(ARR), endIso: at(ARR), coord: WELLINGBOROUGH, plannedTravelMinutes: 25, navMode: walk, station: { name: "Wellingborough", code: "WEL", kind: "rail_station" }, role: "arrival" },
      { id: "demo-review", type: "appointment", title: "Project review", place: "Wellingborough", arriveByIso: at(REVIEW), endIso: at(REVIEW + 60), coord: WELLINGBOROUGH, plannedTravelMinutes: 8, navMode: walk, station: null, role: "stop" },
    ],
    [at, walk, liveMin, mode],
  );

  const nextSpine = spineAnchors.find((a) => a.arriveByIso && new Date(a.arriveByIso).getTime() > now) ?? null;
  const nextAnchor: AnchorVM | undefined = nextSpine
    ? { id: nextSpine.id, type: nextSpine.type, title: nextSpine.title, place: nextSpine.place, time: nextSpine.arriveByIso ? { from: nextSpine.arriveByIso } : undefined, fixed: true }
    : undefined;

  const beforeDeparture = now < depMs;
  const headline = now >= reviewMs ? "You're here" : now >= depMs && now < arrMs ? "On your way" : "Getting you ready";

  // Urgency is the feasibility band for the preferred mode.
  let urgency: ActiveUrgency = "comfortable";
  if (beforeDeparture && slackMin != null) {
    if (slackMin <= 5) urgency = "breach";
    else if (slackMin <= 20) urgency = "urgent";
  }

  return (
    <div className="cc-screen">
      <header>
        <span className="cc-eyebrow" style={{ color: "var(--gold-2)" }}>
          Personal · Today · Preview
        </span>
        <h1 className="cc-screen-title" style={{ marginTop: 6 }}>
          Right now
        </h1>
      </header>

      <Simulators now={now} offset={offset} onOffset={setOffset} pos={pos} onPos={setPos} />

      <ActiveTile
        headline={headline}
        sub="Project review · from home, Harpenden"
        nextAnchor={nextAnchor}
        leaveBy={beforeDeparture && leaveByMs != null ? new Date(leaveByMs).toISOString() : undefined}
        urgency={urgency}
      />

      {beforeDeparture ? (
        <MovePicker mode={mode} onMode={setMode} slackMin={slackMin} leaveByMs={leaveByMs} depMs={depMs}>
          <NextLegMap origin={origin} destination={{ ...LUTON, name: "Luton Station" }} mode={navModeForTransition(mode)} preview onRoute={(r) => setRouteSeconds(r.duration_s)} />
        </MovePicker>
      ) : null}

      {now < arrMs ? (
        <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <span className="cc-eyebrow" style={{ color: "var(--gold-2)" }}>
            Ready when you are
          </span>
          <Pass ticket={ticket} boarding={boarding} />
        </section>
      ) : null}

      <TodaySpine anchors={spineAnchors} nextId={nextSpine?.id ?? null} nowOverride={now} />

      <p style={{ fontSize: "var(--fs-micro)", color: "var(--ink-dim)", marginTop: "var(--space-2)" }}>
        Sample day for design review — not your real plan. On the day, leave-by predicts from your
        live GPS and the platform/train come from National Rail.
      </p>
    </div>
  );
}

// The preferred-mode feasibility line: from where you are, leave in X — banded
// from quiet → leave-now, then escalation when the preferred mode runs out of
// road. Swapping mode re-routes and re-times.
function MovePicker({ mode, onMode, slackMin, leaveByMs, depMs, children }: { mode: ModeKey; onMode: (m: ModeKey) => void; slackMin: number | null; leaveByMs: number | null; depMs: number; children?: ReactNode }) {
  const m = MODES.find((x) => x.key === mode)!;
  let line: string;
  if (slackMin == null || leaveByMs == null) {
    line = "Working out the time from where you are…";
  } else if (slackMin < 0) {
    line = `Too tight to ${m.verb} from here — switch to a faster option above, or catch the next train.`;
  } else if (slackMin <= 5) {
    line = `Leave now to ${m.verb} — ${londonClock(leaveByMs)} at the latest for the ${londonClock(depMs)}.`;
  } else if (slackMin <= 20) {
    line = `Time to head off — leave by ${londonClock(leaveByMs)} (${slackMin} min) to ${m.verb} for the ${londonClock(depMs)}.`;
  } else {
    line = `No rush — leave by ${londonClock(leaveByMs)} (${slackMin} min) to ${m.verb} for the ${londonClock(depMs)}.`;
  }
  return (
    <section className="cc-active-tile" data-urgency={slackMin != null && slackMin <= 5 ? "breach" : slackMin != null && slackMin <= 20 ? "urgent" : "comfortable"} style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <span className="cc-eyebrow">Getting to Luton</span>
      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
        {MODES.map((x) => (
          <button key={x.key} type="button" className={x.key === mode ? "cc-btn cc-btn-gold" : "cc-btn"} style={{ fontSize: "var(--fs-label)" }} onClick={() => onMode(x.key)}>
            {x.label}
          </button>
        ))}
      </div>
      <p style={{ margin: 0, fontFamily: "var(--serif)", fontStyle: "italic", fontSize: "var(--fs-body)", color: "var(--ink)" }}>{line}</p>
      {children}
    </section>
  );
}

// Demo-only sensor stand-ins: scrub synthetic NOW across the day, and choose
// where you happen to be — so the feasibility behaviour is reviewable from a desk.
function Simulators({ now, offset, onOffset, pos, onPos }: { now: number; offset: number; onOffset: (n: number) => void; pos: PosKey; onPos: (p: PosKey) => void }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", padding: "var(--space-3) var(--space-4)", background: "var(--card-2, var(--card))", border: "1px dashed var(--rule)", borderRadius: "var(--radius-md)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-3)" }}>
        <span className="cc-eyebrow">Demo time</span>
        <span style={{ fontFamily: "var(--mono)", fontSize: "var(--fs-h3)", color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{londonClock(now)}</span>
        <input type="range" min={-180} max={240} step={5} value={offset} onChange={(e) => onOffset(Number(e.target.value))} style={{ flex: 1, minWidth: 120, accentColor: "var(--gold)" }} aria-label="Move the demo clock" />
        <span style={{ display: "inline-flex", gap: 4 }}>
          {[-30, -5, 5, 30].map((d) => (
            <button key={d} type="button" className="cc-btn" style={{ fontSize: "var(--fs-label)", padding: "2px 8px" }} onClick={() => onOffset(offset + d)}>
              {d > 0 ? `+${d}` : d}
            </button>
          ))}
          <button type="button" className="cc-btn" style={{ fontSize: "var(--fs-label)", padding: "2px 8px" }} onClick={() => onOffset(0)}>
            Now
          </button>
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-2)" }}>
        <span className="cc-eyebrow">Your position</span>
        {(Object.keys(POSITIONS) as PosKey[]).map((k) => (
          <button key={k} type="button" className={k === pos ? "cc-btn cc-btn-gold" : "cc-btn"} style={{ fontSize: "var(--fs-label)" }} onClick={() => onPos(k)}>
            {POSITIONS[k].label}
          </button>
        ))}
      </div>
    </section>
  );
}
