"use client";

import { useState } from "react";
import { TransportIcon } from "@/components/icons";

// Feature flag — flip to true when transport search API is ready
const ENABLE_TRANSPORT_SEARCH = false;

export type GapMode = "walk" | "drive" | "taxi" | "cycle";
export type TransportSearchMode = "train" | "bus" | "flight";

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

const SEARCH_MODES: Array<{
  value: TransportSearchMode;
  label: string;
  icon: keyof typeof TransportIcon;
}> = [
  { value: "train", label: "Find a train", icon: "train" },
  { value: "bus", label: "Find a bus", icon: "bus" },
  { value: "flight", label: "Find a flight", icon: "flight" },
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
  onSearchTransport,
}: {
  selected: GapMode | null;
  onSelect: (mode: GapMode) => void;
  previews?: Partial<Record<GapMode, GapPreview>>;
  fromLabel?: string;
  toLabel?: string;
  onSearchTransport?: (mode: TransportSearchMode) => void;
}) {
  const [searchOpen, setSearchOpen] = useState(false);

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
        {ENABLE_TRANSPORT_SEARCH && onSearchTransport && (
          <button
            type="button"
            onClick={() => setSearchOpen(!searchOpen)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "5px 10px",
              borderRadius: 999,
              border: `1px dashed ${searchOpen ? "var(--gold)" : "var(--rule)"}`,
              background: searchOpen ? "var(--gold-tint)" : "transparent",
              color: searchOpen ? "var(--gold-2)" : "var(--ink-faint)",
              fontSize: 11,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <TransportIcon.train size={12} />
            <span>Find transport</span>
          </button>
        )}
      </div>

      {/* Transport search panel — hidden behind feature flag */}
      {ENABLE_TRANSPORT_SEARCH && searchOpen && onSearchTransport && (
        <div
          style={{
            padding: "10px 12px",
            background: "var(--card-2)",
            borderRadius: 10,
            border: "1px dashed var(--rule)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <span className="uc" style={{ fontSize: 9 }}>
            Search for transport {fromLabel && toLabel ? `from ${fromLabel} to ${toLabel}` : ""}
          </span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {SEARCH_MODES.map((m) => {
              const Icon = TransportIcon[m.icon];
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => {
                    onSearchTransport(m.value);
                    setSearchOpen(false);
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "6px 12px",
                    borderRadius: 10,
                    border: "1px solid var(--rule)",
                    background: "var(--card)",
                    color: "var(--ink-dim)",
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  <Icon size={14} />
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

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
