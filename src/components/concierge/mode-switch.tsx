"use client";

import type { Mode } from "./types";

// ModeSwitch — the Work/Personal spine made visible (handover §2). Presentational
// toggle; the privacy boundary itself is enforced in the data layer (RLS), not here.
export function ModeSwitch({
  mode,
  onChange,
  size = "md",
}: {
  mode: Mode;
  onChange?: (mode: Mode) => void;
  size?: "sm" | "md";
}) {
  const pad = size === "sm" ? "px-2.5 py-1" : "px-3.5 py-1.5";
  return (
    <div
      className="row inline-flex items-center gap-0.5 rounded-pill border border-rule"
      role="tablist"
      aria-label="Work or personal mode"
      style={{ background: "var(--card-2)", padding: "var(--space-0-5)" }}
    >
      {(["personal", "work"] as const).map((m) => {
        const active = m === mode;
        return (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange?.(m)}
            className={`uc rounded-pill ${pad} transition-colors`}
            style={{
              background: active ? "var(--gold)" : "transparent",
              color: active ? "var(--paper)" : "var(--ink-soft)",
              fontWeight: active ? 600 : 500,
            }}
          >
            {m === "personal" ? "Personal" : "Work"}
          </button>
        );
      })}
    </div>
  );
}
