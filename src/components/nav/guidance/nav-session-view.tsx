"use client";

// NavSessionView — the full-screen premium guidance surface, wired live. Composes
// the runtime loop (useNavSession: GPS → N0/N2) with the map plate (NavMap) and the
// skinned surface (GuidanceSurface). Drop-in: a screen supplies the route + the day's
// downstream commitments + handlers, and this renders the working experience — the
// dot on the route, the maneuver banner, the always-on event-ETA, and the one calm
// decision when the day thins. Degrades gracefully with no commitments (just guidance).

import { NavMap } from "@/components/nav/nav-map";
import { GuidanceSurface } from "./guidance-surface";
import { useNavSession } from "./use-nav-session";
import type { NavRoute } from "@/lib/nav/types";
import type { NavCommitment } from "@/lib/nav/session";
import type { RecoveryOption, ProtectTarget } from "@/lib/recovery/engine";
import type { NavTrigger } from "@/lib/nav/decision-loop";
import type { GuidanceFix } from "@/components/nav/use-guidance";

export function NavSessionView(props: {
  route: NavRoute | null;
  active: boolean;
  voice: boolean;
  commitments: NavCommitment[];
  scheduledRemainingMin: number;
  online?: boolean;
  chrome?: "light" | "dark";
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
  const { fix, surfaceState, view, maneuver, dismiss } = useNavSession({
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
