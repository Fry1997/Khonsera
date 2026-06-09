"use client";

import type { AnchorVM, LegVM } from "./types";
import { formatClock } from "./types";

// ActiveTile — Today's hero, rebuilt to Design's contract
// (`.cc-active-tile[data-urgency]`). Fixed layout across the four states; only
// the status dot + words change. (Round 2 · today.md.)

export type ActiveUrgency = "comfortable" | "urgent" | "breach";

const URGENCY: Record<ActiveUrgency, string> = {
  comfortable: "On track",
  urgent: "Leave soon",
  breach: "Running late",
};

export function ActiveTile({
  headline,
  sub,
  nextAnchor,
  nextLeg,
  leaveBy,
  urgency = "comfortable",
}: {
  headline?: string;
  sub?: string;
  nextAnchor?: AnchorVM;
  nextLeg?: LegVM;
  leaveBy?: string;
  urgency?: ActiveUrgency;
}) {
  const subline = sub ?? (nextLeg ? `via ${nextLeg.mode} — ${nextLeg.fromLabel} → ${nextLeg.toLabel}` : undefined);
  return (
    <section className="cc-active-tile" data-urgency={urgency}>
      <span className="cc-at-status">
        <span className="cc-at-dot" />
        {URGENCY[urgency]}
      </span>

      <h2 className="cc-at-headline">{headline ?? "Nothing in motion today"}</h2>
      {subline ? <p className="cc-at-sub">{subline}</p> : null}

      {leaveBy ? (
        <div className="cc-at-leaveby">
          <span className="l">Leave by</span>
          <span className="v">{formatClock(leaveBy)}</span>
        </div>
      ) : null}

      {nextAnchor ? (
        <div className="cc-at-next">
          <span className="who">Next · {nextAnchor.title}</span>
          {nextAnchor.time ? <span className="when">{formatClock(nextAnchor.time.from)}</span> : null}
        </div>
      ) : null}
    </section>
  );
}
