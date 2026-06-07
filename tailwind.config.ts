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
        slate: "var(--slate)",
        "slate-2": "var(--slate-2)",
        // Semantic aliases over the brand ramp (success/warning/danger/info).
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
        disruption: "var(--disruption)",
        info: "var(--info)",
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
      // Type scale → var(--fs-*) as NEW utilities (text-h1, text-body, …);
      // Tailwind's default text-sm/base/lg are untouched.
      fontSize: {
        display: "var(--fs-display)",
        h1: "var(--fs-h1)",
        h2: "var(--fs-h2)",
        h3: "var(--fs-h3)",
        body: "var(--fs-body)",
        label: "var(--fs-label)",
        micro: "var(--fs-micro)",
      },
      // Brand radii as NEW utility names so Tailwind's default rounded-sm/lg/xl
      // (used in a few places) keep their original values. sm/DEFAULT/md are
      // re-pointed to identical-value vars.
      borderRadius: {
        sm: "var(--radius-xs)", // 3px — matches the prior override
        DEFAULT: "var(--radius-sm)", // 4px
        md: "var(--radius-md)", // 6px
        card: "var(--radius-xl)", // 18px
        field: "var(--radius-lg)", // 12px
        pill: "var(--radius-pill)", // 999px
      },
      transitionDuration: {
        fast: "var(--dur-fast)",
        base: "var(--dur-base)",
        slow: "var(--dur-slow)",
      },
      transitionTimingFunction: {
        standard: "var(--ease-standard)",
        entrance: "var(--ease-out)",
        exit: "var(--ease-in)",
      },
    },
  },
  plugins: [],
};

export default config;
