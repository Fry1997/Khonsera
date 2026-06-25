// StatePill — the mono, uppercase status capsule (Design System 2). One pill for
// the two status jobs in the planner: FEASIBILITY (comfortable / tight / risky)
// and LIFECYCLE (booked / planned / live / done / offline). A leading dot is on
// by default; `solid` inverts to a filled capsule for the loudest states. Colours
// are tokens (sage/amber/rust/gold/slate) so it follows the active theme.

import type { CSSProperties, ReactNode } from "react";

export type StateName =
  | "comfortable"
  | "tight"
  | "risky"
  | "live"
  | "booked"
  | "planned"
  | "done"
  | "offline";

const STATES: Record<StateName, { c: string; soft: string; label: string; solidFg: string }> = {
  comfortable: { c: "var(--sage)", soft: "var(--sage-soft)", label: "Comfortable", solidFg: "#f6f7ef" },
  tight: { c: "var(--amber)", soft: "var(--amber-soft)", label: "Tight", solidFg: "#fdf8e9" },
  risky: { c: "var(--rust)", soft: "var(--rust-soft)", label: "Risky", solidFg: "#fdeae6" },
  live: { c: "var(--gold-2)", soft: "var(--gold-tint)", label: "Live", solidFg: "#fff" },
  booked: { c: "var(--sage)", soft: "var(--sage-soft)", label: "Booked", solidFg: "#f6f7ef" },
  planned: { c: "var(--slate-2)", soft: "var(--slate-soft)", label: "Planned", solidFg: "#fff" },
  done: { c: "var(--ink-faint)", soft: "var(--ink-soft)", label: "Done", solidFg: "#fff" },
  offline: { c: "var(--ink-dim)", soft: "var(--ink-soft)", label: "Saved offline", solidFg: "#fff" },
};

export function StatePill({
  state = "comfortable",
  children,
  dot = true,
  solid = false,
  live = false,
  style,
}: {
  state?: StateName;
  children?: ReactNode;
  dot?: boolean;
  solid?: boolean;
  live?: boolean; // pulse the dot (use with state="live")
  style?: CSSProperties;
}) {
  const s = STATES[state] ?? STATES.comfortable;
  const base: CSSProperties = solid ? { background: s.c, color: s.solidFg } : { background: s.soft, color: s.c };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 9px",
        borderRadius: 4,
        fontFamily: "var(--mono)",
        fontSize: 10,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        whiteSpace: "nowrap",
        ...base,
        ...style,
      }}
    >
      {dot && (
        <span
          className={live ? "livedot" : undefined}
          style={{ width: 5, height: 5, borderRadius: 999, background: "currentColor", flex: "none" }}
        />
      )}
      {children || s.label}
    </span>
  );
}
