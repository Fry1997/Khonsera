"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SpineAnchor } from "./spine-model";
import { londonClock } from "./spine-model";
import { computeDayState, type EngineAnchor, type Feasibility } from "@/lib/today/engine";
import { totalSpareMinutes } from "@/lib/planning/gaps";
import { leaveByCountdown } from "@/lib/planning/leave-by";
import { fetchNavRoute } from "@/lib/actions/nav";
import { requestHeadingPermission } from "@/components/nav/use-heading";
import { FullLeg } from "./next-leg-map";
import { useLivePosition } from "./use-live-position";
import { buildNavCommitments } from "@/lib/nav/day-commitments";
import type { NavMode, NavRoute } from "@/lib/nav/types";

// The live next-move — timing-first and reactive. Threads the plan, picks the
// next obligation, predicts the leave-by from where you ACTUALLY are (live GPS
// is the point of the thing, so it's always on; home base is the silent fallback
// until a fix lands). No inline map — timing here, the map full-screen on
// Navigate. A late obligation stays in front of you with planned → ETA; you can
// say "not going" to drop it and recalc; a reversible Walk/Taxi toggle shows a
// faster way; "Tell them" shares your real ETA.

const HHMM = (ms: number) => londonClock(new Date(ms).toISOString());

const MODE_LABEL: Record<NavMode, string> = { walk: "Walk", cycle: "Cycle", drive: "Taxi" };

export function LiveDay({ anchors, sub, base }: { anchors: SpineAnchor[]; sub?: string; base?: { lat: number; lng: number } | null }) {
  const [now, setNow] = useState(() => Date.now());
  const [modeOverride, setModeOverride] = useState<NavMode | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [route, setRoute] = useState<NavRoute | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  // Live location is the core function — always watch; fall back to home base
  // silently until a fix arrives (or if it's blocked). No on/off toggle.
  const { fix } = useLivePosition(true);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const liveAnchors = useMemo(() => anchors.filter((a) => !dismissed.has(a.id)), [anchors, dismissed]);

  const engineAnchors: EngineAnchor[] = useMemo(
    () =>
      liveAnchors.map((a) => ({
        id: a.id,
        startMs: a.arriveByIso ? Date.parse(a.arriveByIso) : null,
        endMs: a.endIso ? Date.parse(a.endIso) : null,
        plannedTravelMinutes: a.plannedTravelMinutes,
        isStation: !!a.station,
      })),
    [liveAnchors],
  );

  const preState = computeDayState({ anchors: engineAnchors, nowMs: now });
  const next = preState.nextIndex != null ? liveAnchors[preState.nextIndex] : null;
  const mode: NavMode = modeOverride ?? next?.navMode ?? "walk";
  const origin = fix ? { lat: fix.lat, lng: fix.lng, name: "Your location" } : base ? { lat: base.lat, lng: base.lng, name: "Home" } : null;
  const fromHome = !fix && !!base;

  // Reset per-leg choices when the obligation changes.
  const nextId = next?.id ?? null;
  const prevNextId = useRef<string | null>(null);
  useEffect(() => {
    if (prevNextId.current !== nextId) {
      prevNextId.current = nextId;
      setModeOverride(null);
      setRoute(null);
    }
  }, [nextId]);

  // Fetch the route for the active mode (for the leave-by maths AND Navigate),
  // never shown inline. From your live position, else your home base.
  const oLat = origin?.lat;
  const oLng = origin?.lng;
  const dLat = next?.coord?.lat;
  const dLng = next?.coord?.lng;
  useEffect(() => {
    if (oLat == null || oLng == null || dLat == null || dLng == null) {
      setRoute(null);
      return;
    }
    let active = true;
    void fetchNavRoute({ origin: { lat: oLat, lng: oLng, name: "Start" }, destination: { lat: dLat, lng: dLng, name: "Destination" }, mode }).then((r) => {
      if (active && r.ok) setRoute(r.value);
    });
    return () => {
      active = false;
    };
  }, [oLat, oLng, dLat, dLng, mode]);

  const state = computeDayState({ anchors: engineAnchors, nowMs: now, liveTravelSeconds: route?.duration_s ?? null });
  const spare = totalSpareMinutes(state.gaps);

  if (!next) {
    return (
      <section className="cc-active-tile" data-urgency="comfortable">
        <span className="cc-at-status">
          <span className="cc-at-dot" />
          {state.phase === "arrived" ? "All done" : "At rest"}
        </span>
        <h2 className="cc-at-headline">{state.phase === "arrived" ? "That's your day" : "Nothing on right now"}</h2>
        {sub ? <p className="cc-at-sub">{sub}</p> : null}
      </section>
    );
  }

  const feas = state.feasibility;
  const arriveByMs = next.arriveByIso ? Date.parse(next.arriveByIso) : null;
  const arrivalMs = feas ? now + feas.travelMinutes * 60_000 : null;
  const lateMin = arrivalMs != null && arriveByMs != null ? Math.round((arrivalMs - arriveByMs) / 60_000) : null;
  const isMeeting = !next.station;
  const isLate = feas?.band === "cliff" || (lateMin != null && lateMin > 0);

  const modeOptions = Array.from(new Set<NavMode>([next.navMode, "drive"]));

  // The calm SET OFF BY figure — one giant debossed mono numeral, the day's
  // single emphatic time. When the leave-by is known (not a cliff) it's the
  // computed HH:MM; on a cliff (already late) it reads "Now". The colon dims so
  // the hours/minutes read as the figure. All the live detail (ETA, mode, the
  // actions) keeps its reactive engine and sits quietly beneath.
  const setOffClock = feas && feas.band !== "cliff" ? HHMM(feas.leaveByMs) : null;
  const setOffParts = setOffClock ? setOffClock.split(":") : null;
  // What you're setting off FOR — the station you board / the place you're due.
  const forLabel = next.station ? next.station.name : next.title;

  return (
    <section className="cc-active-tile cc-setoff" data-urgency={urgencyOf(feas)}>
      <span className="cc-at-status">
        <span className="cc-at-dot" />
        {state.phase === "in_transit" || isLate ? "On your way" : "Next move"}
      </span>

      {/* SET OFF BY — the lifted cotton sheet with the giant debossed figure */}
      <div className="pg cc-setoff-sheet">
        <div className="cc-setoff-eyb">
          <span className="cc-setoff-kicker">Set off by</span>
          <span className="cc-setoff-for">for {forLabel}</span>
        </div>
        {setOffParts ? (
          <div className="mono engr-deep cc-setoff-figure" aria-label={`Set off by ${setOffClock}`}>
            <span>{setOffParts[0]}</span>
            <span className="cc-setoff-colon">:</span>
            <span>{setOffParts[1]}</span>
          </div>
        ) : (
          <div className="mono engr-deep cc-setoff-figure cc-setoff-figure--word" aria-label="Set off now">
            {headline(feas) === "Running late" ? "Late" : "Now"}
          </div>
        )}
        {/* the move it serves — quiet, beneath the figure. The readiness phrase
           (leave-in countdown / buffer / running-late) carries the live nuance
           the single figure can't; the destination follows it. */}
        <p className="cc-setoff-move">
          {headline(feas)} · to {next.title}
          {next.place && next.place !== next.title && next.place !== forLabel ? ` · ${next.place}` : ""}
        </p>
      </div>

      {arrivalMs != null ? (
        <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: "var(--fs-label)", color: isLate ? "var(--amber)" : "var(--ink-dim)" }}>
          {isLate && arriveByMs != null
            ? `Planned ${HHMM(arriveByMs)} → arriving ~${HHMM(arrivalMs)}${lateMin != null && lateMin > 0 ? ` · ${lateMin} min late` : ""}`
            : `Arrive ~${HHMM(arrivalMs)}${lateMin != null && lateMin < -1 ? ` · ${-lateMin} min to spare` : ""}`}
          {fromHome ? " · from home" : ""}
        </p>
      ) : (
        <p style={{ margin: 0, fontSize: "var(--fs-label)", color: "var(--ink-dim)" }}>Working out the time…</p>
      )}

      {/* Reversible mode toggle — a proper segmented control (rounded selection). */}
      {origin && next.coord && modeOptions.length > 1 ? (
        <div style={{ display: "inline-flex", alignSelf: "flex-start", gap: 2, padding: 3, background: "var(--card-2, var(--card))", border: "1px solid var(--rule)", borderRadius: 999 }}>
          {modeOptions.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModeOverride(m)}
              style={{
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-ui)",
                fontSize: "var(--fs-label)",
                fontWeight: m === mode ? 600 : 400,
                padding: "4px 14px",
                borderRadius: 999,
                background: m === mode ? "var(--gold)" : "transparent",
                color: m === mode ? "#fffdf7" : "var(--ink-dim)",
              }}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", alignItems: "center", marginTop: "var(--space-1)" }}>
        {next.coord && origin ? (
          <button
            type="button"
            className="cc-btn cc-btn-gold"
            disabled={!route}
            onClick={() => {
              void requestHeadingPermission();
              setNavOpen(true);
            }}
          >
            {route ? "Navigate" : "Finding route…"}
          </button>
        ) : null}
        {isLate && isMeeting && arrivalMs != null ? <NotifyButton arrivalMs={arrivalMs} /> : null}
        <button
          type="button"
          className="cc-btn"
          style={{ fontSize: "var(--fs-label)", color: "var(--ink-dim)" }}
          onClick={() => setDismissed((s) => new Set(s).add(next.id))}
        >
          Not going
        </button>
      </div>

      {spare >= 15 && !isLate ? (
        <p style={{ margin: 0, fontSize: "var(--fs-label)", color: "var(--ink-dim)" }}>{spare} min of free time across your day — room to fit something in.</p>
      ) : null}

      {navOpen && route && next ? (
        <FullLeg
          route={route}
          preview={false}
          commitments={buildNavCommitments(liveAnchors, next.id)}
          scheduledRemainingMin={Math.round(route.duration_s / 60)}
          onClose={() => setNavOpen(false)}
        />
      ) : null}
    </section>
  );
}

// Tell whoever's waiting your real ETA — Share where available, else copy.
// (WhatsApp / contacts integration to come; until then it's a generic ETA, no
// guessed names.)
function NotifyButton({ arrivalMs }: { arrivalMs: number }) {
  const [done, setDone] = useState(false);
  const msg = `Running a little late — I'll be there around ${HHMM(arrivalMs)}.`;
  const send = async () => {
    try {
      const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> };
      if (nav.share) await nav.share({ text: msg });
      else await navigator.clipboard?.writeText(msg);
      setDone(true);
    } catch {
      /* dismissed */
    }
  };
  return (
    <button type="button" className="cc-btn" style={{ fontSize: "var(--fs-label)" }} onClick={send}>
      {done ? "ETA sent" : "Tell them"}
    </button>
  );
}

function urgencyOf(feas: Feasibility | null): "comfortable" | "urgent" | "breach" {
  if (!feas) return "comfortable";
  if (feas.band === "cliff") return "breach";
  if (feas.band === "leave_now" || feas.band === "heads_up") return "urgent";
  return "comfortable";
}

function headline(feas: Feasibility | null): string {
  if (!feas) return "Working out your leave time…";
  if (feas.band === "cliff") return "Running late";
  if (feas.band === "leave_now") return feas.bufferLeftMin > 0 ? `Leave now · ${feas.bufferLeftMin} min buffer` : "Leave now";
  return leaveByCountdown(feas.slackMin);
}
