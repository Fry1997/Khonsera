"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { fetchNavRoute } from "@/lib/actions/nav";
import { computeLeaveBy, leaveByCountdown, type LeaveByResult } from "@/lib/planning/leave-by";
import { formatNavDuration } from "@/lib/nav/guidance";
import type { SpineAnchor } from "./spine-model";
import { navigateHref, londonClock } from "./spine-model";

// The single most important number on Today: when to leave for the next anchor,
// computed from REAL travel time. It asks the device where it is, routes to the
// anchor (Valhalla, the open stack), and back-calculates leave-by = arrive −
// travel − buffer. Degrades cleanly: GPS denied or offline → the plan's own
// computed leg time; no arrive-by or coordinates → it doesn't render.
//
// `now` ticks every 30s so the countdown and urgency stay live without a
// reload (this is the "events move up the page" pulse the spine shares).

type Source = "live" | "planned" | null;

export function NextMove({ anchor }: { anchor: SpineAnchor }) {
  const arriveByMs = anchor.arriveByIso ? new Date(anchor.arriveByIso).getTime() : null;

  const [now, setNow] = useState(() => Date.now());
  const [travelSeconds, setTravelSeconds] = useState<number | null>(
    anchor.plannedTravelMinutes != null ? anchor.plannedTravelMinutes * 60 : null,
  );
  const [source, setSource] = useState<Source>(anchor.plannedTravelMinutes != null ? "planned" : null);
  const [checking, setChecking] = useState(false);
  const fetchedFor = useRef<string | null>(null);

  const refreshTravel = useCallback(async () => {
    if (!anchor.coord || typeof navigator === "undefined" || !navigator.geolocation || !navigator.onLine) return;
    setChecking(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 }),
      );
      const res = await fetchNavRoute({
        origin: { lat: pos.coords.latitude, lng: pos.coords.longitude, name: "Current location" },
        destination: { lat: anchor.coord.lat, lng: anchor.coord.lng, name: anchor.title },
        mode: anchor.navMode,
      });
      if (res.ok) {
        setTravelSeconds(res.value.duration_s);
        setSource("live");
      }
    } catch {
      /* keep the planned fallback */
    } finally {
      setChecking(false);
    }
  }, [anchor.coord, anchor.navMode, anchor.title]);

  // Show the planned leave-by immediately; upgrade to live travel only if the
  // user has ALREADY granted location — never pop a permission prompt just for
  // loading Today. An explicit "Recheck"/"Navigate" tap is where consent lives.
  useEffect(() => {
    if (fetchedFor.current !== anchor.id) {
      fetchedFor.current = anchor.id;
      void (async () => {
        try {
          const perms = (navigator as Navigator & { permissions?: Permissions }).permissions;
          if (perms?.query) {
            const status = await perms.query({ name: "geolocation" as PermissionName });
            if (status.state === "granted") void refreshTravel();
          }
        } catch {
          /* no Permissions API — wait for an explicit tap */
        }
      })();
    }
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [anchor.id, refreshTravel]);

  if (arriveByMs == null) return null;

  const result: LeaveByResult | null =
    travelSeconds != null ? computeLeaveBy(arriveByMs, travelSeconds, now) : null;

  const href = navigateHref(anchor);

  return (
    <section
      className="cc-active-tile"
      data-urgency={result?.urgency ?? "comfortable"}
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}
    >
      <span className="cc-at-status">
        <span className="cc-at-dot" />
        Next move
      </span>

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "var(--space-3)" }}>
        <h2 className="cc-at-headline" style={{ margin: 0 }}>
          {result ? leaveByCountdown(result.minutesUntilLeave) : "Working out your leave time…"}
        </h2>
        {result ? (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-h3)", color: "var(--ink)" }}>
            {londonClock(result.leaveByIso)}
          </span>
        ) : null}
      </div>

      <p className="cc-at-sub" style={{ margin: 0 }}>
        To {anchor.title}
        {anchor.place && anchor.place !== anchor.title ? ` · ${anchor.place}` : ""}
        {anchor.arriveByIso ? ` · arrive by ${londonClock(anchor.arriveByIso)}` : ""}
      </p>

      {result ? (
        <p style={{ margin: 0, fontSize: "var(--fs-label)", color: "var(--ink-dim)" }}>
          {formatNavDuration(travelSeconds!)} {modeWord(anchor.navMode)} · {result.bufferMinutes} min to get ready
          {source === "live" ? " · live from your location" : source === "planned" ? " · from your plan" : ""}
        </p>
      ) : null}

      <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-1)" }}>
        {href ? (
          <Link href={href} className="cc-btn cc-btn-gold">
            Navigate there
          </Link>
        ) : null}
        {anchor.coord ? (
          <button type="button" className="cc-btn" onClick={refreshTravel} disabled={checking}>
            {checking ? "Checking…" : "Recheck"}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function modeWord(mode: SpineAnchor["navMode"]): string {
  return mode === "drive" ? "drive" : mode === "cycle" ? "ride" : "walk";
}
