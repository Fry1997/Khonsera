"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ActiveTile, Pass } from "@/components/concierge";
import type { ActiveUrgency } from "@/components/concierge/active-tile";
import type { AnchorVM, BoardingVM, TicketVM } from "@/components/concierge";
import { TodaySpine } from "@/components/today/today-spine";
import { navModeForTransition, type SpineAnchor } from "@/components/today/spine-model";

// Staff-only day-of PREVIEW (demo mode, or /today?demo=1). The real Today
// projects the DB and is empty without a live plan, so this renders the same
// day-of components against a representative fixture — Luton → Wellingborough on
// the Corby train — so the boarding callout, reeling spine and (as they land)
// calling points + changeover can be reviewed without a real journey.
//
// Time-travel: event times are pinned to a fixed `base`; the slider shifts a
// synthetic NOW across the day so the spine reels, the next-highlight moves and
// urgency changes, exactly as it would live. NEVER on the product path.

const LUTON = { lat: 51.8821, lng: -0.4147 };
const WELLINGBOROUGH = { lat: 52.2962, lng: -0.6896 };

// Fixed event offsets (minutes from base) — the shape of the sample afternoon.
const DEP = 25; // train departs Luton
const ARR = 50; // arrives Wellingborough
const REVIEW = 75; // project review

const londonClock = (ms: number) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ms));

export function TodayDemo() {
  const [base] = useState(() => Date.now());
  const [offset, setOffset] = useState(0); // minutes added to NOW by the slider
  const now = base + offset * 60_000;
  const at = useMemo(() => (min: number) => new Date(base + min * 60_000).toISOString(), [base]);

  const ticket: TicketVM = useMemo(
    () => ({
      id: "demo-luton",
      kind: "rail",
      operator: "East Midlands Railway",
      reference: "AB12CD34",
      source: "forwarded",
      consequence: "Off the 16:42 and you reach the review with fifteen minutes in hand.",
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
      { id: "demo-home", type: "custom", title: "Home", place: "Harpenden", arriveByIso: at(-130), endIso: at(-125), coord: null, plannedTravelMinutes: null, navMode: walk, station: null, role: "stop" },
      { id: "demo-coffee", type: "appointment", title: "Coffee with Sam", place: "St Albans", arriveByIso: at(-95), endIso: at(-75), coord: null, plannedTravelMinutes: null, navMode: walk, station: null, role: "stop" },
      { id: "demo-luton", type: "transport_arrival", title: "Luton Station", arriveByIso: at(DEP), endIso: at(DEP), coord: LUTON, plannedTravelMinutes: 12, navMode: walk, station: { name: "Luton", code: "LUT", kind: "rail_station" }, role: "departure" },
      { id: "demo-welly", type: "transport_arrival", title: "Wellingborough Station", arriveByIso: at(ARR), endIso: at(ARR), coord: WELLINGBOROUGH, plannedTravelMinutes: 25, navMode: walk, station: { name: "Wellingborough", code: "WEL", kind: "rail_station" }, role: "arrival" },
      { id: "demo-review", type: "appointment", title: "Project review", place: "Wellingborough", arriveByIso: at(REVIEW), endIso: at(REVIEW + 60), coord: WELLINGBOROUGH, plannedTravelMinutes: 8, navMode: walk, station: null, role: "stop" },
    ],
    [at, walk],
  );

  // The next anchor still ahead of synthetic NOW — drives the highlight + hero.
  const nextSpine = spineAnchors.find((a) => a.arriveByIso && new Date(a.arriveByIso).getTime() > now) ?? null;
  const nextAnchor: AnchorVM | undefined = nextSpine
    ? { id: nextSpine.id, type: nextSpine.type, title: nextSpine.title, place: nextSpine.place, time: nextSpine.arriveByIso ? { from: nextSpine.arriveByIso } : undefined, fixed: true }
    : undefined;

  const depMs = base + DEP * 60_000;
  const arrMs = base + ARR * 60_000;
  const reviewMs = base + REVIEW * 60_000;
  const headline = now >= reviewMs ? "You're here" : now >= depMs && now < arrMs ? "On your way" : "Getting you ready";
  const minsToNext = nextSpine?.arriveByIso ? Math.round((new Date(nextSpine.arriveByIso).getTime() - now) / 60_000) : null;
  const urgency: ActiveUrgency = minsToNext != null && minsToNext >= 0 && minsToNext <= 20 ? "urgent" : "comfortable";
  const leaveBy = now < depMs ? new Date(depMs - 13 * 60_000).toISOString() : undefined;

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

      <ActiveTile headline={headline} sub="Project review · sample day" nextAnchor={nextAnchor} leaveBy={leaveBy} urgency={urgency} />

      {now < arrMs ? (
        <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <span className="cc-eyebrow" style={{ color: "var(--gold-2)" }}>
            Ready when you are
          </span>
          <Pass ticket={ticket} boarding={boarding} />
        </section>
      ) : null}

      <TodaySpine anchors={spineAnchors} nextId={nextSpine?.id ?? null} nowOverride={now} />

      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
        <Link href={"/plan" as Route} className="cc-btn cc-btn-gold">
          Open the plan
        </Link>
        <Link href={"/navigate" as Route} className="cc-btn">
          Navigate
        </Link>
      </div>

      <p style={{ fontSize: "var(--fs-micro)", color: "var(--ink-dim)", marginTop: "var(--space-2)" }}>
        Sample day for design review — not your real plan. Live platform, the named train and the
        wrong-train guard populate from National Rail on a real journey.
      </p>
    </div>
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
