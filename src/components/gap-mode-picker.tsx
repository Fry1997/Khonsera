"use client";

import { TransportIcon } from "@/components/icons";

export type GapMode = "walk" | "drive" | "taxi" | "cycle";

const GAP_MODES: Array<{
  value: GapMode;
  label: string;
  icon: keyof typeof TransportIcon;
}> = [
  { value: "walk", label: "Walk", icon: "walk" },
  { value: "drive", label: "Drive", icon: "drive" },
  { value: "taxi", label: "Taxi", icon: "taxi" },
  { value: "cycle", label: "Cycle", icon: "walk" },
];

export type GapPreview = {
  durationMinutes: number | null;
  distanceMiles: number | null;
} | "pending" | null;

export function GapModePicker({
  selected,
  onSelect,
  previews,
  fromLabel,
  toLabel,
}: {
  selected: GapMode | null;
  onSelect: (mode: GapMode) => void;
  previews?: Partial<Record<GapMode, GapPreview>>;
  fromLabel?: string;
  toLabel?: string;
}) {
  return (
    <div style={{ padding: "8px 0", display: "flex", flexDirection: "column", gap: 6 }}>
      {fromLabel && toLabel && (
        <div style={{ fontSize: 10, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--mono)", textAlign: "center" }}>
          {fromLabel} to {toLabel}
        </div>
      )}
      <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
        {GAP_MODES.map((m) => {
          const preview = previews?.[m.value];
          const dur = preview && preview !== "pending" ? preview.durationMinutes : null;
          const isActive = selected === m.value;
          const Icon = TransportIcon[m.icon];
          return (
            <button
              key={m.value}
              type="button"
              onClick={() => onSelect(m.value)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "5px 10px",
                borderRadius: 999,
                border: `1px solid ${isActive ? "var(--gold)" : "var(--rule)"}`,
                background: isActive ? "var(--gold-tint)" : "var(--card)",
                color: isActive ? "var(--gold-2)" : "var(--ink-dim)",
                fontSize: 11,
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <Icon size={12} />
              <span>{m.label}</span>
              {dur != null && (
                <span className="mono" style={{ fontSize: 10, opacity: 0.7 }}>
                  {dur}m
                </span>
              )}
              {preview === "pending" && (
                <span style={{ fontSize: 10, opacity: 0.5 }}>...</span>
              )}
            </button>
          );
        })}
      </div>
      {selected && (() => {
        const preview = previews?.[selected];
        const dur = preview && preview !== "pending" ? preview.durationMinutes : null;
        if (dur == null) return null;
        return (
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-dim)", textAlign: "center" }}>
            {dur} min {selected}{selected === "taxi" && dur ? " · ~£" + (3 + 1.5 * ((preview as any)?.distanceMiles ?? 0)).toFixed(0) : ""}
          </div>
        );
      })()}
    </div>
  );
}
