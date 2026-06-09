"use client";

import { useState } from "react";
import type { TransportOptionVM } from "./types";
import { formatClock, formatDelta, formatMoney } from "./types";

// ComparisonMatrix — the §7 transport decision layer. For scheduled transport we
// surface the TWO services bracketing the target (latest on-time-or-early; earliest
// acceptably-late) and let the user flip between them BEFORE "book?". Optimise for
// best fit, not speed. "Book" is the one stub (§17).
export function ComparisonMatrix({
  options,
  onBook,
}: {
  options: TransportOptionVM[];
  onBook?: (id: string) => void;
}) {
  const [selected, setSelected] = useState<string | undefined>(options[0]?.id);

  if (options.length === 0) {
    return (
      <div className="j-card-soft p-4">
        <p className="small">No sensible options for this leg.</p>
      </div>
    );
  }

  return (
    <div className="stack" style={{ display: "grid", gap: "var(--space-2)" }}>
      {options.map((opt) => {
        const active = opt.id === selected;
        const early = opt.deltaMinutes <= 0;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => setSelected(opt.id)}
            className={`j-card p-4 text-left transition-colors duration-fast${active ? " is-selected" : ""}`}
          >
            <header className="mb-1 flex items-baseline justify-between gap-3">
              <span className="uc">{opt.mode}</span>
              <span
                className={early ? "tag-ok" : "tag-tight"}
                style={!early ? { color: "var(--warning)" } : undefined}
              >
                {formatDelta(opt.deltaMinutes)}
              </span>
            </header>
            <p className="mono text-ink">
              {formatClock(opt.departure)} → {formatClock(opt.arrival)}
            </p>
            <p className="small mt-1">
              {opt.changes === 0
                ? "direct"
                : `${opt.changes} ${opt.changes === 1 ? "change" : "changes"}`}
              {opt.cost != null ? ` · ${formatMoney(opt.cost, opt.currency)}` : ""}
            </p>
          </button>
        );
      })}

      <button
        type="button"
        className="btn btn-gold btn-full"
        disabled={!selected}
        onClick={() => selected && onBook?.(selected)}
      >
        Book this
      </button>
      <p className="tiny" style={{ color: "var(--ink-soft)" }}>
        Booking hands off to the provider for now, then absorbs the result.
      </p>
    </div>
  );
}
