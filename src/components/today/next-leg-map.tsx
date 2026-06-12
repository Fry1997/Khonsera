"use client";

import { useCallback, useEffect, useState } from "react";
import { NavMap } from "@/components/nav/nav-map";
import { useGuidance } from "@/components/nav/use-guidance";
import { fetchNavRoute } from "@/lib/actions/nav";
import { formatNavDuration, formatNavDistance } from "@/lib/nav/guidance";
import type { NavRoute, NavMode } from "@/lib/nav/types";

// Inline next-leg navigation, embedded in the day-of surface (the chosen
// direction: navigation lives ON the live page, not a detached tool). Shows a
// compact route map for the next leg; "Start" expands to a full-screen guidance
// view that returns you to Today on close. `preview` (demo) skips live GPS so the
// bench shows the flow without watchPosition fighting a fixture route.

type Pt = { lat: number; lng: number; name?: string };

export function NextLegMap({
  destination,
  mode,
  origin,
  preview = false,
}: {
  destination: Pt;
  mode: NavMode;
  origin?: Pt; // omitted → current GPS (real day-of); provided → fixed (demo)
  preview?: boolean;
}) {
  const [route, setRoute] = useState<NavRoute | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [full, setFull] = useState(false);

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
          {route ? `${formatNavDuration(route.duration_s)} · ${formatNavDistance(route.distance_m)}` : " "}
        </span>
        <button type="button" className="cc-btn cc-btn-gold" disabled={!route} onClick={() => setFull(true)}>
          Start — turn by turn
        </button>
      </div>

      {full && route ? <FullLeg route={route} preview={preview} onClose={() => setFull(false)} /> : null}
    </div>
  );
}

// Full-screen guidance that overlays Today and returns to it on close. Live GPS +
// voice when real; a static route preview in the demo bench.
function FullLeg({ route, preview, onClose }: { route: NavRoute; preview: boolean; onClose: () => void }) {
  const { fix, state } = useGuidance(route, !preview, { voice: !preview });
  const start = route.geometry[0];
  const position = fix
    ? { lat: fix.lat, lng: fix.lng, heading: fix.heading }
    : start
      ? { lat: start[0], lng: start[1] }
      : null;
  const maneuver = route.maneuvers[state?.maneuver_index ?? 0];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "var(--paper)", display: "flex", flexDirection: "column" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--rule)" }}>
        <button type="button" className="cc-btn" onClick={onClose}>
          ‹ Back to Today
        </button>
        <span className="cc-eyebrow" style={{ color: "var(--gold-2)" }}>
          {preview ? "Preview" : "Navigating"}
        </span>
      </header>

      <div style={{ flex: 1, minHeight: 0 }}>
        <NavMap route={route} position={position} follow={!preview} />
      </div>

      <div style={{ padding: "var(--space-4)", borderTop: "1px solid var(--rule)", display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-h3)", color: "var(--ink)" }}>
          {state ? formatNavDistance(state.to_maneuver_m) : formatNavDistance(route.distance_m)}
        </span>
        <p style={{ margin: 0 }}>{maneuver?.instruction ?? "Head toward your destination."}</p>
        {preview ? (
          <p style={{ margin: "var(--space-1) 0 0", fontSize: "var(--fs-label)", color: "var(--ink-dim)" }}>
            Live turn-by-turn with spoken guidance starts here on a real journey.
          </p>
        ) : null}
      </div>
    </div>
  );
}
