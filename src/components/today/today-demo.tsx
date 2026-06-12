"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActiveTile } from "@/components/concierge";
import type { ActiveUrgency } from "@/components/concierge/active-tile";
import type { AnchorVM } from "@/components/concierge";
import { NextLegMap } from "@/components/today/next-leg-map";
import { navModeForTransition } from "@/components/today/spine-model";
import { fetchNavRoute } from "@/lib/actions/nav";
import { searchTransportHubs } from "@/lib/actions/travel-profile";
import { checkPickup } from "@/lib/planning/leave-by";
import { haversineMeters, formatMiles } from "@/lib/geo";

// Staff-only feasibility TESTER (demo mode, or /today?demo=1). The point the
// user made: your ACTUAL location is the truth for the next event. So this runs
// the real engine off your live GPS → the nearest real station, routed live for
// your chosen mode. The ONLY simulated thing is the train's departure time
// (there's no real booking to point at) — exposed as a slider so the radius can
// be made to shrink on demand. NEVER on the product path.

type Pt = { lat: number; lng: number; name?: string };

const STATION_BUFFER = 8; // minutes at the station before the train

const MODES = [
  { key: "walk", label: "Walk", verb: "walk it" },
  { key: "cycle", label: "Cycle", verb: "cycle it" },
  { key: "taxi", label: "Taxi", verb: "taxi it" },
  { key: "drive", label: "Drive", verb: "drive it" },
] as const;
type ModeKey = (typeof MODES)[number]["key"];

const londonClock = (ms: number) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ms));

type Station = { name: string; code: string | null; lat: number; lng: number };

export function TodayDemo() {
  const [fix, setFix] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [geo, setGeo] = useState<"idle" | "locating" | "granted" | "denied" | "unavailable">("idle");
  const [station, setStation] = useState<Station | null>(null);
  const [mode, setMode] = useState<ModeKey>("walk");
  const [routeSeconds, setRouteSeconds] = useState<number | null>(null);
  const [departsIn, setDepartsIn] = useState(30); // simulated minutes until the train

  const watchRef = useRef<number | null>(null);
  const lastFix = useRef<{ lat: number; lng: number } | null>(null);
  const stationFetched = useRef(false);

  const useMyLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeo("unavailable");
      return;
    }
    setGeo("locating");
    watchRef.current = navigator.geolocation.watchPosition(
      (p) => {
        const next = { lat: p.coords.latitude, lng: p.coords.longitude };
        // Only update on meaningful movement (>15 m) so GPS jitter doesn't
        // re-route every second.
        if (!lastFix.current || haversineMeters(lastFix.current.lat, lastFix.current.lng, next.lat, next.lng) > 15) {
          lastFix.current = next;
          setFix({ ...next, accuracy: p.coords.accuracy });
        }
        setGeo("granted");
      },
      (e) => setGeo(e.code === e.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 },
    );
  };

  useEffect(() => {
    return () => {
      if (watchRef.current != null && typeof navigator !== "undefined") navigator.geolocation.clearWatch(watchRef.current);
    };
  }, []);

  // Nearest real station to where you are (once).
  useEffect(() => {
    if (!fix || stationFetched.current) return;
    stationFetched.current = true;
    let active = true;
    void searchTransportHubs({ query: "", kind: "rail_station", near: { lat: fix.lat, lng: fix.lng } }).then((r) => {
      if (!active || !r.ok) return;
      const h = r.value.find((x) => x.latitude != null && x.longitude != null);
      if (h) setStation({ name: h.name, code: h.code, lat: h.latitude as number, lng: h.longitude as number });
    });
    return () => {
      active = false;
    };
  }, [fix]);

  const now = Date.now();
  const depMs = now + departsIn * 60_000;
  const mustArriveByMs = depMs - STATION_BUFFER * 60_000;
  const travelMin = routeSeconds != null ? Math.max(1, Math.round(routeSeconds / 60)) : null;
  const leaveByMs = travelMin != null ? depMs - (travelMin + STATION_BUFFER) * 60_000 : null;
  const slackMin = leaveByMs != null ? Math.round((leaveByMs - now) / 60_000) : null;

  let urgency: ActiveUrgency = "comfortable";
  if (slackMin != null) {
    if (slackMin <= 5) urgency = "breach";
    else if (slackMin <= 20) urgency = "urgent";
  }

  const distance = fix && station ? haversineMeters(fix.lat, fix.lng, station.lat, station.lng) : null;
  const nextAnchor: AnchorVM | undefined = station
    ? { id: "station", type: "transport_arrival", title: station.name, time: { from: new Date(depMs).toISOString() }, fixed: true }
    : undefined;

  return (
    <div className="cc-screen">
      <header>
        <span className="cc-eyebrow" style={{ color: "var(--gold-2)" }}>
          Feasibility tester · from your location
        </span>
        <h1 className="cc-screen-title" style={{ marginTop: 6 }}>
          Right now
        </h1>
      </header>

      {geo !== "granted" ? (
        <section className="cc-active-tile" data-urgency="comfortable" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <span className="cc-eyebrow">Your location is the truth</span>
          <p style={{ margin: 0, fontSize: "var(--fs-body)", color: "var(--ink)" }}>
            This tester predicts your leave-by from where you actually are to the nearest station.
            Grant location to try it for real — move around and the timings change with you.
          </p>
          <div>
            <button type="button" className="cc-btn cc-btn-gold" onClick={useMyLocation}>
              {geo === "locating" ? "Locating…" : "Use my location"}
            </button>
          </div>
          {geo === "denied" ? <p style={{ margin: 0, fontSize: "var(--fs-label)", color: "var(--ink-dim)" }}>Location was declined — allow it in the browser to test.</p> : null}
          {geo === "unavailable" ? <p style={{ margin: 0, fontSize: "var(--fs-label)", color: "var(--ink-dim)" }}>Location isn&apos;t available on this device.</p> : null}
        </section>
      ) : (
        <>
          <section style={{ display: "flex", flexDirection: "column", gap: 4, padding: "var(--space-2) var(--space-4)", background: "var(--card-2, var(--card))", border: "1px dashed var(--rule)", borderRadius: "var(--radius-md)" }}>
            <span className="cc-eyebrow">
              You are here{fix ? ` · ±${Math.round(fix.accuracy)} m` : ""}
            </span>
            <span style={{ fontSize: "var(--fs-body)", color: "var(--ink)" }}>
              {station ? <>Nearest station: <strong>{station.name}</strong>{station.code ? ` (${station.code})` : ""}{distance != null ? ` · ${formatMiles(distance)} away` : ""}</> : "Finding the nearest station…"}
            </span>
          </section>

          <section style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-3) var(--space-4)", background: "var(--card-2, var(--card))", border: "1px dashed var(--rule)", borderRadius: "var(--radius-md)" }}>
            <span className="cc-eyebrow">Simulated train</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: "var(--fs-h3)", color: "var(--ink)" }}>departs {londonClock(depMs)}</span>
            <input type="range" min={5} max={120} step={5} value={departsIn} onChange={(e) => setDepartsIn(Number(e.target.value))} style={{ flex: 1, minWidth: 140, accentColor: "var(--gold)" }} aria-label="Minutes until the simulated train" />
            <span style={{ fontSize: "var(--fs-label)", color: "var(--ink-dim)" }}>in {departsIn} min</span>
          </section>

          <ActiveTile headline="Getting you ready" sub={station ? `Make the ${londonClock(depMs)} from ${station.name}` : "Finding your station…"} nextAnchor={nextAnchor} leaveBy={leaveByMs != null ? new Date(leaveByMs).toISOString() : undefined} urgency={urgency} />

          {station && fix ? (
            <MovePicker mode={mode} onMode={setMode} slackMin={slackMin} leaveByMs={leaveByMs} depMs={depMs} stationName={station.name}>
              <NextLegMap origin={{ lat: fix.lat, lng: fix.lng, name: "Your location" }} destination={{ lat: station.lat, lng: station.lng, name: station.name }} mode={navModeForTransition(mode)} onRoute={(r) => setRouteSeconds(r.duration_s)} />
            </MovePicker>
          ) : null}

          {station && fix ? (
            <LiftCard origin={{ lat: fix.lat, lng: fix.lng, name: "Your location" }} destination={{ lat: station.lat, lng: station.lng, name: station.name }} mustArriveByMs={mustArriveByMs} depMs={depMs} contact="a friend" />
          ) : null}
        </>
      )}

      <p style={{ fontSize: "var(--fs-micro)", color: "var(--ink-dim)", marginTop: "var(--space-2)" }}>
        Real: your location, the nearest station, the route and every timing. Simulated: the train&apos;s
        departure (there&apos;s no real booking to read) — slide it to make the window tighten.
      </p>
    </div>
  );
}

// The preferred-mode feasibility line: from where you are, leave in X — banded
// from quiet → leave-now, then escalation when the preferred mode runs out of road.
function MovePicker({ mode, onMode, slackMin, leaveByMs, depMs, stationName, children }: { mode: ModeKey; onMode: (m: ModeKey) => void; slackMin: number | null; leaveByMs: number | null; depMs: number; stationName: string; children?: ReactNode }) {
  const m = MODES.find((x) => x.key === mode)!;
  let line: string;
  if (slackMin == null || leaveByMs == null) {
    line = "Working out the time from where you are…";
  } else if (slackMin < 0) {
    line = `Too tight to ${m.verb} from here — switch to a faster option above, or catch the next train.`;
  } else if (slackMin <= 5) {
    line = `Leave now to ${m.verb} to ${stationName} — ${londonClock(leaveByMs)} at the latest for the ${londonClock(depMs)}.`;
  } else if (slackMin <= 20) {
    line = `Time to head off — leave by ${londonClock(leaveByMs)} (${slackMin} min) to ${m.verb} for the ${londonClock(depMs)}.`;
  } else {
    line = `No rush — leave by ${londonClock(leaveByMs)} (${slackMin} min) to ${m.verb} for the ${londonClock(depMs)}.`;
  }
  return (
    <section className="cc-active-tile" data-urgency={slackMin != null && slackMin <= 5 ? "breach" : slackMin != null && slackMin <= 20 ? "urgent" : "comfortable"} style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <span className="cc-eyebrow">Getting to {stationName}</span>
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
      origin: { lat: origin.lat, lng: origin.lng, name: origin.name ?? "You" },
      destination: { lat: destination.lat, lng: destination.lng, name: destination.name ?? "Station" },
      mode: "drive",
    }).then((r) => {
      if (!active || !r.ok) return;
      setDriveSeconds(r.value.duration_s);
      setPickupMs((prev) => prev ?? mustArriveByMs - r.value.duration_s * 1000 - 5 * 60_000); // default: 5 min spare
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
