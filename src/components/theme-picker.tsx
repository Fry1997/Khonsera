"use client";

import { useEffect, useState } from "react";

// Theme picker — toggles the canonical Khonsera palettes from the brand
// book (Edition I · MMXXVI · p. 10–12):
//
//   • Dusk     — default; warm, candlelit
//   • Sahara   — sun-up; papyrus + ochre
//   • Midnight — overnight; aubergine + brass moon
//
// The selection writes data-theme on <html> and persists to localStorage.
// The companion init script in src/app/layout.tsx applies the saved value
// before first paint so the page never flashes the wrong palette.
//
// STAFF-ONLY for now (gated by isStaff in the settings page). When the
// alternate palettes are ready for everyone, remove the staff guard.

export type Theme = "light" | "sahara" | "dark";

const THEMES: ReadonlyArray<{
  value: Theme;
  label: string;
  blurb: string;
  swatch: [string, string, string];
}> = [
  {
    value: "light",
    label: "Dusk",
    blurb: "Default. Warm, candlelit. Nine of ten surfaces.",
    swatch: ["#efe6d0", "#1e1812", "#b8893f"],
  },
  {
    value: "sahara",
    label: "Sahara",
    blurb: "Sun-up. Papyrus + ochre. Daylight contexts.",
    swatch: ["#f3e8c8", "#20180e", "#a87826"],
  },
  {
    value: "dark",
    label: "Midnight",
    blurb: "Aubergine ground, brass moon. Reserved for after hours.",
    swatch: ["#1f1825", "#f4e8cf", "#d4a04d"],
  },
];

const STORAGE_KEY = "khonsera:theme";

function readStored(): Theme {
  if (typeof window === "undefined") return "light";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "sahara" || v === "dark" ? v : "light";
}

export function ThemePicker() {
  const [theme, setTheme] = useState<Theme>("light");

  // Sync from <html data-theme> on mount so the picker reflects what the
  // init script applied. Avoids a flash where the picker says "Dusk" but
  // the page is actually in Midnight.
  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    if (current === "sahara" || current === "dark") setTheme(current);
    else setTheme(readStored());
  }, []);

  function apply(next: Theme) {
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage may be denied (private mode, etc.) — the runtime swap
      // still works for the session.
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        role="radiogroup"
        aria-label="Palette"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 10,
        }}
      >
        {THEMES.map((opt) => {
          const active = theme === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => apply(opt.value)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 10,
                padding: "12px 14px",
                borderRadius: 12,
                border: `1px solid ${active ? "var(--gold)" : "var(--rule)"}`,
                background: active ? "var(--card)" : "var(--card-2)",
                boxShadow: active
                  ? "0 1px 0 var(--gold-tint), 0 6px 16px rgba(184, 137, 63, 0.10)"
                  : "none",
                cursor: "pointer",
                textAlign: "left",
                transition: "border-color 0.12s, background 0.12s, box-shadow 0.12s",
              }}
            >
              <Swatches colors={opt.swatch} />
              <div
                style={{
                  fontFamily: "var(--display)",
                  fontWeight: 500,
                  fontSize: 16,
                  letterSpacing: "-0.01em",
                  color: "var(--ink)",
                }}
              >
                {opt.label}
              </div>
              <div
                style={{
                  fontFamily: "var(--serif)",
                  fontStyle: "italic",
                  fontSize: 12.5,
                  color: "var(--ink-dim)",
                  lineHeight: 1.4,
                }}
              >
                {opt.blurb}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Swatches({ colors }: { colors: [string, string, string] }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {colors.map((c, i) => (
        <span
          key={i}
          style={{
            width: 18,
            height: 18,
            borderRadius: 999,
            background: c,
            border: "1px solid rgba(0,0,0,0.06)",
          }}
          aria-hidden
        />
      ))}
    </div>
  );
}
