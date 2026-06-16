// Navigation session orchestrator (the runtime brain) — pure, so the loop logic
// is testable without GPS. It turns a live snapshot (active-leg remaining from the
// guidance engine + the day's downstream commitments + any fetched ways-out) into
// the surface view: the EventETAs (N0) and, when warranted, the one decision (N2).
//
// The React hook (use-nav-session.ts) feeds this a fresh snapshot on every position
// tick; this stays pure / no I/O so the "do we interrupt, and with what" decision is
// unit-tested. Disruption + ways-out come from the runtime (Darwin/TfL/fetch); here
// they're inputs.

import { projectDay, deriveMinutesFromNow, type EventETA } from "./event-eta";
import { evaluateNavDecision, type NavDecision, type NavTrigger } from "./decision-loop";
import type { ProtectTarget, RecoveryOption } from "@/lib/recovery/engine";

// A commitment on the day, minus the live "minutes from now" (the session derives
// that): downstreamMin is the SCHEDULED minutes from the active leg's END to this
// commitment's place (0 when this commitment IS the active leg's destination).
export type NavCommitment = {
  id: string;
  name: string;
  place: string;
  neededByIso: string;
  bufferMin: number;
  downstreamMin: number;
};

export type SessionSnapshot = {
  nowIso: string;
  // Live remaining minutes on the ACTIVE leg (guidance remaining_s ÷ 60). When there's
  // no fix yet, the caller passes the leg's scheduled remaining so the ETA still shows.
  activeLegRemainingMin: number;
  // What the route ORIGINALLY expected to still remain — the baseline for "behind".
  activeLegScheduledRemainingMin: number;
  commitments: NavCommitment[];
  // A live delay known to lie on the legs ahead (Darwin/TfL), added to every ETA.
  downstreamDelayMin?: number;
  // Ways-out for the affected leg, when fetched — turns a decision from calm → act.
  recovery?: RecoveryOption[];
  protect?: ProtectTarget;
  dismissedKeys?: string[];
  // External trigger (a disruption the runtime detected) takes precedence over pace.
  disruption?: Extract<NavTrigger, { kind: "disruption" }>;
  // Below this many minutes behind we don't raise a pace decision (calm). Default 3.
  paceFloorMin?: number;
};

export type SessionView = {
  etas: EventETA[];
  pinch: EventETA | null;
  decision: NavDecision | null;
  behindMin: number;
};

export function projectSession(s: SessionSnapshot): SessionView {
  const day = projectDay(
    s.nowIso,
    s.commitments.map((c) => ({
      id: c.id,
      name: c.name,
      place: c.place,
      neededByIso: c.neededByIso,
      bufferMin: c.bufferMin,
      minutesFromNow: deriveMinutesFromNow({
        activeLegRemainingMin: s.activeLegRemainingMin,
        downstreamMin: c.downstreamMin,
        downstreamDelayMin: s.downstreamDelayMin,
      }),
    })),
  );

  const behindMin = Math.max(0, Math.round(s.activeLegRemainingMin - s.activeLegScheduledRemainingMin));

  // The trigger: a detected disruption is the strongest signal; otherwise falling
  // behind pace. Either way, evaluateNavDecision stays SILENT unless the day is
  // actually thinning/breaking (the calm rule lives in N2, not here).
  let decision: NavDecision | null = null;
  const trigger: NavTrigger | null = s.disruption
    ? s.disruption
    : behindMin >= (s.paceFloorMin ?? 3)
      ? { kind: "pace", behindMin }
      : null;
  if (trigger) {
    decision = evaluateNavDecision({
      day,
      trigger,
      recovery: s.recovery,
      protect: s.protect,
      dismissedKeys: s.dismissedKeys,
    });
  }

  return { etas: day.etas, pinch: day.pinch, decision, behindMin };
}
