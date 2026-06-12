"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ActiveTile, Pass } from "@/components/concierge";
import type { ActiveUrgency } from "@/components/concierge/active-tile";
import type { AnchorVM, BoardingVM, TicketVM } from "@/components/concierge";
import { TodaySpine } from "@/components/today/today-spine";
import { NextLegMap } from "@/components/today/next-leg-map";
import { navModeForTransition, type SpineAnchor } from "@/components/today/spine-model";

const HARPENDEN = { lat: 51.8176, lng: -0.354, name: "Home, Harpenden" };

// Staff-only day-of PREVIEW (demo mode, or /today?demo=1). The real Today
// projects the DB and is empty without a live plan, so this renders the same
// day-of components against a representative fixture — home (a base, no clock) →
// Luton → Wellingborough on the Corby train → a review — so the boarding
// callout, the leave-by back-calc, mode-swap and reeling spine can be reviewed
// without a real journey.
//
// Time-travel: event times are pinned to a fixed `base`; the slider slides a
// synthetic NOW across the day so the spine reels and urgency changes live.
// NEVER on the product path.

const WELLINGBOROUGH = { lat: 52.2962, lng: -0.6896 };
const LUTON = { lat: 51.8821, lng: -0.4147 };

// Fixed event offsets (minutes from base).
const DEP = 35; // train departs Luton
const ARR = 60; // arrives Wellingborough
const REVIEW = 85; // project review
const STATION_BUFFER = 8; // minutes at the station before the train

// Door-to-door options for home → Luton station (the swappable inter-point leg).
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
  const [offset, setOffset] = useState(0); // minutes added to NOW by the slider
  const [mode, setMode] = useState<ModeKey>("taxi");
  const now = base + offset * 60_000;
  const at = useMemo(() => (min: number) => new Date(base + min * 60_000).toISOString(), [base]);

  const depMs = base + DEP * 60_000;
  const arrMs = base + ARR * 60_000;
  const reviewMs = base + REVIEW * 60_000;

  // Leave-by back-calculated from the train: departure − true travel − buffer.
  const travelMin = MODES.find((m) => m.key === mode)!.minutes;
  const leaveByMs = depMs - (travelMin + STATION_BUFFER) * 60_000;

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

  // Home is the BASE — no clock, it only carries the leave-by. The spine is the
  // chain of timed commitments: station → arrival → review.
  const walk = navModeForTransition("walk");
  const spineAnchors: SpineAnchor[] = useMemo(
    () => [
      { id: "demo-luton", type: "transport_arrival", title: "Luton Station", arriveByIso: at(DEP), endIso: at(DEP), coord: LUTON, plannedTravelMinutes: travelMin, navMode: navModeForTransition(mode), station: { name: "Luton", code: "LUT", kind: "rail_station" }, role: "departure" },
      { id: "demo-welly", type: "transport_arrival", title: "Wellingborough Station", arriveByIso: at(ARR), endIso: at(ARR), coord: WELLINGBOROUGH, plannedTravelMinutes: 25, navMode: walk, station: { name: "Wellingborough", code: "WEL", kind: "rail_station" }, role: "arrival" },
      { id: "demo-review", type: "appointment", title: "Project review", place: "Wellingborough", arriveByIso: at(REVIEW), endIso: at(REVIEW + 60), coord: WELLINGBOROUGH, plannedTravelMinutes: 8, navMode: walk, station: null, role: "stop" },
    ],
    [at, walk, travelMin, mode],
  );

  const nextSpine = spineAnchors.find((a) => a.arriveByIso && new Date(a.arriveByIso).getTime() > now) ?? null;
  const nextAnchor: AnchorVM | undefined = nextSpine
    ? { id: nextSpine.id, type: nextSpine.type, title: nextSpine.title, place: nextSpine.place, time: nextSpine.arriveByIso ? { from: nextSpine.arriveByIso } : undefined, fixed: true }
    : undefined;

  const beforeDeparture = now < depMs;
  const headline = now >= reviewMs ? "You're here" : now >= depMs && now < arrMs ? "On your way" : "Getting you ready";
  const minsToNext = nextSpine?.arriveByIso ? Math.round((new Date(nextSpine.arriveByIso).getTime() - now) / 60_000) : null;
  const urgency: ActiveUrgency = minsToNext != null && minsToNext >= 0 && minsToNext <= 20 ? "urgent" : "comfortable";

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

      <TimeTravel now={now} offset={offset} onOffset={setOffset} />

      <ActiveTile
        headline={headline}
        sub="Project review · from home, Harpenden"
        nextAnchor={nextAnchor}
        leaveBy={beforeDeparture ? new Date(leaveByMs).toISOString() : undefined}
        urgency={urgency}
      />

      {beforeDeparture ? (
        <MovePicker mode={mode} onMode={setMode} travelMin={travelMin} leaveByMs={leaveByMs} depMs={depMs}>
          <NextLegMap origin={HARPENDEN} destination={{ ...LUTON, name: "Luton Station" }} mode={navModeForTransition(mode)} preview />
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
        Sample day for design review — not your real plan. Live platform, the named train and the
        wrong-train guard populate from National Rail on a real journey.
      </p>
    </div>
  );
}

// Swap the inter-point travel mode and watch the leave-by move — faster mode,
// later you can leave. This is the day-of "alter my plan" the live page lacked.
function MovePicker({ mode, onMode, travelMin, leaveByMs, depMs, children }: { mode: ModeKey; onMode: (m: ModeKey) => void; travelMin: number; leaveByMs: number; depMs: number; children?: ReactNode }) {
  return (
    <section className="cc-active-tile" data-urgency="comfortable" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <span className="cc-eyebrow">Getting to Luton</span>
      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            className={m.key === mode ? "cc-btn cc-btn-gold" : "cc-btn"}
            style={{ fontSize: "var(--fs-label)" }}
            onClick={() => onMode(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p style={{ margin: 0, fontFamily: "var(--serif)", fontStyle: "italic", fontSize: "var(--fs-body)", color: "var(--ink)" }}>
        {travelMin} min door-to-door + {STATION_BUFFER} min at the platform → leave by{" "}
        <span style={{ fontFamily: "var(--mono)", fontStyle: "normal", color: "var(--gold-2)" }}>{londonClock(leaveByMs)}</span> for the{" "}
        {londonClock(depMs)}.
      </p>
      {children}
    </section>
  );
}

// The demo-only scrubber: move synthetic NOW across the day to watch the spine
// reel, the next-highlight advance and urgency change.
function TimeTravel({ now, offset, onOffset }: { now: number; offset: number; onOffset: (n: number) => void }) {
  return (
    <section
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "var(--space-3) var(--space-4)",
        background: "var(--card-2, var(--card))",
        border: "1px dashed var(--rule)",
        borderRadius: "var(--radius-md)",
      }}
    >
      <span className="cc-eyebrow">Demo time</span>
      <span style={{ fontFamily: "var(--mono)", fontSize: "var(--fs-h3)", color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
        {londonClock(now)}
      </span>
      <input
        type="range"
        min={-180}
        max={240}
        step={5}
        value={offset}
        onChange={(e) => onOffset(Number(e.target.value))}
        style={{ flex: 1, minWidth: 140, accentColor: "var(--gold)" }}
        aria-label="Move the demo clock"
      />
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
    </section>
  );
}
