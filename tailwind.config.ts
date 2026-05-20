import type { Config } from "tailwindcss";

// Tailwind tokens map onto the CSS custom properties defined in
// src/app/globals.css. One source of truth.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        "paper-2": "var(--paper-2)",
        card: "var(--card)",
        "card-2": "var(--card-2)",
        ink: "var(--ink)",
        "ink-2": "var(--ink-2)",
        "ink-dim": "var(--ink-dim)",
        "ink-faint": "var(--ink-faint)",
        rule: "var(--rule)",
        "rule-2": "var(--rule-2)",
        terra: "var(--terra)",
        "terra-2": "var(--terra-2)",
        "terra-deep": "var(--terra-deep)",
        gold: "var(--gold)",
        "gold-2": "var(--gold-2)",
        "gold-soft": "var(--gold-soft)",
        plum: "var(--plum)",
        "plum-soft": "var(--plum-soft)",
        sage: "var(--sage)",
        "sage-2": "var(--sage-2)",
        amber: "var(--amber)",
        "amber-2": "var(--amber-2)",
        rust: "var(--rust)",
        "rust-2": "var(--rust-2)",
        // Aliases kept for any code that still references the older
        // shadcn-style names from Phase 0.
        background: "var(--paper)",
        foreground: "var(--ink)",
        muted: "var(--card-2)",
        "muted-foreground": "var(--ink-dim)",
        border: "var(--rule)",
        accent: "var(--ink-soft)",
        "accent-foreground": "var(--ink)",
        primary: "var(--ink)",
        "primary-foreground": "var(--paper)",
        destructive: "var(--rust)",
      },
      fontFamily: {
        sans: ["var(--sans)"],
        serif: ["var(--serif)"],
        mono: ["var(--mono)"],
        display: ["var(--display)"],
      },
      borderRadius: {
        sm: "3px",
        DEFAULT: "4px",
        md: "6px",
      },
    },
  },
  plugins: [],
};

export default config;
