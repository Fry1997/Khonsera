"use client";

// NavSessionView — the full-screen premium guidance surface, wired live. Composes
// the runtime loop (useNavSession: GPS → N0/N2) with the map plate (NavMap) and the
// skinned surface (GuidanceSurface). Drop-in: a screen supplies the route + the day's
// downstream commitments + handlers, and this renders the working experience — the
// dot on the route, the maneuver banner, the always-on event-ETA, and the one calm
// decision when the day thins. Degrades gracefully with no commitments (just guidance).

import { useEffect, useMemo, useState } from "react";
import { LazyNavMap as NavMap } from "@/components/nav/lazy-nav-map";
import { GuidanceSurface } from "./guidance-surface";
import { useNavSession } from "./use-nav-session";
import type { NavRoute } from "@/lib/nav/types";
import type { NavCommitment } from "@/lib/nav/session";
import type { RecoveryOption, ProtectTarget } from "@/lib/recovery/engine";
import type { NavTrigger } from "@/lib/nav/decision-loop";
import type { GuidanceFix } from "@/components/nav/use-guidance";

function bearing(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const dLng = toRad(b[1] - a[1]);
  const y = Math.sin(dLng) * Math.cos(toRad(b[0]));
  const x = Math.cos(toRad(a[0])) * Math.sin(toRad(b[0])) - Math.sin(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function NavSessionView(props: {
  route: NavRoute | null;
  active: boolean;
  voice: boolean;
  commitments: NavCommitment[];
  scheduledRemainingMin: number;
  online?: boolean;
  chrome?: "light" | "dark";
  // Staff bench: drive the surface from a simulated walk along the route, not GPS.
  preview?: boolean;
  recovery?: RecoveryOption[];
  disruption?: Extract<NavTrigger, { kind: "disruption" }>;
  downstreamDelayMin?: number;
  protect?: ProtectTarget;
  onReroute?: (from: GuidanceFix) => void;
  onEnd?: () => void;
  onRecenter?: () => void;
  onOverview?: () => void;
  // Accepting a decision applies its recommended way-out (the screen wires the seam).
  onAcceptDecision?: (decisionKey: string) => void;
}) {
  // Preview: a simulated dot walking the route (the bench), so the new surface is
  // visible without a live journey. Steps along the geometry once a second.
  const [simIdx, setSimIdx] = useState(0);
  const geom = props.route?.geometry;
  useEffect(() => {
    if (!props.preview || !geom || geom.length < 2) return;
    const stride = Math.max(1, Math.floor(geom.length / 40));
    const id = setInterval(() => {
      setSimIdx((i) => (i + stride >= geom.length - 1 ? 0 : i + stride));
    }, 1000);
    return () => clearInterval(id);
  }, [props.preview, geom]);

  const override = useMemo(() => {
    if (!props.preview || !props.route || !geom || geom.length < 2) return undefined;
    const a = geom[simIdx];
    const b = geom[Math.min(simIdx + 1, geom.length - 1)];
    const frac = geom.length > 1 ? 1 - simIdx / (geom.length - 1) : 0;
    const mIdx = Math.max(0, props.route.maneuvers.findIndex((mn) => mn.begin_shape_index > simIdx) - 1);
    return {
      fix: { lat: a[0], lng: a[1], heading: bearing(a, b), accuracy: 5 } as GuidanceFix,
      remainingMin: Math.round((props.route.duration_s * frac) / 60),
      maneuverIndex: mIdx,
      toManeuverM: props.route.maneuvers[mIdx]?.distance_m ?? 0,
      progress: geom.length > 1 ? simIdx / (geom.length - 1) : 0,
    };
  }, [props.preview, props.route, geom, simIdx]);

  const { fix, surfaceState, view, maneuver, progress, dismiss } = useNavSession({
    route: props.route,
    active: props.active,
    voice: props.voice,
    commitments: props.commitments,
    scheduledRemainingMin: props.scheduledRemainingMin,
    online: props.online,
    recovery: props.recovery,
    disruption: props.disruption,
    downstreamDelayMin: props.downstreamDelayMin,
    protect: props.protect,
    onReroute: props.onReroute,
    override,
  });

  const lead = view.etas[0];
  // A thin calm line when the day's thinning but no decision is raised yet.
  const consequence =
    view.pinch && !view.decision && view.pinch.state === "thinning"
      ? `The ${view.pinch.name} is getting tight — I'm watching it.`
      : undefined;

  const arrivedSpare = lead ? Math.max(0, lead.spareMin) : 0;

  return (
    <GuidanceSurface
      state={surfaceState}
      chrome={props.chrome}
      map={
        <NavMap
          route={props.route}
          position={fix ? { lat: fix.lat, lng: fix.lng, heading: fix.heading } : null}
          progress={progress}
          follow
        />
      }
      maneuver={maneuver}
      etas={view.etas}
      consequence={consequence}
      decision={view.decision}
      onRecenter={props.onRecenter}
      onOverview={props.onOverview}
      onEnd={props.onEnd}
      onAcceptDecision={props.onAcceptDecision && view.decision ? () => props.onAcceptDecision!(view.decision!.key) : undefined}
      onDismissDecision={view.decision ? () => dismiss(view.decision!.key) : undefined}
      arrived={
        lead
          ? { headline: `You made it — ${arrivedSpare} ${arrivedSpare === 1 ? "minute" : "minutes"} before.`, sub: `${lead.name}. I'll keep an eye on the way back.`, onBack: props.onEnd }
          : { headline: "You've arrived.", onBack: props.onEnd }
      }
    />
  );
}
