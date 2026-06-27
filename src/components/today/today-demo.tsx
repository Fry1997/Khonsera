"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ActiveTile } from "@/components/concierge";
import type { ActiveUrgency } from "@/components/concierge/active-tile";
import type { AnchorVM, TicketVM } from "@/components/concierge";
import { TodaySpine } from "@/components/today/today-spine";
import { NextLegMap } from "@/components/today/next-leg-map";
import { navModeForTransition, type SpineAnchor } from "@/components/today/spine-model";
import { fetchNavRoute } from "@/lib/actions/nav";
import { checkPickup } from "@/lib/planning/leave-by";

// Staff-only day-of PREVIEW (demo mode, or /today?demo=1). This is the TODAY
// view — your plan for the day, the next-needed pass, the spine — with
// feasibility woven in QUIETLY: on track we just say "leave by HH:MM, start
// navigation"; as the window closes we diminish the buffer, then offer a faster
// mode, then the next train. It never reads as a "feasibility test".
//
// Real geography (Harpenden → Luton routed by Valhalla) drives the numbers; the
// TIME slider stands in for the day passing so the behaviour is reviewable from
// a desk. NEVER on the product path.

const HARPENDEN = { lat: 51.8176, lng: -0.354, name: "Home, Harpenden" };
const LUTON = { lat: 51.8821, lng: -0.4147 };
const WELLINGBOROUGH = { lat: 52.2962, lng: -0.6896 };

type Pt = { lat: number; lng: number; name?: string };

const DEP = 45; // train departs Luton (minutes from base)
const ARR = 70;
const REVIEW = 95;
const STATION_BUFFER = 8; // minutes at the station before the train = the buffer

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
  const [mode, setMode] = useState<ModeKey>("walk");
  const [routeSeconds, setRouteSeconds] = useState<number | null>(null);

  const now = base + offset * 60_000;
  const at = useMemo(() => (min: number) => new Date(base + min * 60_000).toISOString(), [base]);

  const depMs = base + DEP * 60_000;
  const arrMs = base + ARR * 60_000;
  const reviewMs = base + REVIEW * 60_000;

  // Leave-by from the live route for the preferred mode. The buffer is the
  // station readiness; as you slip past leave-by it's the buffer that erodes.
  const travelMin = routeSeconds != null ? Math.max(1, Math.round(routeSeconds / 60)) : null;
  const leaveByMs = travelMin != null ? depMs - (travelMin + STATION_BUFFER) * 60_000 : null;
  const slackMin = leaveByMs != null ? Math.round((leaveByMs - now) / 60_000) : null;
  const bufferLeft = slackMin != null ? slackMin + STATION_BUFFER : null; // buffer remaining if you left now

  const ticket: TicketVM = useMemo(
    () => ({
      id: "demo-luton",
      kind: "rail",
      operator: "East Midlands Railway",
      reference: "AB12CD34",
      source: "forwarded",
      consequence: "The Corby train drops you a short walk from the review.",
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

  // Home is the base (no clock); the spine is the timed commitments.
  const walk = navModeForTransition("walk");
  const spineAnchors: SpineAnchor[] = useMemo(
    () => [
      { id: "demo-luton", type: "transport_arrival", title: "Luton Station", arriveByIso: at(DEP), endIso: at(DEP), coord: LUTON, plannedTravelMinutes: travelMin ?? 16, navMode: navModeForTransition(mode), station: { name: "Luton", code: "LUT", kind: "rail_station" }, role: "departure", pass: { ticket, crs: "LUT", time: londonClock(depMs), dest: "WEL" } },
      { id: "demo-welly", type: "transport_arrival", title: "Wellingborough Station", arriveByIso: at(ARR), endIso: at(ARR), coord: WELLINGBOROUGH, plannedTravelMinutes: 25, navMode: walk, station: { name: "Wellingborough", code: "WEL", kind: "rail_station" }, role: "arrival" },
      { id: "demo-review", type: "appointment", title: "Project review", place: "Wellingborough", arriveByIso: at(REVIEW), endIso: at(REVIEW + 60), coord: WELLINGBOROUGH, plannedTravelMinutes: 8, navMode: walk, station: null, role: "stop" },
    ],
    [at, walk, travelMin, mode, ticket, depMs],
  );

  const nextSpine = spineAnchors.find((a) => a.arriveByIso && new Date(a.arriveByIso).getTime() > now) ?? null;
  const nextAnchor: AnchorVM | undefined = nextSpine
    ? { id: nextSpine.id, type: nextSpine.type, title: nextSpine.title, place: nextSpine.place, time: nextSpine.arriveByIso ? { from: nextSpine.arriveByIso } : undefined, fixed: true }
    : undefined;

  const beforeDeparture = now < depMs;
  const headline = now >= reviewMs ? "You're here" : now >= depMs && now < arrMs ? "On your way" : "Getting you ready";

  let urgency: ActiveUrgency = "comfortable";
  if (beforeDeparture && slackMin != null) {
    if (bufferLeft != null && bufferLeft <= 0) urgency = "breach";
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

      <TimeTravel now={now} offset={offset} onOffset={setOffset} />

      <ActiveTile
        headline={headline}
        sub="Project review · from home, Harpenden"
        nextAnchor={nextAnchor}
        leaveBy={beforeDeparture && leaveByMs != null ? new Date(leaveByMs).toISOString() : undefined}
        urgency={urgency}
      />

      {beforeDeparture ? (
        <>
          <NextMove mode={mode} onMode={setMode} slackMin={slackMin} bufferLeft={bufferLeft} leaveByMs={leaveByMs} depMs={depMs}>
            <NextLegMap origin={HARPENDEN} destination={{ ...LUTON, name: "Luton Station" }} mode={navModeForTransition(mode)} preview onRoute={(r) => setRouteSeconds(r.duration_s)} />
          </NextMove>
          <LiftCard origin={HARPENDEN} destination={{ ...LUTON, name: "Luton Station" }} mustArriveByMs={depMs - STATION_BUFFER * 60_000} depMs={depMs} contact="Dave" />
        </>
      ) : null}

      {/* The rail pass now rides INLINE on the spine at its boarding node (the
         demo Luton departure carries it), mirroring the live Today. */}
      <TodaySpine anchors={spineAnchors} nextId={nextSpine?.id ?? null} nowOverride={now} />

      <p style={{ fontSize: "var(--fs-micro)", color: "var(--ink-dim)", marginTop: "var(--space-2)" }}>
        Sample day for design review. On the real Today, this is your actual plan — leave-by predicts
        from your live GPS, and the platform/train come from National Rail.
      </p>
    </div>
  );
}

// The next move — feasibility woven in, not a test. Quiet "leave by, start
// navigation" on track; as the window closes the buffer diminishes, then a
// faster mode is offered, then the next train.
function NextMove({ mode, onMode, slackMin, bufferLeft, leaveByMs, depMs, children }: { mode: ModeKey; onMode: (m: ModeKey) => void; slackMin: number | null; bufferLeft: number | null; leaveByMs: number | null; depMs: number; children?: ReactNode }) {
  const m = MODES.find((x) => x.key === mode)!;
  let line: string;
  if (slackMin == null || leaveByMs == null || bufferLeft == null) {
    line = "Working out the time from home…";
  } else if (slackMin > 20) {
    line = `Leave by ${londonClock(leaveByMs)} to make the ${londonClock(depMs)} from Luton — start navigation when you're ready.`;
  } else if (slackMin > 0) {
    line = `Time to head off — leave by ${londonClock(leaveByMs)} (${slackMin} min) to ${m.verb}.`;
  } else if (bufferLeft > 0) {
    line = `Leave now — only ${bufferLeft} min of buffer left to ${m.verb} and still catch the ${londonClock(depMs)}.`;
  } else {
    line = `You won't make the ${londonClock(depMs)} on foot from here. A faster option above still might — or catch the next train.`;
  }
  const urgency: ActiveUrgency = bufferLeft != null && bufferLeft <= 0 ? "breach" : slackMin != null && slackMin <= 20 ? "urgent" : "comfortable";
  return (
    <section className="cc-active-tile" data-urgency={urgency} style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <span className="cc-eyebrow">Getting to Luton</span>
      <p style={{ margin: 0, fontFamily: "var(--serif)", fontStyle: "italic", fontSize: "var(--fs-body)", color: "var(--ink)" }}>{line}</p>
      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
        {MODES.map((x) => (
          <button key={x.key} type="button" className={x.key === mode ? "cc-btn cc-btn-gold" : "cc-btn"} style={{ fontSize: "var(--fs-label)" }} onClick={() => onMode(x.key)}>
            {x.label}
          </button>
        ))}
      </div>
      {children}
    </section>
  );
}

// A lift is USER-SET — Khonsera never suggests one. You arrange it and set a
// pickup time; the time is feasibility-checked against the train as you set it.
function LiftCard({ origin, destination, mustArriveByMs, depMs, contact }: { origin: Pt; destination: Pt; mustArriveByMs: number; depMs: number; contact: string }) {
  const [on, setOn] = useState(false);
  return (
    <section className="cc-active-tile" data-urgency="comfortable" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
        <span className="cc-eyebrow">Lift</span>
        <button type="button" className={on ? "cc-btn" : "cc-btn cc-btn-gold"} style={{ fontSize: "var(--fs-label)" }} onClick={() => setOn((v) => !v)}>
          {on ? "Remove lift" : "Arrange a lift"}
        </button>
      </div>
      {on ? (
        <LiftSetter origin={origin} destination={destination} mustArriveByMs={mustArriveByMs} depMs={depMs} contact={contact} />
      ) : (
        <p style={{ margin: 0, fontFamily: "var(--serif)", fontStyle: "italic", fontSize: "var(--fs-body)", color: "var(--ink-dim)" }}>
          A lift is yours to set — Khonsera never offers one. Add a pickup time and it&apos;s checked against your train as you set it.
        </p>
      )}
    </section>
  );
}

function LiftSetter({ origin, destination, mustArriveByMs, depMs, contact }: { origin: Pt; destination: Pt; mustArriveByMs: number; depMs: number; contact: string }) {
  const [driveSeconds, setDriveSeconds] = useState<number | null>(null);
  const [pickupMs, setPickupMs] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    void fetchNavRoute({
      origin: { lat: origin.lat, lng: origin.lng, name: origin.name ?? "Home" },
      destination: { lat: destination.lat, lng: destination.lng, name: destination.name ?? "Station" },
      mode: "drive",
    }).then((r) => {
      if (!active || !r.ok) return;
      setDriveSeconds(r.value.duration_s);
      setPickupMs((prev) => prev ?? mustArriveByMs - r.value.duration_s * 1000 - 5 * 60_000);
    });
    return () => {
      active = false;
    };
  }, [origin.lat, origin.lng, destination.lat, destination.lng, origin.name, destination.name, mustArriveByMs]);

  if (driveSeconds == null || pickupMs == null) {
    return <p style={{ margin: 0, fontSize: "var(--fs-label)", color: "var(--ink-dim)" }}>Working out the drive…</p>;
  }

  const check = checkPickup(pickupMs, driveSeconds, mustArriveByMs);
  const step = (mins: number) => setPickupMs((p) => (p ?? 0) + mins * 60_000);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        <span style={{ fontSize: "var(--fs-label)", color: "var(--ink-dim)" }}>{contact} collects you at</span>
        <button type="button" className="cc-btn" style={{ fontSize: "var(--fs-label)", padding: "2px 8px" }} onClick={() => step(-5)}>
          −5
        </button>
        <span style={{ fontFamily: "var(--mono)", fontSize: "var(--fs-h3)", color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{londonClock(pickupMs)}</span>
        <button type="button" className="cc-btn" style={{ fontSize: "var(--fs-label)", padding: "2px 8px" }} onClick={() => step(5)}>
          +5
        </button>
      </div>
      {check.feasible ? (
        <p style={{ margin: 0, fontFamily: "var(--serif)", fontStyle: "italic", fontSize: "var(--fs-body)", color: "var(--ink)" }}>
          Arrives {londonClock(check.arrivalMs)} — {check.slackMin} min before the {londonClock(depMs)}.{check.slackMin <= 5 ? " Cutting it fine." : ""}
        </p>
      ) : (
        <p style={{ margin: 0, padding: "var(--space-2) var(--space-3)", background: "var(--amber-soft)", borderLeft: "3px solid var(--amber)", borderRadius: "var(--radius-sm, 4px)", fontSize: "var(--fs-body)", color: "var(--ink)" }}>
          That pickup misses the {londonClock(depMs)} by {check.minutesLate} min — latest that works is{" "}
          <span style={{ fontFamily: "var(--mono)" }}>{londonClock(check.latestPickupMs)}</span>.
        </p>
      )}
    </div>
  );
}

// Demo-only: scrub synthetic NOW across the day to watch the spine reel and the
// leave-by tighten through its bands.
function TimeTravel({ now, offset, onOffset }: { now: number; offset: number; onOffset: (n: number) => void }) {
  return (
    <section style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-3) var(--space-4)", background: "var(--card-2, var(--card))", border: "1px dashed var(--rule)", borderRadius: "var(--radius-md)" }}>
      <span className="cc-eyebrow">Demo time</span>
      <span style={{ fontFamily: "var(--mono)", fontSize: "var(--fs-h3)", color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{londonClock(now)}</span>
      <input type="range" min={-180} max={240} step={5} value={offset} onChange={(e) => onOffset(Number(e.target.value))} style={{ flex: 1, minWidth: 140, accentColor: "var(--gold)" }} aria-label="Move the demo clock" />
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
