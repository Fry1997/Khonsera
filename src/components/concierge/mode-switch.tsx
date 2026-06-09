"use client";

import type { Mode } from "./types";

// ModeSwitch — the Work/Personal toggle, rebuilt to Design's contract
// (`.cc-modeswitch`). A toggle, not a tab. The privacy boundary is enforced in
// the data layer (RLS); this is just the lens. (Round 2 · Nav.html.)
export function ModeSwitch({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange?: (mode: Mode) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="cc-modeswitch" role="tablist" aria-label="Work or personal mode">
      <button
        type="button"
        role="tab"
        aria-selected={mode === "personal"}
        data-active={mode === "personal" ? "true" : "false"}
        onClick={() => onChange?.("personal")}
      >
        Personal
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "work"}
        data-active={mode === "work" ? "true" : "false"}
        onClick={() => onChange?.("work")}
      >
        Work
      </button>
    </div>
  );
}
