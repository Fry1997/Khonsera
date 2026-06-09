"use client";

import type { AnchorVM, LegVM } from "./types";
import { formatClock } from "./types";

// ActiveTile — the day-of hero (handover §18 day-of, §10 radius). Shows the
// current focus, the next anchor, and the leave-by, with an escalating urgency
// state. Placeholder; Design owns the final look of this identity surface.

export type ActiveUrgency = "comfortable" | "urgent" | "breach";

const URGENCY: Record<ActiveUrgency, { cls: string; label: string }> = {
  comfortable: { cls: "pill-ok", label: "On track" },
  urgent: { cls: "pill-soon", label: "Leave soon" },
  breach: { cls: "pill-late", label: "Running late" },
};

export function ActiveTile({
  headline,
  nextAnchor,
  nextLeg,
  leaveBy,
  urgency = "comfortable",
}: {
  headline?: string;
  nextAnchor?: AnchorVM;
  nextLeg?: LegVM;
  leaveBy?: string;
  urgency?: ActiveUrgency;
}) {
  const u = URGENCY[urgency];
  return (
    <section className="active-tile">
      <header className="mb-3 flex items-center justify-between gap-3">
        <span className="uc">Right now</span>
        <span className={`pill pill-status ${u.cls}`}>{u.label}</span>
      </header>

      <h2 className="h2">{headline ?? "Nothing on right now"}</h2>

      {nextAnchor ? (
        <p className="small mt-1">
          Next: <span className="text-ink">{nextAnchor.title}</span>
          {nextAnchor.time ? (
            <span className="mono"> · {formatClock(nextAnchor.time.from)}</span>
          ) : null}
        </p>
      ) : null}

      {nextLeg ? (
        <p className="small mt-0.5">
          via {nextLeg.mode} — {nextLeg.fromLabel} → {nextLeg.toLabel}
        </p>
      ) : null}

      {leaveBy ? (
        <div
          className="mt-4 flex items-baseline justify-between rounded-field p-3"
          style={{ background: "var(--card-2)" }}
        >
          <span className="uc">Leave by</span>
          <span className="mono h3">{formatClock(leaveBy)}</span>
        </div>
      ) : null}
    </section>
  );
}
