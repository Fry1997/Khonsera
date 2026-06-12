"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SpineAnchor } from "./spine-model";
import { londonClock } from "./spine-model";
import { computeDayState, type EngineAnchor, type Feasibility } from "@/lib/today/engine";
import { totalSpareMinutes } from "@/lib/planning/gaps";
import { leaveByCountdown } from "@/lib/planning/leave-by";
import type { NavMode } from "@/lib/nav/types";
import { NextLegMap } from "./next-leg-map";
import { useLivePosition } from "./use-live-position";

// The live next-move — the engine made visible, and REACTIVE. It threads the
// plan, picks the next obligation, predicts the leave-by from where you ACTUALLY
// are, and bands it honestly (it reads the buffer, so it never cries "overdue"
// while you can still make it). At the cliff it stops merely stating the problem
// and offers the fork: take a faster way (recomputes live), accept being late
// (with the real arrival), or tell whoever's waiting. Degrades cleanly with no
// location / no coordinates; renders an "all done" line once the day's behind you.

const HHMM = (ms: number) => londonClock(new Date(ms).toISOString());

export function LiveDay({ anchors, sub }: { anchors: SpineAnchor[]; sub?: string }) {
  const [now, setNow] = useState(() => Date.now());
  const [liveTravelSeconds, setLiveTravelSeconds] = useState<number | null>(null);
  const [modeOverride, setModeOverride] = useState<NavMode | null>(null);
  const [acceptedLate, setAcceptedLate] = useState(false);
  const [locEnabled, setLocEnabled] = useState(false);
  const { fix, status } = useLivePosition(locEnabled);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Upgrade to live position only if already granted — never prompt on load.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const perms = (navigator as Navigator & { permissions?: Permissions }).permissions;
        if (perms?.query) {
          const s = await perms.query({ name: "geolocation" as PermissionName });
          if (!cancelled && s.state === "granted") setLocEnabled(true);
        }
      } catch {
        /* no Permissions API — wait for a tap */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const engineAnchors: EngineAnchor[] = useMemo(
    () =>
      anchors.map((a) => ({
        id: a.id,
        startMs: a.arriveByIso ? Date.parse(a.arriveByIso) : null,
        endMs: a.endIso ? Date.parse(a.endIso) : null,
        plannedTravelMinutes: a.plannedTravelMinutes,
        isStation: !!a.station,
      })),
    [anchors],
  );

  const state = computeDayState({ anchors: engineAnchors, nowMs: now, liveTravelSeconds });
  const next = state.nextIndex != null ? anchors[state.nextIndex] : null;

  // Reset per-leg choices when the next obligation changes.
  const nextId = next?.id ?? null;
  const prevNextId = useRef<string | null>(null);
  useEffect(() => {
    if (prevNextId.current !== nextId) {
      prevNextId.current = nextId;
      setLiveTravelSeconds(null);
      setModeOverride(null);
      setAcceptedLate(false);
    }
  }, [nextId]);

  const spare = totalSpareMinutes(state.gaps);

  // Day's behind you — quiet "all done".
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
  const mode = modeOverride ?? next.navMode;
  const arriveByMs = next.arriveByIso ? Date.parse(next.arriveByIso) : null;
  const arrivalMs = feas ? now + feas.travelMinutes * 60_000 : null;
  const lateMin = arrivalMs != null && arriveByMs != null ? Math.round((arrivalMs - arriveByMs) / 60_000) : null;
  const atCliff = feas?.band === "cliff" && !acceptedLate;
  const isMeeting = !next.station; // a person/place obligation can be told you're late

  const urgency = acceptedLate ? "urgent" : urgencyOf(feas);

  return (
    <section className="cc-active-tile" data-urgency={urgency} style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <span className="cc-at-status">
        <span className="cc-at-dot" />
        {phaseLabel(state.phase, acceptedLate)}
      </span>

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "var(--space-3)" }}>
        <h2 className="cc-at-headline" style={{ margin: 0 }}>
          {headline(feas, acceptedLate)}
        </h2>
        {feas && !atCliff ? <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-h3)", color: "var(--ink)" }}>{HHMM(feas.leaveByMs)}</span> : null}
      </div>

      <p className="cc-at-sub" style={{ margin: 0 }}>
        To {next.title}
        {next.place && next.place !== next.title ? ` · ${next.place}` : ""}
        {arrivalMs != null ? ` · ${arrivalLine(arrivalMs, lateMin)}` : ""}
        {modeOverride ? ` · via ${modeWord(mode)}` : ""}
      </p>

      {next.coord && fix ? (
        <NextLegMap origin={{ lat: fix.lat, lng: fix.lng, name: "Your location" }} destination={{ lat: next.coord.lat, lng: next.coord.lng, name: next.title }} mode={mode} onRoute={(r) => setLiveTravelSeconds(r.duration_s)} />
      ) : next.coord ? (
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
          <button type="button" className="cc-btn cc-btn-gold" onClick={() => setLocEnabled(true)}>
            {status === "denied" ? "Location is blocked" : "Use live location"}
          </button>
          <span style={{ fontSize: "var(--fs-label)", color: "var(--ink-dim)" }}>{feas?.source === "planned" ? "Using your plan's estimate for now" : ""}</span>
        </div>
      ) : null}

      {atCliff ? (
        <CliffFork
          mode={mode}
          arrivalMs={arrivalMs}
          lateMin={lateMin}
          isMeeting={isMeeting}
          who={next.title}
          onFaster={() => setModeOverride("drive")}
          onAccept={() => setAcceptedLate(true)}
        />
      ) : acceptedLate && arrivalMs != null ? (
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", alignItems: "center" }}>
          {isMeeting ? <NotifyButton who={next.title} arrivalMs={arrivalMs} /> : null}
          <button type="button" className="cc-btn" style={{ fontSize: "var(--fs-label)" }} onClick={() => setAcceptedLate(false)}>
            Rethink
          </button>
        </div>
      ) : spare >= 15 ? (
        <p style={{ margin: 0, fontSize: "var(--fs-label)", color: "var(--ink-dim)" }}>{spare} min of free time across your day — room to fit something in.</p>
      ) : null}
    </section>
  );
}

// The cliff fork — real options, not a dead end.
function CliffFork({ mode, arrivalMs, lateMin, isMeeting, who, onFaster, onAccept }: { mode: NavMode; arrivalMs: number | null; lateMin: number | null; isMeeting: boolean; who: string; onFaster: () => void; onAccept: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <p style={{ margin: 0, fontSize: "var(--fs-label)", color: "var(--ink-dim)" }}>
        {mode === "walk" ? "Walking" : modeWord(mode)} from here you&apos;d arrive {arrivalMs != null ? HHMM(arrivalMs) : "late"}
        {lateMin != null && lateMin > 0 ? ` — ${lateMin} min late.` : "."} Your call:
      </p>
      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
        {mode !== "drive" ? (
          <button type="button" className="cc-btn cc-btn-gold" style={{ fontSize: "var(--fs-label)" }} onClick={onFaster}>
            Take a taxi
          </button>
        ) : null}
        <button type="button" className="cc-btn" style={{ fontSize: "var(--fs-label)" }} onClick={onAccept}>
          {mode === "walk" ? "Walk it anyway" : "Go anyway"}
        </button>
        {isMeeting && arrivalMs != null ? <NotifyButton who={who} arrivalMs={arrivalMs} /> : null}
      </div>
    </div>
  );
}

// Tell whoever's waiting your real ETA — Share where available, else copy.
function NotifyButton({ who, arrivalMs }: { who: string; arrivalMs: number }) {
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
  const first = who.split(/[ —-]/)[0];
  return (
    <button type="button" className="cc-btn" style={{ fontSize: "var(--fs-label)" }} onClick={send}>
      {done ? "ETA sent" : `Tell ${first || "them"}`}
    </button>
  );
}

function urgencyOf(feas: Feasibility | null): "comfortable" | "urgent" | "breach" {
  if (!feas) return "comfortable";
  if (feas.band === "cliff") return "breach";
  if (feas.band === "leave_now" || feas.band === "heads_up") return "urgent";
  return "comfortable";
}

function phaseLabel(phase: string, acceptedLate: boolean): string {
  if (acceptedLate) return "On your way";
  if (phase === "in_transit") return "On your way";
  return "Next move";
}

function headline(feas: Feasibility | null, acceptedLate: boolean): string {
  if (!feas) return "Working out your leave time…";
  if (acceptedLate) return "On your way";
  // Buffer-honest: only call it lost when the buffer's gone; otherwise it's just
  // "leave now", even a touch past the nominal leave-by.
  if (feas.band === "cliff") return "Won't make it on foot";
  if (feas.band === "leave_now") return feas.bufferLeftMin > 0 ? `Leave now · ${feas.bufferLeftMin} min buffer` : "Leave now";
  return leaveByCountdown(feas.slackMin);
}

function arrivalLine(arrivalMs: number, lateMin: number | null): string {
  const at = `arrive ~${HHMM(arrivalMs)}`;
  if (lateMin == null) return at;
  if (lateMin > 0) return `${at}, ${lateMin} min late`;
  if (lateMin < -1) return `${at}, ${-lateMin} min to spare`;
  return `${at}, on time`;
}

function modeWord(mode: NavMode): string {
  return mode === "drive" ? "taxi" : mode === "cycle" ? "cycle" : "walk";
}
