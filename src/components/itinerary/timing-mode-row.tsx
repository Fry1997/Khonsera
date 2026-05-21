"use client";

import type { TimingMode } from "./types";

// Timing-mode segmented control — Arrive by / Leave by / Around then.
export function TimingModeRow({
  mode,
  onChange,
}: {
  mode: TimingMode;
  onChange: (next: TimingMode) => void;
}) {
  const options: Array<{
    value: TimingMode;
    label: string;
    helper: string;
  }> = [
    { value: "arrive_by", label: "Arrive by", helper: "I know when to be there" },
    { value: "leave_by", label: "Leave by", helper: "I know when I need to leave" },
    { value: "around_then", label: "Around then", helper: "Fit between things" },
  ];
  return (
    <div className="timing-mode-row">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="timing-mode-btn"
          data-active={o.value === mode}
          onClick={() => onChange(o.value)}
          title={o.helper}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
