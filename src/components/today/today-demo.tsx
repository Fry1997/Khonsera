"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ActiveTile, Pass } from "@/components/concierge";
import type { ActiveUrgency } from "@/components/concierge/active-tile";
import type { AnchorVM, BoardingVM, TicketVM } from "@/components/concierge";
import { TodaySpine } from "@/components/today/today-spine";
import { NextLegMap } from "@/components/today/next-leg-map";
import { navModeForTransition, type SpineAnchor } from "@/components/today/spine-model";
import { haversineMeters, formatMiles } from "@/lib/geo";

// Staff-only day-of PREVIEW (demo mode, or /today?demo=1). Renders the real
// day-of components against a representative fixture — home (a base, no clock) →
// Luton → Wellingborough on the Corby train → a review — so the boarding
// callout, leave-by, mode-swap, off-plan detection and inline nav can be
// reviewed without a real journey.
//
// Two simulators stand in for sensors: a TIME slider (synthetic NOW) and a
// LOCATION toggle (on-plan vs wandered off) — because the real value is "predict
// from where you actually are", which we can't feel from a desk. NEVER on the
// product path.

const HARPENDEN = { lat: 51.8176, lng: -0.354, name: "Home, Harpenden" }; // base / expected
const WANDERED = { lat: 51.7505, lng: -0.336, name: "Where you are" }; // ~5 km off, "walked off"
const LUTON = { lat: 51.8821, lng: -0.4147 };
const WELLINGBOROUGH = { lat: 52.2962, lng: -0.6896 };

const DEP = 35; // train departs Luton (minutes from base)
const ARR = 60;
const REVIEW = 85;
const STATION_BUFFER = 8;

// The PLAN's door-to-door assumption from home (minutes) — what leave-by was
// built on. The live route from your actual location overrides it on the day.
const MODES = [
  { key: "walk", label: "Walk", minutes: 95 },
  { key: "cycle", label: "Cycle", minutes: 32 },
  { key: "taxi", label: "Taxi", minutes: 16 },
  { key: "drive", label: "Drive", minutes: 14 },
] as const;
type ModeKey = (typeof MODES)[number]["key"];

const londonClock = (ms: number) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ms));

export function TodayDemo() {
  const [base] = useState(() => Date.now());
  const [offset, setOffset] = useState(0); // minutes added to NOW by the time slider
  const [mode, setMode] = useState<ModeKey>("taxi");
  const [where, setWhere] = useState<"home" | "away">("home");
  const [routeSeconds, setRouteSeconds] = useState<number | null>(null); // live route from actual location

  const now = base + offset * 60_000;
  const at = useMemo(() => (min: number) => new Date(base + min * 60_000).toISOString(), [base]);

  const depMs = base + DEP * 60_000;
  const arrMs = base + ARR * 60_000;
  const reviewMs = base + REVIEW * 60_000;

  const origin = where === "home" ? HARPENDEN : WANDERED;
  const deviationM = haversineMeters(origin.lat, origin.lng, HARPENDEN.lat, HARPENDEN.lng);
  const offPlan = deviationM > 200;

  // Leave-by is predicted from where you ACTUALLY are: the live route duration
  // wins; the plan's assumption is the fallback (and the comparison baseline).
  const plannedMin = MODES.find((m) => m.key === mode)!.minutes;
  const liveMin = routeSeconds != null ? Math.max(1, Math.round(routeSeconds / 60)) : null;
  const effectiveMin = liveMin ?? plannedMin;
  const leaveByMs = depMs - (effectiveMin + STATION_BUFFER) * 60_000;
  const plannedLeaveByMs = depMs - (plannedMin + STATION_BUFFER) * 60_000;
  const deltaMin = Math.round((plannedLeaveByMs - leaveByMs) / 60_000); // +ve → must leave earlier

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
      { id: "demo-luton", type: "transport_arrival", title: "Luton Station", arriveByIso: at(DEP), endIso: at(DEP), coord: LUTON, plannedTravelMinutes: effectiveMin, navMode: navModeForTransition(mode), station: { name: "Luton", code: "LUT", kind: "rail_station" }, role: "departure" },
      { id: "demo-welly", type: "transport_arrival", title: "Wellingborough Station", arriveByIso: at(ARR), endIso: at(ARR), coord: WELLINGBOROUGH, plannedTravelMinutes: 25, navMode: walk, station: { name: "Wellingborough", code: "WEL", kind: "rail_station" }, role: "arrival" },
      { id: "demo-review", type: "appointment", title: "Project review", place: "Wellingborough", arriveByIso: at(REVIEW), endIso: at(REVIEW + 60), coord: WELLINGBOROUGH, plannedTravelMinutes: 8, navMode: walk, station: null, role: "stop" },
    ],
    [at, walk, effectiveMin, mode],
  );

  const nextSpine = spineAnchors.find((a) => a.arriveByIso && new Date(a.arriveByIso).getTime() > now) ?? null;
  const nextAnchor: AnchorVM | undefined = nextSpine
    ? { id: nextSpine.id, type: nextSpine.type, title: nextSpine.title, place: nextSpine.place, time: nextSpine.arriveByIso ? { from: nextSpine.arriveByIso } : undefined, fixed: true }
    : undefined;

  const beforeDeparture = now < depMs;
  const headline = now >= reviewMs ? "You're here" : now >= depMs && now < arrMs ? "On your way" : "Getting you ready";
  const minsToNext = nextSpine?.arriveByIso ? Math.round((new Date(nextSpine.arriveByIso).getTime() - now) / 60_000) : null;
  const urgency: ActiveUrgency = offPlan && beforeDeparture ? "breach" : minsToNext != null && minsToNext >= 0 && minsToNext <= 20 ? "urgent" : "comfortable";

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

      <Simulators now={now} offset={offset} onOffset={setOffset} where={where} onWhere={setWhere} />

      <ActiveTile
        headline={headline}
        sub="Project review · from home, Harpenden"
        nextAnchor={nextAnchor}
        leaveBy={beforeDeparture ? new Date(leaveByMs).toISOString() : undefined}
        urgency={urgency}
      />

      {offPlan && beforeDeparture ? (
        <section
          style={{
            padding: "var(--space-3) var(--space-4)",
            background: "var(--amber-soft)",
            borderLeft: "3px solid var(--amber)",
            borderRadius: "var(--radius-md)",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <span className="cc-eyebrow" style={{ color: "var(--amber)" }}>
            You&apos;ve moved off plan
          </span>
          <p style={{ margin: 0, fontSize: "var(--fs-body)", color: "var(--ink)" }}>
            You&apos;re {formatMiles(deviationM)} from where your plan expects you. From here you need to
            leave by{" "}
            <span style={{ fontFamily: "var(--mono)", color: "var(--ink)" }}>{londonClock(leaveByMs)}</span> for the{" "}
            {londonClock(depMs)}
            {deltaMin > 0 ? ` — ${deltaMin} min earlier than planned (${londonClock(plannedLeaveByMs)}).` : "."}
          </p>
        </section>
      ) : null}

      {beforeDeparture ? (
        <MovePicker mode={mode} onMode={setMode} travelMin={effectiveMin} live={liveMin != null} leaveByMs={leaveByMs} depMs={depMs}>
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

// Swap the inter-point travel mode and watch the leave-by move. The minutes are
// the live route from your actual location when available, the plan's estimate
// otherwise.
function MovePicker({ mode, onMode, travelMin, live, leaveByMs, depMs, children }: { mode: ModeKey; onMode: (m: ModeKey) => void; travelMin: number; live: boolean; leaveByMs: number; depMs: number; children?: ReactNode }) {
  return (
    <section className="cc-active-tile" data-urgency="comfortable" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <span className="cc-eyebrow">Getting to Luton</span>
      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
        {MODES.map((m) => (
          <button key={m.key} type="button" className={m.key === mode ? "cc-btn cc-btn-gold" : "cc-btn"} style={{ fontSize: "var(--fs-label)" }} onClick={() => onMode(m.key)}>
            {m.label}
          </button>
        ))}
      </div>
      <p style={{ margin: 0, fontFamily: "var(--serif)", fontStyle: "italic", fontSize: "var(--fs-body)", color: "var(--ink)" }}>
        {travelMin} min {live ? "from where you are" : "door-to-door"} + {STATION_BUFFER} min at the platform → leave by{" "}
        <span style={{ fontFamily: "var(--mono)", fontStyle: "normal", color: "var(--gold-2)" }}>{londonClock(leaveByMs)}</span> for the {londonClock(depMs)}.
      </p>
      {children}
    </section>
  );
}

// Demo-only sensor stand-ins: scrub synthetic NOW across the day, and toggle
// whether you're on-plan (at home) or wandered off — so the off-plan leave-by
// behaviour is reviewable from a desk.
function Simulators({ now, offset, onOffset, where, onWhere }: { now: number; offset: number; onOffset: (n: number) => void; where: "home" | "away"; onWhere: (w: "home" | "away") => void }) {
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
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        <span className="cc-eyebrow">You are</span>
        <button type="button" className={where === "home" ? "cc-btn cc-btn-gold" : "cc-btn"} style={{ fontSize: "var(--fs-label)" }} onClick={() => onWhere("home")}>
          On plan (home)
        </button>
        <button type="button" className={where === "away" ? "cc-btn cc-btn-gold" : "cc-btn"} style={{ fontSize: "var(--fs-label)" }} onClick={() => onWhere("away")}>
          Wandered off
        </button>
      </div>
    </section>
  );
}
