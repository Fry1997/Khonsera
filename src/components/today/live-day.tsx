"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SpineAnchor, TransitionProgressState } from "./spine-model";
import { londonClock } from "./spine-model";
import { computeDayState, type EngineAnchor, type Feasibility } from "@/lib/today/engine";
import { fetchNavRoute } from "@/lib/actions/nav";
import { setLiveTransitionProgress } from "@/lib/actions/live-transition";
import { useLivePosition } from "./use-live-position";
import type { NavMode, NavRoute } from "@/lib/nav/types";
import { haversineMeters } from "@/lib/geo";

const HHMM = (ms: number) => londonClock(new Date(ms).toISOString());

function samePoint(
  a: { lat: number; lng: number } | null | undefined,
  b: { lat: number; lng: number } | null | undefined,
): boolean {
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
  if (feas.band === "cliff") return "Leave now — this connection may no longer work";
  if (feas.band === "leave_now") return "Leave now";
  if (feas.slackMin <= 60) return `Leave in ${Math.max(0, feas.slackMin)} min`;
  const hours = Math.floor(feas.slackMin / 60);
  const mins = feas.slackMin % 60;
  return `Leave in ${hours}h${mins ? ` ${mins}m` : ""}`;
}

function progressFor(
  next: SpineAnchor | null,
  optimistic: { anchorId: string; state: TransitionProgressState } | null,
): TransitionProgressState | null {
  if (!next) return null;
  if (optimistic?.anchorId === next.id) return optimistic.state;
  return next.transitionState ?? null;
}

export function LiveDay({
  anchors,
  sub,
  base,
}: {
  anchors: SpineAnchor[];
  sub?: string;
  base?: { lat: number; lng: number } | null;
}) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [route, setRoute] = useState<NavRoute | null>(null);
  const [optimisticProgress, setOptimisticProgress] = useState<{
    anchorId: string;
    state: TransitionProgressState;
  } | null>(null);
  const [progressError, setProgressError] = useState<string | null>(null);
  const arrivalCommit = useRef<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  // Defensive compatibility for older projections: the saved base is context,
  // never an obligation. TodayPage now removes it before mapping, but this keeps
  // the live engine safe when a legacy/demo projection still includes it.
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
        notBeforeMs: anchor.notBeforeIso ? Date.parse(anchor.notBeforeIso) : null,
        isBlockingSpan: anchor.type === "shift",
      })),
    [operationalAnchors],
  );

  const preliminary = computeDayState({ anchors: engineAnchors, nowMs: now });
  const next = preliminary.nextIndex != null ? operationalAnchors[preliminary.nextIndex] : null;
  const progress = progressFor(next, optimisticProgress);
  const isOnWay = progress === "live";
  const isArrived = progress === "done";
  const { fix } = useLivePosition(isOnWay);
  const origin = fix
    ? { lat: fix.lat, lng: fix.lng, name: "Your location" }
    : base
      ? { ...base, name: "Home" }
      : null;
  const mode: NavMode = next?.navMode ?? "walk";

  useEffect(() => {
    setRoute(null);
    if (!origin || !next?.coord || isArrived) return;
    let active = true;
    void fetchNavRoute({ origin, destination: { ...next.coord, name: next.title }, mode }).then((result) => {
      if (active && result.ok) setRoute(result.value);
    });
    return () => {
      active = false;
    };
  }, [origin?.lat, origin?.lng, next?.id, next?.coord?.lat, next?.coord?.lng, next?.title, mode, isArrived]);

  useEffect(() => {
    if (!next?.coord || !next.inboundTransitionId || !fix || !isOnWay) return;
    const distance = haversineMeters(fix.lat, fix.lng, next.coord.lat, next.coord.lng);
    const arrivalRadius = Math.max(45, fix.accuracy * 1.5);
    if (distance > arrivalRadius || arrivalCommit.current === next.inboundTransitionId) return;

    arrivalCommit.current = next.inboundTransitionId;
    setOptimisticProgress({ anchorId: next.id, state: "done" });
    void setLiveTransitionProgress({ transitionId: next.inboundTransitionId, state: "done" }).then((result) => {
      if (!result.ok) {
        arrivalCommit.current = null;
        setOptimisticProgress({ anchorId: next.id, state: "live" });
        setProgressError(result.error);
        return;
      }
      router.refresh();
    });
  }, [fix, isOnWay, next?.id, next?.coord?.lat, next?.coord?.lng, next?.inboundTransitionId, router]);

  useEffect(() => {
    arrivalCommit.current = null;
    setProgressError(null);
    setOptimisticProgress(null);
  }, [next?.id]);

  const state = computeDayState({
    anchors: engineAnchors,
    nowMs: now,
    liveTravelSeconds: isOnWay ? route?.duration_s ?? null : null,
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
  const etaMs = route ? now + route.duration_s * 1000 : null;
  const setOffClock = !isOnWay && !isArrived && feas && feas.band !== "cliff" ? HHMM(feas.leaveByMs) : null;
  const arrivedFigure = next.station && next.role === "departure" && next.arriveByIso
    ? londonClock(next.arriveByIso)
    : londonClock(next.actualArrivedAt) ?? HHMM(now);
  const figure = isArrived ? arrivedFigure : isOnWay && etaMs != null ? HHMM(etaMs) : setOffClock;
  const parts = figure?.split(":") ?? null;
  const arriveByMs = next.arriveByIso ? Date.parse(next.arriveByIso) : null;
  const routeArrivalMs = arriveByMs != null && feas ? arriveByMs - feas.bufferMinutes * 60_000 : arriveByMs;
  const arrivalLabel = routeArrivalMs != null ? HHMM(routeArrivalMs) : null;
  const constrainedLabel =
    !isOnWay && !isArrived && feas?.constrainedByPrevious && next.notBeforeIso
      ? `Your shift ends at ${londonClock(next.notBeforeIso)}`
      : null;

  async function startJourney() {
    if (!next.inboundTransitionId) return;
    setProgressError(null);
    setOptimisticProgress({ anchorId: next.id, state: "live" });
    const result = await setLiveTransitionProgress({
      transitionId: next.inboundTransitionId,
      state: "live",
    });
    if (!result.ok) {
      setOptimisticProgress(null);
      setProgressError(result.error);
      return;
    }
    router.refresh();
  }

  const kicker = isArrived
    ? next.station && next.role === "departure"
      ? "Train at"
      : "Arrived"
    : isOnWay
      ? "ETA"
      : feas?.band === "cliff"
        ? "Leave now"
        : "Leave by";
  const status = isArrived ? "Arrived" : isOnWay ? "On the way" : "Next move";

  return (
    <section className="cc-active-tile cc-setoff" data-urgency={isArrived ? "comfortable" : urgencyOf(feas)}>
      <span className="cc-at-status"><span className="cc-at-dot" />{status}</span>

      <div className="pg cc-setoff-sheet">
        <div className="cc-setoff-eyb">
          <span className="cc-setoff-kicker">{kicker}</span>
          <span className="cc-setoff-for">{isArrived ? `at ${target}` : `for ${target}`}</span>
        </div>
        {parts ? (
          <div className="mono engr-deep cc-setoff-figure" aria-label={`${kicker} ${figure}`}>
            <span>{parts[0]}</span><span className="cc-setoff-colon">:</span><span>{parts[1]}</span>
          </div>
        ) : (
          <div className="mono engr-deep cc-setoff-figure cc-setoff-figure--word">Now</div>
        )}
        <p className="cc-setoff-move">
          {isArrived
            ? next.station && next.role === "departure"
              ? `${target} · you’re ready for the ${londonClock(next.arriveByIso)} service`
              : `You’ve reached ${target}`
            : isOnWay
              ? `${route ? Math.max(1, Math.round(route.duration_s / 60)) : feas?.travelMinutes ?? "—"} min remaining`
              : `${instruction(feas)} · ${feas ? `${feas.travelMinutes} min ${mode === "drive" ? "by car" : mode}` : "route pending"}`}
          {!isOnWay && !isArrived && arrivalLabel ? ` · arrive by ${arrivalLabel}` : ""}
          {!isOnWay && !isArrived && feas?.bufferMinutes ? ` · ${feas.bufferMinutes} min early` : ""}
        </p>
        {constrainedLabel ? <p className="cc-setoff-move">{constrainedLabel}; the preferred {feas?.preferredBufferMinutes ?? 0}-minute margin will reduce to {feas?.bufferMinutes ?? 0} minutes.</p> : null}
      </div>

      {next.pass?.ticket.legs[0]?.barcodes?.length ? (
        <p style={{ margin: 0, fontSize: "var(--fs-label)", color: "var(--ink-dim)" }}>
          Your ticket is ready on the journey below.
        </p>
      ) : null}

      {!isOnWay && !isArrived && next.inboundTransitionId ? (
        <button
          type="button"
          className="cc-btn cc-btn-gold"
          disabled={!route}
          onClick={() => void startJourney()}
        >
          {route ? "I’m on my way" : "Finding route…"}
        </button>
      ) : null}
      {progressError ? <p className="cc-sheet-error">{progressError}</p> : null}
    </section>
  );
}
