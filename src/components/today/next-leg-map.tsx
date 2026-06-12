"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { NavMap } from "@/components/nav/nav-map";
import { useGuidance } from "@/components/nav/use-guidance";
import { useHeading, requestHeadingPermission } from "@/components/nav/use-heading";
import { ManeuverGlyph } from "@/components/nav/maneuver-glyph";
import { fetchNavRoute } from "@/lib/actions/nav";
import { formatNavDuration, formatNavDistance } from "@/lib/nav/guidance";
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

function bearing(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const dLng = toRad(b[1] - a[1]);
  const y = Math.sin(dLng) * Math.cos(toRad(b[0]));
  const x = Math.cos(toRad(a[0])) * Math.sin(toRad(b[0])) - Math.sin(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

const clock = (ms: number) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ms));

// Full-screen guidance overlaying Today, returning to it on close. The premium
// nav view: the screen becomes the map (3D heading-up, follow camera), a FOV
// cone driven by the COMPASS (so it shows which way you face even standing
// still), a top maneuver banner with the turn after it, and an ETA / time /-
// distance-remaining strip. Live GPS + voice when real; a simulated moving dot
// in the demo so the bench shows the same view. Exported so the day-of card can
// open it directly on Navigate (no inline map needed).
export function FullLeg({ route, preview, onClose }: { route: NavRoute; preview: boolean; onClose: () => void }) {
  const { fix, state } = useGuidance(route, !preview, { voice: !preview });
  const compass = useHeading(!preview);
  const [simIdx, setSimIdx] = useState(0);

  useEffect(() => {
    if (!preview || route.geometry.length < 2) return;
    const stride = Math.max(1, Math.floor(route.geometry.length / 40));
    const id = setInterval(() => {
      setSimIdx((i) => (i + stride >= route.geometry.length - 1 ? 0 : i + stride));
    }, 1000);
    return () => clearInterval(id);
  }, [preview, route]);

  let position: { lat: number; lng: number; heading?: number | null } | null;
  let maneuverIdx: number;
  let remainingS: number;
  let remainingM: number;
  let toManeuverM: number;
  if (preview) {
    const pts = route.geometry;
    const a = pts[simIdx];
    const b = pts[Math.min(simIdx + 1, pts.length - 1)];
    position = { lat: a[0], lng: a[1], heading: bearing(a, b) };
    const found = route.maneuvers.findIndex((mn) => mn.begin_shape_index > simIdx) - 1;
    maneuverIdx = found < 0 ? Math.max(0, route.maneuvers.length - 1) : found;
    const frac = pts.length > 1 ? 1 - simIdx / (pts.length - 1) : 0;
    remainingS = Math.round(route.duration_s * frac);
    remainingM = Math.round(route.distance_m * frac);
    toManeuverM = route.maneuvers[maneuverIdx]?.distance_m ?? 0;
  } else {
    // Compass heading drives the cone + heading-up camera; GPS course is the
    // fallback (usually null on foot — which is the whole reason for the compass).
    position = fix
      ? { lat: fix.lat, lng: fix.lng, heading: compass ?? fix.heading }
      : route.geometry[0]
        ? { lat: route.geometry[0][0], lng: route.geometry[0][1], heading: compass }
        : null;
    maneuverIdx = state?.maneuver_index ?? 0;
    remainingS = state?.remaining_s ?? route.duration_s;
    remainingM = state?.remaining_m ?? route.distance_m;
    toManeuverM = state?.to_maneuver_m ?? route.maneuvers[maneuverIdx]?.distance_m ?? 0;
  }
  const maneuver = route.maneuvers[maneuverIdx];
  const following = route.maneuvers[maneuverIdx + 1];
  const etaMs = Date.now() + remainingS * 1000;

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

      <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
        <NavMap route={route} position={position} follow />

        {/* The maneuver banner — the turn now, and the one after it. */}
        <div
          style={{
            position: "absolute",
            top: "var(--space-3)",
            left: "var(--space-3)",
            right: "var(--space-3)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
            padding: "var(--space-3) var(--space-4)",
            background: "var(--card)",
            border: "1px solid var(--rule)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "0 6px 20px rgba(0,0,0,.16)",
          }}
        >
          <ManeuverGlyph kind={maneuver?.kind ?? "straight"} size={36} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-h2)", lineHeight: 1, color: "var(--ink)" }}>{formatNavDistance(toManeuverM)}</div>
            <div style={{ marginTop: 3 }}>{maneuver?.instruction ?? "Head toward your destination."}</div>
            {following ? (
              <div style={{ marginTop: 4, fontSize: "var(--fs-label)", color: "var(--ink-dim)", display: "flex", alignItems: "center", gap: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                then
                <ManeuverGlyph kind={following.kind} size={14} color="var(--ink-dim)" />
                {following.instruction}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* ETA · time · distance remaining. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)", padding: "var(--space-3) var(--space-4)", borderTop: "1px solid var(--rule)" }}>
        <span style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-h3)", color: "var(--ink)" }}>{clock(etaMs)}</span>
          <span style={{ fontSize: "var(--fs-micro)", textTransform: "uppercase", letterSpacing: "var(--ls-uc)", color: "var(--ink-dim)" }}>Arrival</span>
        </span>
        <span style={{ fontSize: "var(--fs-body)", color: "var(--ink-dim)" }}>
          {formatNavDuration(remainingS)} · {formatNavDistance(remainingM)}
        </span>
      </div>
    </div>
  );
}
