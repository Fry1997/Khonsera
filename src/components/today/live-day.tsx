"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SpineAnchor } from "./spine-model";
import { londonClock } from "./spine-model";
import { computeDayState, type EngineAnchor, type Feasibility } from "@/lib/today/engine";
import { totalSpareMinutes } from "@/lib/planning/gaps";
import { leaveByCountdown } from "@/lib/planning/leave-by";
import { NextLegMap } from "./next-leg-map";
import { useLivePosition } from "./use-live-position";

// The live next-move — the engine made visible on the real Today. It threads the
// plan, picks the next obligation, and predicts the leave-by from where you
// ACTUALLY are (live route), banded quietly: comfortable → head-off → leave-now →
// cliff. Navigation is inline. Degrades cleanly: no location → the plan's own
// estimate; no coordinates → just the leave-by. Renders nothing once the day is
// behind you.

export function LiveDay({ anchors }: { anchors: SpineAnchor[] }) {
  const [now, setNow] = useState(() => Date.now());
  const [liveTravelSeconds, setLiveTravelSeconds] = useState<number | null>(null);
  const [locEnabled, setLocEnabled] = useState(false);
  const { fix, status } = useLivePosition(locEnabled);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Upgrade to live position only if it's ALREADY granted — never prompt just for
  // loading Today. An explicit "Use live location" tap is where consent lives.
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

  // Reset the live route whenever the next obligation changes.
  const nextId = next?.id ?? null;
  const prevNextId = useRef<string | null>(null);
  useEffect(() => {
    if (prevNextId.current !== nextId) {
      prevNextId.current = nextId;
      setLiveTravelSeconds(null);
    }
  }, [nextId]);

  if (!next) return null;

  const feas = state.feasibility;
  const spare = totalSpareMinutes(state.gaps);

  return (
    <section className="cc-active-tile" data-urgency={urgencyOf(feas)} style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <span className="cc-at-status">
        <span className="cc-at-dot" />
        Next move
      </span>

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "var(--space-3)" }}>
        <h2 className="cc-at-headline" style={{ margin: 0 }}>
          {feas ? headlineOf(feas) : "Working out your leave time…"}
        </h2>
        {feas ? <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-h3)", color: "var(--ink)" }}>{londonClock(new Date(feas.leaveByMs).toISOString())}</span> : null}
      </div>

      <p className="cc-at-sub" style={{ margin: 0 }}>{lineOf(feas, next)}</p>

      {next.coord && fix ? (
        <NextLegMap origin={{ lat: fix.lat, lng: fix.lng, name: "Your location" }} destination={{ lat: next.coord.lat, lng: next.coord.lng, name: next.title }} mode={next.navMode} onRoute={(r) => setLiveTravelSeconds(r.duration_s)} />
      ) : next.coord ? (
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
          <button type="button" className="cc-btn cc-btn-gold" onClick={() => setLocEnabled(true)}>
            {status === "denied" ? "Location is blocked" : "Use live location"}
          </button>
          <span style={{ fontSize: "var(--fs-label)", color: "var(--ink-dim)" }}>
            {feas?.source === "planned" ? "Using your plan's estimate for now" : ""}
          </span>
        </div>
      ) : null}

      {spare >= 15 ? (
        <p style={{ margin: 0, fontSize: "var(--fs-label)", color: "var(--ink-dim)" }}>
          {spare} min of free time across your day — room to fit something in.
        </p>
      ) : null}
    </section>
  );
}

function urgencyOf(feas: Feasibility | null): "comfortable" | "urgent" | "breach" {
  if (!feas) return "comfortable";
  if (feas.band === "cliff") return "breach";
  if (feas.band === "leave_now" || feas.band === "heads_up") return "urgent";
  return "comfortable";
}

function headlineOf(feas: Feasibility): string {
  if (feas.band === "cliff") return "Running late";
  return leaveByCountdown(feas.slackMin);
}

function lineOf(feas: Feasibility | null, next: SpineAnchor): string {
  const to = `To ${next.title}${next.place && next.place !== next.title ? ` · ${next.place}` : ""}`;
  if (!feas) return to;
  if (feas.band === "cliff") {
    return `${to} — you won't make it ${modeWord(next)} from here. Try a faster way, or take the next service.`;
  }
  const src = feas.source === "live" ? "live from your location" : "from your plan";
  return `${to} · ${feas.travelMinutes} min ${modeWord(next)} · ${src}`;
}

function modeWord(next: SpineAnchor): string {
  return next.navMode === "drive" ? "drive" : next.navMode === "cycle" ? "ride" : "walk";
}
