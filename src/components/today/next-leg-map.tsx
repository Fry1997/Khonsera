"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LazyNavMap as NavMap } from "@/components/nav/lazy-nav-map";
import { requestHeadingPermission } from "@/components/nav/use-heading";
import { NavSessionView } from "@/components/nav/guidance/nav-session-view";
import { fetchNavRoute } from "@/lib/actions/nav";
import { formatNavDuration, formatNavDistance } from "@/lib/nav/guidance";
import type { NavCommitment } from "@/lib/nav/session";
import type { NavRoute, NavMode } from "@/lib/nav/types";

// Inline next-leg navigation, embedded in the day-of surface (the chosen
// direction: navigation lives ON the live page, not a detached tool). Shows a
// compact route map for the next leg and reports the route up (so leave-by can
// be predicted from the real path); "Start" expands to the full 3D FOV guidance
// view that returns you to Today on close. `preview` (demo) drives a simulated
// moving dot so the bench shows the real nav view without a live journey.

type Pt = { lat: number; lng: number; name?: string };

export function NextLegMap({
  destination,
  mode,
  origin,
  preview = false,
  onRoute,
}: {
  destination: Pt;
  mode: NavMode;
  origin?: Pt; // omitted → current GPS (real day-of); provided → fixed (demo)
  preview?: boolean;
  onRoute?: (route: NavRoute) => void;
}) {
  const [route, setRoute] = useState<NavRoute | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [full, setFull] = useState(false);
  const onRouteRef = useRef(onRoute);
  useEffect(() => {
    onRouteRef.current = onRoute;
  });

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      let o = origin;
      if (!o) {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 }),
        );
        o = { lat: pos.coords.latitude, lng: pos.coords.longitude, name: "Current location" };
      }
      const r = await fetchNavRoute({
        origin: { lat: o.lat, lng: o.lng, name: o.name ?? "Start" },
        destination: { lat: destination.lat, lng: destination.lng, name: destination.name ?? "Destination" },
        mode,
      });
      if (r.ok) {
        setRoute(r.value);
        setStatus("ready");
        onRouteRef.current?.(r.value);
      } else setStatus("error");
    } catch {
      setStatus("error");
    }
  }, [origin, destination.lat, destination.lng, destination.name, mode]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <div style={{ position: "relative", borderRadius: "var(--radius-md)", overflow: "hidden", border: "1px solid var(--rule)" }}>
        <NavMap route={route} height={190} />
        {status !== "ready" ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "color-mix(in oklab, var(--paper) 64%, transparent)",
              fontSize: "var(--fs-label)",
              color: "var(--ink-dim)",
            }}
          >
            {status === "loading" ? "Finding your route…" : "Route unavailable — check your connection."}
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
        <span style={{ fontSize: "var(--fs-label)", color: "var(--ink-dim)" }}>
          {route ? `${formatNavDuration(route.duration_s)} · ${formatNavDistance(route.distance_m)}` : " "}
        </span>
        <button
          type="button"
          className="cc-btn cc-btn-gold"
          disabled={!route}
          onClick={() => {
            void requestHeadingPermission(); // iOS compass gate — needs this user gesture
            setFull(true);
          }}
        >
          Start — turn by turn
        </button>
      </div>

      {full && route ? <FullLeg route={route} preview={preview} onClose={() => setFull(false)} /> : null}
    </div>
  );
}

// Full-screen guidance overlaying Today, returning to it on close. The premium
// nav view: the screen becomes the map (3D heading-up, follow camera), a FOV
// cone driven by the COMPASS (so it shows which way you face even standing
// still), a top maneuver banner with the turn after it, and an ETA / time /-
// distance-remaining strip. Live GPS + voice when real; a simulated moving dot
// in the demo so the bench shows the same view. Exported so the day-of card can
// open it directly on Navigate (no inline map needed).
export function FullLeg({ route, preview, onClose }: { route: NavRoute; preview: boolean; onClose: () => void }) {
  // The day's downstream commitments give the event-ETA chip its meaning. The Today
  // reader that turns real stops + D77 buffers into these is the next plumbing step;
  // until then live navigation shows the premium guidance (no fabricated arrive-by —
  // the honesty rule), while the bench/preview carries one sample commitment so the
  // full surface — chip included — is demonstrable.
  const commitments: NavCommitment[] = useMemo(() => {
    if (!preview) return [];
    return [{
      id: "sample",
      name: "your appointment",
      place: "Destination",
      neededByIso: new Date(Date.now() + route.duration_s * 1000 + 12 * 60_000).toISOString(),
      bufferMin: 10,
      downstreamMin: 0,
    }];
  }, [preview, route.duration_s]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000 }}>
      <NavSessionView
        route={route}
        active={!preview}
        preview={preview}
        voice={!preview}
        commitments={commitments}
        scheduledRemainingMin={Math.round(route.duration_s / 60)}
        online={typeof navigator !== "undefined" ? navigator.onLine : true}
        onEnd={onClose}
      />
    </div>
  );
}
