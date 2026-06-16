"use client";

// useNavSession — the runtime loop. Wraps the existing useGuidance (GPS + voice +
// off-route reroute) and, on every fix, runs the pure session orchestrator
// (projectSession) to produce the surface view: the live EventETAs + the one
// decision, plus the maneuver banner VM. The screen renders <GuidanceSurface> from
// what this returns. Disruption + ways-out are passed in by the screen (Darwin/TfL/
// fetch); pace is derived here from the guidance remaining vs the scheduled remaining.

import { useCallback, useMemo, useState } from "react";
import type { NavRoute } from "@/lib/nav/types";
import { formatNavDistance } from "@/lib/nav/guidance";
import { useGuidance, type GuidanceFix } from "@/components/nav/use-guidance";
import { projectSession, type NavCommitment, type SessionView } from "@/lib/nav/session";
import type { ProtectTarget, RecoveryOption } from "@/lib/recovery/engine";
import type { NavTrigger } from "@/lib/nav/decision-loop";
import type { ManeuverVM, GuidanceState as SurfaceState } from "./guidance-surface";

export function useNavSession(opts: {
  route: NavRoute | null;
  active: boolean;
  voice: boolean;
  // The day's downstream commitments (with scheduled downstream minutes per the spec).
  commitments: NavCommitment[];
  // What the route originally expected to still remain on the active leg (baseline
  // for "behind"); the live remaining comes from the guidance tick.
  scheduledRemainingMin: number;
  online?: boolean; // false → the offsignal state (cached route)
  recovery?: RecoveryOption[];
  disruption?: Extract<NavTrigger, { kind: "disruption" }>;
  downstreamDelayMin?: number;
  protect?: ProtectTarget;
  onReroute?: (from: GuidanceFix) => void;
  // Preview/demo override — drives the surface from a simulated position instead of
  // GPS (the staff bench), so the new surface is visible without a live journey.
  override?: {
    fix: GuidanceFix;
    remainingMin: number;
    maneuverIndex: number;
    toManeuverM: number;
    arrived?: boolean;
  };
}) {
  const { fix, state, geoError } = useGuidance(opts.route, opts.active, {
    voice: opts.voice,
    onReroute: opts.onReroute,
  });

  const [dismissed, setDismissed] = useState<string[]>([]);
  const dismiss = useCallback((key: string) => setDismissed((d) => (d.includes(key) ? d : [...d, key])), []);

  const ov = opts.override;
  const liveFix = ov?.fix ?? fix;

  // Live remaining on the active leg → minutes (override in preview; fall back to the
  // scheduled remaining before the first fix so the ETA shows immediately).
  const activeLegRemainingMin = ov ? ov.remainingMin : state ? state.remaining_s / 60 : opts.scheduledRemainingMin;

  const view: SessionView = useMemo(
    () =>
      projectSession({
        nowIso: new Date().toISOString(),
        activeLegRemainingMin,
        activeLegScheduledRemainingMin: opts.scheduledRemainingMin,
        commitments: opts.commitments,
        downstreamDelayMin: opts.downstreamDelayMin,
        recovery: opts.recovery,
        protect: opts.protect,
        disruption: opts.disruption,
        dismissedKeys: dismissed,
      }),
    [activeLegRemainingMin, opts.scheduledRemainingMin, opts.commitments, opts.downstreamDelayMin, opts.recovery, opts.protect, opts.disruption, dismissed],
  );

  // The surface state machine.
  const surfaceState: SurfaceState =
    ov?.arrived || state?.arrived
      ? "arrived"
      : !ov && opts.active && !fix && !geoError
        ? "acquiring"
        : opts.online === false
          ? "offsignal"
          : "guiding";

  // The maneuver banner VM from the current tick (or the override in preview).
  const maneuverIndex = ov ? ov.maneuverIndex : state?.maneuver_index;
  const toManeuverM = ov ? ov.toManeuverM : state?.to_maneuver_m;
  const maneuver: ManeuverVM | undefined = useMemo(() => {
    if (!opts.route || maneuverIndex == null || toManeuverM == null) return undefined;
    const m = opts.route.maneuvers[maneuverIndex];
    if (!m) return undefined;
    const [value, unit = ""] = formatNavDistance(toManeuverM).split(" ");
    const next = opts.route.maneuvers[maneuverIndex + 1];
    return { kind: m.kind, distanceValue: value, distanceUnit: unit, step: m.instruction, nextKind: next?.kind };
  }, [opts.route, maneuverIndex, toManeuverM]);

  return { fix: liveFix, geoError, surfaceState, view, maneuver, dismiss };
}
