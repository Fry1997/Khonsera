"use client";

import { useEffect, useMemo, useState } from "react";
import type { SpineAnchor } from "./spine-model";
import { londonClock } from "./spine-model";
import { computeDayState, type EngineAnchor, type Feasibility } from "@/lib/today/engine";
import { fetchNavRoute } from "@/lib/actions/nav";
import { useLivePosition } from "./use-live-position";
import type { NavMode, NavRoute } from "@/lib/nav/types";
import { haversineMeters } from "@/lib/geo";

const HHMM = (ms: number) => londonClock(new Date(ms).toISOString());

function samePoint(a: { lat: number; lng: number } | null | undefined, b: { lat: number; lng: number } | null | undefined): boolean {
  if (!a || !b) return false;
  return Math.abs(a.lat - b.lat) < 0.00015 && Math.abs(a.lng - b.lng) < 0.00015;
}

function urgencyOf(feas: Feasibility | null): "comfortable" | "urgent" | "breach" {
  if (!feas) return "comfortable";
  if (feas.band === "cliff") return "breach";
  if (feas.band === "leave_now" || feas.band === "heads_up") return "urgent";
  return "comfortable";
}

function instruction(feas: Feasibility | null): string {
  if (!feas) return "Working out your leave time";
  if (feas.band === "cliff") return "Leave now — you may be late";
  if (feas.band === "leave_now") return "Leave now";
  if (feas.slackMin <= 60) return `Leave in ${Math.max(0, feas.slackMin)} min`;
  const hours = Math.floor(feas.slackMin / 60);
  const mins = feas.slackMin % 60;
  return `Leave in ${hours}h${mins ? ` ${mins}m` : ""}`;
}

export function LiveDay({ anchors, sub, base }: { anchors: SpineAnchor[]; sub?: string; base?: { lat: number; lng: number } | null }) {
  const [now, setNow] = useState(() => Date.now());
  const [route, setRoute] = useState<NavRoute | null>(null);
  const [onWayToId, setOnWayToId] = useState<string | null>(null);
  const { fix } = useLivePosition(true);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const operationalAnchors = useMemo(() => {
    if (!anchors.length || !base) return anchors;
    const first = anchors[0];
    if (first.role === "stop" && samePoint(first.coord, base)) return anchors.slice(1);
    return anchors;
  }, [anchors, base]);

  const engineAnchors: EngineAnchor[] = useMemo(
    () =>
      operationalAnchors.map((anchor) => ({
        id: anchor.id,
        startMs: anchor.arriveByIso ? Date.parse(anchor.arriveByIso) : null,
        endMs: anchor.endIso ? Date.parse(anchor.endIso) : null,
        plannedTravelMinutes: anchor.plannedTravelMinutes,
        isStation: !!anchor.station,
        bufferMinutes: anchor.bufferMinutes,
      })),
    [operationalAnchors],
  );

  const preliminary = computeDayState({ anchors: engineAnchors, nowMs: now });
  const next = preliminary.nextIndex != null ? operationalAnchors[preliminary.nextIndex] : null;
  const origin = fix ? { lat: fix.lat, lng: fix.lng, name: "Your location" } : base ? { ...base, name: "Home" } : null;
  const mode: NavMode = next?.navMode ?? "walk";

  useEffect(() => {
    setRoute(null);
    if (!origin || !next?.coord) return;
    let active = true;
    void fetchNavRoute({ origin, destination: { ...next.coord, name: next.title }, mode }).then((result) => {
      if (active && result.ok) setRoute(result.value);
    });
    return () => {
      active = false;
    };
  }, [origin?.lat, origin?.lng, next?.id, next?.coord?.lat, next?.coord?.lng, next?.title, mode]);

  useEffect(() => {
    if (!next?.coord || !fix || onWayToId !== next.id) return;
    const distance = haversineMeters(fix.lat, fix.lng, next.coord.lat, next.coord.lng);
    if (distance <= Math.max(45, fix.accuracy * 1.5)) setOnWayToId(null);
  }, [fix, next?.id, next?.coord?.lat, next?.coord?.lng, onWayToId]);

  const state = computeDayState({
    anchors: engineAnchors,
    nowMs: now,
    liveTravelSeconds: route?.duration_s ?? null,
  });

  if (!next) {
    return (
      <section className="cc-active-tile" data-urgency="comfortable">
        <span className="cc-at-status"><span className="cc-at-dot" />All done</span>
        <h2 className="cc-at-headline">That’s your travel day</h2>
        {sub ? <p className="cc-at-sub">{sub}</p> : null}
      </section>
    );
  }

  const feas = state.feasibility;
  const target = next.station?.name ?? next.title;
  const isOnWay = onWayToId === next.id;
  const etaMs = route ? now + route.duration_s * 1000 : null;
  const setOffClock = !isOnWay && feas && feas.band !== "cliff" ? HHMM(feas.leaveByMs) : null;
  const figure = isOnWay && etaMs != null ? HHMM(etaMs) : setOffClock;
  const parts = figure?.split(":") ?? null;
  const arriveByMs = next.arriveByIso ? Date.parse(next.arriveByIso) : null;
  const stationReadyMs = arriveByMs != null && feas ? arriveByMs - feas.bufferMinutes * 60_000 : arriveByMs;
  const arrivalLabel = stationReadyMs != null ? HHMM(stationReadyMs) : null;

  return (
    <section className="cc-active-tile cc-setoff" data-urgency={urgencyOf(feas)}>
      <span className="cc-at-status"><span className="cc-at-dot" />{isOnWay ? "On the way" : "Next move"}</span>

      <div className="pg cc-setoff-sheet">
        <div className="cc-setoff-eyb">
          <span className="cc-setoff-kicker">{isOnWay ? "ETA" : feas?.band === "cliff" ? "Leave now" : "Leave by"}</span>
          <span className="cc-setoff-for">for {target}</span>
        </div>
        {parts ? (
          <div className="mono engr-deep cc-setoff-figure" aria-label={`${isOnWay ? "ETA" : "Leave by"} ${figure}`}>
            <span>{parts[0]}</span><span className="cc-setoff-colon">:</span><span>{parts[1]}</span>
          </div>
        ) : (
          <div className="mono engr-deep cc-setoff-figure cc-setoff-figure--word">Now</div>
        )}
        <p className="cc-setoff-move">
          {isOnWay
            ? `${route ? Math.max(1, Math.round(route.duration_s / 60)) : feas?.travelMinutes ?? "—"} min remaining`
            : `${instruction(feas)} · ${feas ? `${feas.travelMinutes} min ${mode === "drive" ? "by car" : mode}` : "route pending"}`}
          {!isOnWay && arrivalLabel ? ` · arrive by ${arrivalLabel}` : ""}
          {!isOnWay && feas?.bufferMinutes ? ` · ${feas.bufferMinutes} min early` : ""}
        </p>
      </div>

      {next.pass?.ticket.legs[0]?.barcodes?.length ? (
        <p style={{ margin: 0, fontSize: "var(--fs-label)", color: "var(--ink-dim)" }}>Your ticket is ready on the journey below.</p>
      ) : null}

      {!isOnWay ? (
        <button
          type="button"
          className="cc-btn cc-btn-gold"
          disabled={!route}
          onClick={() => setOnWayToId(next.id)}
        >
          {route ? "I’m on my way" : "Finding route…"}
        </button>
      ) : null}
    </section>
  );
}