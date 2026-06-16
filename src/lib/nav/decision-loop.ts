// Navigation decision loop (N2 — the concierge "ACT" step).
//
// The loop in the nav spec (D86 §2) is: snap → project → compare → classify → ACT.
// N0 (event-eta.ts) does project/compare/classify. This is ACT: given the live day
// projection + what just changed (you're behind / you went off-route / a train or
// line is disrupted), decide whether to interrupt the user AT ALL, and if so raise
// ONE calm, confirmable recommendation — sourced from the recovery engine.
//
// Pure / deterministic / no I/O. The triggers and the recovery candidates are fed in
// by the runtime (GPS pace, the off-route detector, Darwin/TfL, the ways-out fetch);
// this decides the single thing to say. Governing rule: calm caution that carries
// consequence, never alarm — so when the day is still fine, it says NOTHING.

import type { DayProjection, EventETA } from "./event-eta";
import {
  rankFor,
  type ProtectTarget,
  type RecoveryMode,
  type RecoveryOption,
} from "@/lib/recovery/engine";

export type NavTrigger =
  | { kind: "pace"; behindMin: number } // GPS shows you slower than the route assumed
  | { kind: "off_route"; reroutedDelayMin: number } // the detour the auto-reroute took adds time
  | {
      kind: "disruption";
      mode: RecoveryMode;
      line?: string; // "Victoria line" · "LNER 11:03"
      delayMin: number;
      cancelled?: boolean;
    };

export type NavDecision = {
  // Stable per (trigger, pinch) so a dismiss sticks and the same situation doesn't
  // re-raise on every position tick.
  key: string;
  // "act" = there's a way out to choose; "calm" = we're just telling you, no action.
  severity: "calm" | "act";
  headline: string; // what changed
  consequence: string; // what it does to your day (the pinch)
  pinchName: string;
  recommendation?: {
    option: RecoveryOption;
    tradeoff: string; // the option's honest impact (+ return note if threatened)
  };
};

function abs(n: number): number {
  return n < 0 ? -n : n;
}

function headlineFor(t: NavTrigger): string {
  if (t.kind === "pace") return `You're running ${t.behindMin} min behind.`;
  if (t.kind === "off_route") return `That detour adds about ${t.reroutedDelayMin} min.`;
  const who = t.line ?? t.mode;
  return t.cancelled ? `${who} is cancelled ahead.` : `${who} is delayed ${t.delayMin} min ahead.`;
}

function consequenceFor(pinch: EventETA): string {
  if (pinch.state === "will_miss") {
    return `You'd reach ${pinch.name} ${abs(pinch.spareMin)} min late.`;
  }
  // thinning — makes it, but tighter than the comfort buffer.
  return `Your cushion into ${pinch.name} is down to ${Math.max(0, pinch.spareMin)} min.`;
}

export type NavDecisionInput = {
  day: DayProjection; // already live-projected (N0)
  trigger: NavTrigger;
  recovery?: RecoveryOption[]; // ways-out for the affected leg, when fetched
  protect?: ProtectTarget; // default earliest-arrival
  dismissedKeys?: string[]; // decisions the user already waved off this session
};

/**
 * Decide the single thing to surface — or nothing. Returns null when the day is
 * still on track (the geography auto-rerouted; no concierge interruption needed) or
 * when this exact situation was already dismissed.
 */
export function evaluateNavDecision(input: NavDecisionInput): NavDecision | null {
  const pinch = input.day.pinch;
  // Nothing is breaking or thinning → stay quiet. A wrong turn we already corrected
  // silently doesn't earn an interruption if you still make your day.
  if (!pinch) return null;

  const key = `${input.trigger.kind}:${pinch.commitmentId}`;
  if (input.dismissedKeys?.includes(key)) return null;

  const headline = headlineFor(input.trigger);
  const consequence = consequenceFor(pinch);

  // A way out, if we have candidates. Rank by the protect-target (default earliest
  // arrival); the recovery engine already wrote each option's honest consequence.
  const options = input.recovery && input.recovery.length > 0
    ? rankFor(input.recovery, input.protect ?? "earliest-arrival")
    : [];
  const best = options[0];

  if (best) {
    return {
      key,
      severity: "act",
      headline,
      consequence,
      pinchName: pinch.name,
      recommendation: {
        option: best,
        tradeoff: best.returnNote ? `${best.consequence} · ${best.returnNote}` : best.consequence,
      },
    };
  }

  // No ways-out to offer (none fetched, or none exist) — inform calmly, don't alarm.
  return { key, severity: "calm", headline, consequence, pinchName: pinch.name };
}
