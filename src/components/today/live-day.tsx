"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SpineAnchor, TransitionProgressState } from "./spine-model";
import { londonClock } from "./spine-model";
import {
  computeDayState,
  type EngineAnchor,
  type Feasibility,
} from "@/lib/today/engine";
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

function urgencyOf(
  feas: Feasibility | null,
): "comfortable" | "urgent" | "breach" {
  if (!feas) return "comfortable";
  if (feas.band === "cliff") return "breach";
  if (feas.band === "leave_now" || feas.band === "heads_up") return "urgent";
  return "comfortable";
}

function instruction(feas: Feasibility | null): string {
  if (!feas) return "Working out your leave time";
  if (feas.band === "cliff")
    return "Leave now — this connection may no longer work";
  if (feas.band === "leave_now") return "Leave now";
  if (feas.slackMin <= 60) return `Leave in ${Math.max(0, feas.slackMin)} min`;
  const hours = Math.floor(feas.slackMin / 60);
  const mins = feas.slackMin % 60;
  return `Leave in ${hours}h${mins ? ` ${mins}m` : ""}`;
}

function compactDuration(minutes: number): string {
  const safeMinutes = Math.max(0, minutes);
  if (safeMinutes < 60) return `${safeMinutes}m`;
  const hours = Math.floor(safeMinutes / 60);
  const remainder = safeMinutes % 60;
  return `${hours}h${remainder ? ` ${remainder}m` : ""}`;
}

function NextActionIcon({
  name,
}: {
  name: "arrow" | "share" | "reroute" | "ticket";
}) {
  const path = {
    arrow: "M5 12h14m-5-5 5 5-5 5",
    share:
      "M18 8a3 3 0 1 0-2.83-4A3 3 0 0 0 18 8ZM6 15a3 3 0 1 0 2.83 4A3 3 0 0 0 6 15Zm12 5a3 3 0 1 0-2.83-4A3 3 0 0 0 18 20ZM8.6 13.7l6.8-3.4M8.6 16.3l6.8 3.4",
    reroute:
      "M16 3h5v5M4 20l6.5-6.5a4 4 0 0 1 5.7 0L21 18M21 3l-6.5 6.5M4 4l5 5",
    ticket:
      "M3 7a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a3 3 0 0 0 0 6v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a3 3 0 0 0 0-6V7Zm9-2v14",
  }[name];

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={path} />
    </svg>
  );
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
  const [routeRefresh, setRouteRefresh] = useState(0);
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

  // Base bookends are routing context, not obligations. TodayPage now removes
  // them before mapping; this guard also protects demo and older projections.
  const operationalAnchors = useMemo(() => {
    if (!anchors.length || !base) return anchors;
    const first = anchors[0];
    if (first.role === "stop" && samePoint(first.coord, base))
      return anchors.slice(1);
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
        notBeforeMs: anchor.notBeforeIso
          ? Date.parse(anchor.notBeforeIso)
          : null,
        isBlockingSpan: anchor.type === "shift",
      })),
    [operationalAnchors],
  );

  const preliminary = computeDayState({ anchors: engineAnchors, nowMs: now });
  const next =
    preliminary.nextIndex != null
      ? operationalAnchors[preliminary.nextIndex]
      : null;
  const isScheduledOutcome =
    next?.role === "arrival" || next?.role === "changeover";
  const progress = progressFor(next, optimisticProgress);
  const isOnWay = !isScheduledOutcome && progress === "live";
  const isArrived = !isScheduledOutcome && progress === "done";

  // A current fix improves the leave-by before the user sets off as well as the
  // ETA afterwards. At the office this prevents the return route falling back to
  // the saved home base.
  const { fix } = useLivePosition(true);
  const origin = fix
    ? { lat: fix.lat, lng: fix.lng, name: "Your location" }
    : base
      ? { ...base, name: "Home" }
      : null;
  const mode: NavMode = next?.navMode ?? "walk";

  useEffect(() => {
    setRoute(null);
    if (!origin || !next?.coord || isArrived || isScheduledOutcome) return;
    let active = true;
    void fetchNavRoute({
      origin,
      destination: { ...next.coord, name: next.title },
      mode,
    }).then((result) => {
      if (active && result.ok) setRoute(result.value);
    });
    return () => {
      active = false;
    };
  }, [
    origin?.lat,
    origin?.lng,
    next?.id,
    next?.coord?.lat,
    next?.coord?.lng,
    next?.title,
    mode,
    isArrived,
    isScheduledOutcome,
    routeRefresh,
  ]);

  useEffect(() => {
    if (
      isScheduledOutcome ||
      !next?.coord ||
      !next.inboundTransitionId ||
      !fix ||
      !isOnWay
    )
      return;
    const distance = haversineMeters(
      fix.lat,
      fix.lng,
      next.coord.lat,
      next.coord.lng,
    );
    const arrivalRadius = Math.max(45, fix.accuracy * 1.5);
    if (
      distance > arrivalRadius ||
      arrivalCommit.current === next.inboundTransitionId
    )
      return;

    arrivalCommit.current = next.inboundTransitionId;
    setOptimisticProgress({ anchorId: next.id, state: "done" });
    void setLiveTransitionProgress({
      transitionId: next.inboundTransitionId,
      state: "done",
    }).then((result) => {
      if (!result.ok) {
        arrivalCommit.current = null;
        setOptimisticProgress({ anchorId: next.id, state: "live" });
        setProgressError(result.error);
        return;
      }
      router.refresh();
    });
  }, [
    fix,
    isOnWay,
    isScheduledOutcome,
    next?.id,
    next?.coord?.lat,
    next?.coord?.lng,
    next?.inboundTransitionId,
    router,
  ]);

  useEffect(() => {
    arrivalCommit.current = null;
    setProgressError(null);
    setOptimisticProgress(null);
  }, [next?.id]);

  const state = computeDayState({
    anchors: engineAnchors,
    nowMs: now,
    liveTravelSeconds: !isScheduledOutcome ? (route?.duration_s ?? null) : null,
  });

  if (!next) {
    return (
      <section className="cc-active-tile" data-urgency="comfortable">
        <span className="cc-at-status">
          <span className="cc-at-dot" />
          All done
        </span>
        <h2 className="cc-at-headline">That’s your travel day</h2>
        {sub ? <p className="cc-at-sub">{sub}</p> : null}
      </section>
    );
  }

  const feas = state.feasibility;
  const target = next.station?.name ?? next.title;
  const etaMs = route ? now + route.duration_s * 1000 : null;
  const setOffClock =
    !isOnWay &&
    !isArrived &&
    !isScheduledOutcome &&
    feas &&
    feas.band !== "cliff"
      ? HHMM(feas.leaveByMs)
      : null;
  const arrivedFigure =
    next.station && next.role === "departure" && next.arriveByIso
      ? londonClock(next.arriveByIso)
      : (londonClock(next.actualArrivedAt) ?? HHMM(now));

  const scheduledStartMs = next.arriveByIso
    ? Date.parse(next.arriveByIso)
    : null;
  const changeHasArrived =
    next.role === "changeover" &&
    scheduledStartMs != null &&
    now >= scheduledStartMs;
  const scheduledFigure = changeHasArrived
    ? londonClock(next.endIso)
    : londonClock(next.arriveByIso);
  const figure = isScheduledOutcome
    ? scheduledFigure
    : isArrived
      ? arrivedFigure
      : isOnWay && etaMs != null
        ? HHMM(etaMs)
        : setOffClock;
  const parts = figure?.split(":") ?? null;
  const arriveByMs = next.arriveByIso ? Date.parse(next.arriveByIso) : null;
  const routeArrivalMs =
    arriveByMs != null && feas
      ? arriveByMs - feas.bufferMinutes * 60_000
      : arriveByMs;
  const arrivalLabel = routeArrivalMs != null ? HHMM(routeArrivalMs) : null;
  const constrainedLabel =
    !isOnWay &&
    !isArrived &&
    !isScheduledOutcome &&
    feas?.constrainedByPrevious &&
    next.notBeforeIso
      ? `Your shift ends at ${londonClock(next.notBeforeIso)}`
      : null;

  async function shareTrip() {
    const url = window.location.href;
    if (navigator.share) {
      await navigator
        .share({
          title: "My Khonsera travel day",
          text: `Follow my next move to ${target}.`,
          url,
        })
        .catch(() => undefined);
      return;
    }
    await navigator.clipboard?.writeText(url);
  }

  const kicker = isScheduledOutcome
    ? changeHasArrived
      ? "Next train"
      : "Arrive"
    : isArrived
      ? next.station && next.role === "departure"
        ? "Train at"
        : "Arrived"
      : isOnWay
        ? "ETA"
        : feas?.band === "cliff"
          ? "Leave now"
          : "Leave by";
  const status = isScheduledOutcome
    ? changeHasArrived
      ? "Changing"
      : "On board"
    : isArrived
      ? "Arrived"
      : isOnWay
        ? "On the way"
        : "Next move";

  const scheduledCopy = changeHasArrived
    ? `${londonClock(next.endIso)} onward from ${target}`
    : next.role === "changeover"
      ? `${londonClock(next.arriveByIso)} arrival · ${Math.max(0, Math.round(((next.endIso ? Date.parse(next.endIso) : 0) - (next.arriveByIso ? Date.parse(next.arriveByIso) : 0)) / 60_000))} min to change`
      : `Scheduled arrival at ${target}`;
  const isPreparing =
    !isOnWay && !isArrived && !isScheduledOutcome && feas != null;
  const countdownLabel =
    feas && isPreparing && feas.band !== "cliff" && feas.band !== "leave_now"
      ? compactDuration(feas.slackMin)
      : null;
  const countdownOffset = isPreparing
    ? 244 - Math.min(1, Math.max(0, feas?.slackMin ?? 0) / 120) * 244
    : 244;
  const movementCopy = isScheduledOutcome
    ? scheduledCopy
    : isArrived
      ? next.station && next.role === "departure"
        ? `${target} · you’re ready for the ${londonClock(next.arriveByIso)} service`
        : `You’ve reached ${target}`
      : isOnWay
        ? `${route ? Math.max(1, Math.round(route.duration_s / 60)) : (feas?.travelMinutes ?? "—")} min remaining`
        : instruction(feas);

  return (
    <section
      className="cc-active-tile cc-setoff"
      data-urgency={
        isArrived || isScheduledOutcome ? "comfortable" : urgencyOf(feas)
      }
    >
      <span className="cc-at-status">
        <span className="cc-at-dot" />
        {status}
      </span>

      <div className="pg cc-setoff-sheet">
        <div className="cc-setoff-eyb">
          <span className="cc-setoff-kicker">{kicker}</span>
          <span className="cc-setoff-for">
            {isArrived ? `at ${target}` : `for ${target}`}
          </span>
        </div>
        <div className="cc-setoff-core">
          {parts ? (
            <div
              className="mono cc-setoff-figure"
              aria-label={`${kicker} ${figure}`}
            >
              <span>{parts[0]}</span>
              <span className="cc-setoff-colon">:</span>
              <span>{parts[1]}</span>
            </div>
          ) : (
            <div className="cc-setoff-figure cc-setoff-figure--word">Now</div>
          )}
          {countdownLabel ? (
            <div
              className="cc-leave-ring"
              aria-label={`Leave in ${countdownLabel}`}
            >
              <svg viewBox="0 0 100 100" aria-hidden>
                <circle
                  className="cc-leave-ring-track"
                  cx="50"
                  cy="50"
                  r="39"
                />
                <circle
                  className="cc-leave-ring-progress"
                  cx="50"
                  cy="50"
                  r="39"
                  style={{ strokeDashoffset: countdownOffset }}
                />
              </svg>
              <span>
                Leave in<strong>{countdownLabel}</strong>
              </span>
            </div>
          ) : null}
        </div>
        {isPreparing ? (
          <div className="cc-next-facts">
            <span>
              {feas.travelMinutes} min {mode === "drive" ? "by car" : mode}
            </span>
            {arrivalLabel ? <span>Arrive by {arrivalLabel}</span> : null}
            {feas.bufferMinutes > 0 ? (
              <span>{feas.bufferMinutes} min early</span>
            ) : null}
          </div>
        ) : null}
        <p className="cc-setoff-move">{movementCopy}</p>
        {constrainedLabel ? (
          <p className="cc-setoff-move">
            {constrainedLabel}; the preferred{" "}
            {feas?.preferredBufferMinutes ?? 0}-minute margin will reduce to{" "}
            {feas?.bufferMinutes ?? 0} minutes.
          </p>
        ) : null}
      </div>

      {next.pass?.ticket.legs[0]?.barcodes?.length ? (
        <p
          style={{
            margin: 0,
            fontSize: "var(--fs-label)",
            color: "var(--ink-dim)",
          }}
        >
          Your ticket is ready on the journey below.
        </p>
      ) : null}

      <div className="cc-next-actions">
        <button
          type="button"
          className="cc-next-action cc-next-action--primary"
          onClick={() => router.push("/navigate")}
        >
          <span>View best route</span>
          <NextActionIcon name="arrow" />
        </button>
        <button
          type="button"
          className="cc-next-action"
          onClick={() => void shareTrip()}
        >
          <NextActionIcon name="share" />
          <span>Share trip</span>
        </button>
        <button
          type="button"
          className="cc-next-action"
          disabled={!origin || !next.coord}
          onClick={() => {
            setRoute(null);
            setRouteRefresh((value) => value + 1);
          }}
        >
          <NextActionIcon name="reroute" />
          <span>Re-route</span>
        </button>
        <button
          type="button"
          className="cc-next-action"
          onClick={() => router.push("/wallet")}
        >
          <NextActionIcon name="ticket" />
          <span>Tickets</span>
        </button>
      </div>

      {progressError ? <p className="cc-sheet-error">{progressError}</p> : null}
    </section>
  );
}
