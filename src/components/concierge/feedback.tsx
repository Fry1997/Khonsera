"use client";

import { useState } from "react";
import { formatClock } from "./types";

// NudgeCard — the §13 care layer. Surfaced only when the day is legible enough
// that a human would notice the gap. Always dismissible; never pestering.
export function NudgeCard({
  message,
  actionLabel,
  onAction,
  onDismiss,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
}) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <aside
      className="rounded-card p-4"
      style={{ background: "var(--gold-tint)", border: "1px solid var(--gold-soft)" }}
    >
      <p className="text-ink">{message}</p>
      <div className="mt-3 flex gap-2">
        {actionLabel ? (
          <button type="button" className="btn btn-gold btn-sm" onClick={onAction}>
            {actionLabel}
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setDismissed(true);
            onDismiss?.();
          }}
        >
          Not now
        </button>
      </div>
    </aside>
  );
}

// ReadinessPrompt — the §14 back-calculation. From the first leave-the-house leg,
// work backward through the morning routine to one wake/prepare time.
export function ReadinessPrompt({
  leaveBy,
  wakeBy,
  steps,
}: {
  leaveBy: string;
  wakeBy: string;
  steps?: string[];
}) {
  return (
    <section
      className="rounded-card p-5"
      style={{ background: "var(--card)", border: "1px solid var(--rule)" }}
    >
      <span className="uc">To leave by {formatClock(leaveBy)}</span>
      <h2 className="h2 mt-1">
        Up by <span className="mono">{formatClock(wakeBy)}</span>
      </h2>
      {steps && steps.length > 0 ? (
        <p className="small mt-2">{steps.join(" · ")}</p>
      ) : null}
    </section>
  );
}
